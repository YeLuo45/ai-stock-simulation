"""IPO / 次新股价值评估服务."""
import json
from datetime import datetime
from typing import Dict, Any, Optional

from data_sources.manager import get_ds_manager
from ai.chains import get_ai_service
from sqlalchemy.orm import Session

DEFAULT_MODEL_PRIORITY = ["minimax", "zhipu", "claude", "gemini"]


def _normalize_kline_records(raw_klines: Any) -> list[Dict[str, Any]]:
    """Normalize different datasource payloads into a simple record list."""
    if raw_klines is None:
        return []

    if isinstance(raw_klines, dict):
        if "data" in raw_klines:
            return _normalize_kline_records(raw_klines.get("data"))
        return []

    if hasattr(raw_klines, "to_dict"):
        try:
            if hasattr(raw_klines, "tail"):
                raw_klines = raw_klines.tail(60)
            raw_klines = raw_klines.to_dict("records")
        except Exception:
            return []

    if not isinstance(raw_klines, list):
        return []

    normalized: list[Dict[str, Any]] = []
    for item in raw_klines:
        if not isinstance(item, dict):
            continue

        close = item.get("close", item.get("收盘"))
        if close is None:
            continue

        normalized.append(
            {
                "date": item.get("date", item.get("日期", "")),
                "open": float(item.get("open", item.get("开盘", close)) or close),
                "high": float(item.get("high", item.get("最高", close)) or close),
                "low": float(item.get("low", item.get("最低", close)) or close),
                "close": float(close),
                "volume": float(item.get("volume", item.get("成交量", 0)) or 0),
            }
        )

    return normalized


def _calculate_technical_indicators(klines: list) -> Dict[str, Any]:
    """Calculate technical indicators from K-line data."""
    if not klines or len(klines) < 5:
        return {
            "trend": "震荡",
            "rsi": 50,
            "macd_signal": "中性",
            "support_level": 0,
            "resistance_level": 0,
            "ma5": 0,
            "ma20": 0,
        }

    closes = [k["close"] for k in klines]
    volumes = [k["volume"] for k in klines]

    # MA
    ma5 = sum(closes[-5:]) / min(5, len(closes)) if len(closes) >= 5 else sum(closes) / len(closes)
    ma20 = sum(closes[-20:]) / min(20, len(closes)) if len(closes) >= 20 else ma5

    # RSI (14-period)
    period = 14
    if len(closes) > period:
        gains = []
        losses = []
        for i in range(len(closes) - period, len(closes)):
            diff = closes[i] - closes[i - 1]
            gains.append(max(diff, 0))
            losses.append(max(-diff, 0))
        avg_gain = sum(gains) / period
        avg_loss = sum(losses) / period
        if avg_loss == 0:
            rsi = 100
        else:
            rs = avg_gain / avg_loss
            rsi = 100 - (100 / (1 + rs))
    else:
        rsi = 50

    # MACD (simplified 12/26/9)
    if len(closes) >= 26:
        ema12 = _ema(closes[-12:] if len(closes) >= 12 else closes, 12)
        ema26 = _ema(closes[-26:] if len(closes) >= 26 else closes, 26)
        macd = ema12 - ema26
        macd_signal = _ema([macd] * 9, 9) if macd else 0
        macd_hist = macd - macd_signal if macd and macd_signal else 0
        macd_signal_str = "多头" if macd_hist > 0 else "空头" if macd_hist < 0 else "中性"
    else:
        macd_hist = 0
        macd_signal_str = "中性"

    # Support/Resistance
    high = max(closes[-20:]) if len(closes) >= 20 else max(closes)
    low = min(closes[-20:]) if len(closes) >= 20 else min(closes)

    current = closes[-1]
    support = low
    resistance = high

    # Trend
    if ma5 > ma20 * 1.02:
        trend = "上涨"
    elif ma5 < ma20 * 0.98:
        trend = "下跌"
    else:
        trend = "震荡"

    return {
        "trend": trend,
        "rsi": round(rsi, 1),
        "macd_signal": macd_signal_str,
        "support_level": round(support, 2),
        "resistance_level": round(resistance, 2),
        "ma5": round(ma5, 2),
        "ma20": round(ma20, 2),
    }


def _ema(data: list, period: int) -> float:
    """Calculate EMA."""
    if not data:
        return 0
    k = 2 / (period + 1)
    ema = data[0]
    for v in data[1:]:
        ema = v * k + ema * (1 - k)
    return ema


def get_ordered_candidate_models(requested_model: str, db: Optional[Session] = None) -> list[str]:
    """Return requested model first, then remaining models by configured priority."""
    ordered = list(DEFAULT_MODEL_PRIORITY)

    if db is not None:
        from models import AIModelPriority

        records = db.query(AIModelPriority).order_by(AIModelPriority.priority_order).all()
        if records:
            ordered = [record.model_id for record in records if record.model_id]

    if requested_model not in ordered:
        ordered.insert(0, requested_model)
    else:
        ordered = [requested_model] + [model for model in ordered if model != requested_model]

    return ordered


def _invoke_ai_evaluate(
    fundamental: Dict[str, Any],
    technical: Dict[str, Any],
    stock_code: str,
    stock_name: str,
    model_name: str = "minimax",
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    """
    Use a single AI model to generate a comprehensive IPO evaluation.
    """
    service = get_ai_service(model_name=model_name, db=db)

    prompt = f"""你是一个专业的新股/次新股分析师。请对以下股票进行全面评估。

股票代码：{stock_code}
股票名称：{stock_name}

基本面数据：
{json.dumps(fundamental, ensure_ascii=False, indent=2)}

技术面数据：
{json.dumps(technical, ensure_ascii=False, indent=2)}

请返回JSON格式的评估结果：
{{
  "score": 0-100的综合评分,
  "recommendation": "强烈推荐" | "推荐" | "中性" | "回避" | "强烈回避",
  "analysis": "综合分析说明（200字以内）"
}}

评分标准：
- 90-100：强烈推荐（基本面优秀，技术面强势）
- 70-89：推荐（基本面良好，有上涨空间）
- 50-69：中性（基本面一般，观望为主）
- 30-49：回避（基本面或技术面存在较大风险）
- 0-29：强烈回避（高风险，建议规避）

只返回JSON，不要有其他文字。"""

    from langchain_core.messages import HumanMessage, SystemMessage

    messages = [
        SystemMessage(content="你是一个专业的新股分析师，只返回JSON格式结果。"),
        HumanMessage(content=prompt),
    ]
    response = service.llm.invoke(messages)
    content = str(response.content).strip()

    import re

    match = re.search(r"\{.*\}", content, re.DOTALL)
    if not match:
        raise ValueError("AI返回结果不是有效JSON")

    result = json.loads(match.group(0))
    return {
        "score": int(result.get("score", 50)),
        "recommendation": result.get("recommendation", "中性"),
        "analysis": result.get("analysis", ""),
    }


def _ai_evaluate(
    fundamental: Dict[str, Any],
    technical: Dict[str, Any],
    stock_code: str,
    stock_name: str,
    model_name: str = "minimax",
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    """Try requested model first, then fall back by configured priority."""
    candidate_models = get_ordered_candidate_models(model_name, db=db)
    errors: list[str] = []

    for candidate_model in candidate_models:
        try:
            result = _invoke_ai_evaluate(
                fundamental,
                technical,
                stock_code,
                stock_name,
                model_name=candidate_model,
                db=db,
            )
            fallback_used = candidate_model != model_name
            fallback_reason = None
            if fallback_used and errors:
                fallback_reason = f"{model_name} 不可用，已自动切换到 {candidate_model}。原因：{errors[0]}"

            return {
                **result,
                "requested_model": model_name,
                "actual_model": candidate_model,
                "fallback_used": fallback_used,
                "fallback_reason": fallback_reason,
            }
        except Exception as e:
            errors.append(f"{candidate_model}: {str(e)}")

    friendly_reason = "；".join(errors[:3]) if errors else "未知错误"
    fallback_used = len(candidate_models) > 1
    analysis = "请求模型当前不可用，系统已尝试自动切换其他模型，但本次评估仍未成功。请检查模型配置或稍后重试。"

    if fallback_used:
        return {
            "score": 50,
            "recommendation": "中性",
            "analysis": analysis,
            "requested_model": model_name,
            "actual_model": model_name,
            "fallback_used": True,
            "fallback_reason": friendly_reason,
        }

    return {
        "score": 50,
        "recommendation": "中性",
        "analysis": analysis,
        "requested_model": model_name,
        "actual_model": model_name,
        "fallback_used": False,
        "fallback_reason": friendly_reason,
    }


def evaluate_ipo(
    stock_code: str,
    model_name: str = "minimax",
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    """
    Main IPO evaluation function.
    Returns structured evaluation result.
    """
    # Normalize stock code
    stock_code = stock_code.strip()

    # Get K-line data (fundamental for technical analysis)
    kline_result = get_ds_manager().get_historical_kline(stock_code, period="daily")
    raw_klines = kline_result.get("data", []) if kline_result.get("success") else []
    klines = _normalize_kline_records(raw_klines)
    source_used = kline_result.get("source_used", "unknown")

    # Get stock info
    info_result = get_ds_manager().get_stock_info(stock_code)
    stock_info = info_result.get("data", {}) if info_result.get("success") else {}

    # Get realtime quote
    quote_result = get_ds_manager().get_realtime_quote(stock_code)
    quote_data = quote_result.get("data", {}) if quote_result.get("success") else {}

    # Get financial data
    fin_result = get_ds_manager().get_financial_data(stock_code)
    fin_data = fin_result.get("data", {}) if fin_result.get("success") else {}

    # Build fundamental data
    fundamental = {
        "pe": fin_data.get("pe"),
        "pb": fin_data.get("pb"),
        "roe": fin_data.get("roe"),
        "gross_margin": fin_data.get("gross_margin"),
        "revenue_growth": None,  # Will be filled if available
        "net_profit_growth": None,
        "issue_price": None,
        "current_price": quote_data.get("price"),
        "listing_date": None,
        "days_since_listing": None,
    }

    # Try to get IPO info
    ipo_result = get_ds_manager().get_ipo_info(stock_code)
    if ipo_result.get("success"):
        ipo_data = ipo_result.get("data", {})
        fundamental["issue_price"] = ipo_data.get("issue_price")
        fundamental["listing_date"] = ipo_data.get("listing_date")
        # Calculate days since listing
        listing_date_str = ipo_data.get("listing_date", "")
        if listing_date_str:
            try:
                listing_date = datetime.strptime(listing_date_str, "%Y%m%d")
                fundamental["days_since_listing"] = (datetime.now() - listing_date).days
            except Exception:
                pass

    # Calculate technical indicators
    technical = _calculate_technical_indicators(klines)
    if quote_data:
        technical["current_price"] = quote_data.get("price")
        technical["change_pct"] = quote_data.get("change_pct")

    # AI evaluation
    stock_name = quote_data.get("name", stock_info.get("股票简称", stock_code))
    ai_result = _ai_evaluate(
        fundamental,
        technical,
        stock_code,
        stock_name,
        model_name,
        db=db,
    )

    # Build response
    return {
        "stock_code": stock_code,
        "stock_name": stock_name,
        "score": ai_result["score"],
        "recommendation": ai_result["recommendation"],
        "fundamental": {
            "pe": fundamental["pe"],
            "pb": fundamental["pb"],
            "roe": fundamental["roe"],
            "gross_margin": fundamental["gross_margin"],
            "revenue_growth": fundamental["revenue_growth"],
            "net_profit_growth": fundamental["net_profit_growth"],
            "issue_price": fundamental["issue_price"],
            "listing_date": fundamental["listing_date"],
            "days_since_listing": fundamental["days_since_listing"],
        },
        "technical": {
            "trend": technical["trend"],
            "rsi": technical["rsi"],
            "macd_signal": technical["macd_signal"],
            "support_level": technical["support_level"],
            "resistance_level": technical["resistance_level"],
            "ma5": technical["ma5"],
            "ma20": technical["ma20"],
            "current_price": technical.get("current_price"),
            "change_pct": technical.get("change_pct"),
        },
        "analysis": ai_result["analysis"],
        "data_sources": [source_used],
        "requested_model": ai_result.get("requested_model", model_name),
        "actual_model": ai_result.get("actual_model", model_name),
        "fallback_used": ai_result.get("fallback_used", False),
        "fallback_reason": ai_result.get("fallback_reason"),
        "evaluated_at": datetime.now().isoformat(),
    }
