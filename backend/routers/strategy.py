"""Router: Strategy generation from natural language and autocomplete."""
import json
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from database import get_db
from data.market_data import get_stock_list, get_realtime_quotes
from ai.chains import get_ai_service

router = APIRouter(prefix="/api/strategy", tags=["strategy"])


# ============== Request/Response Models ==============

class NLGenerateRequest(BaseModel):
    description: str = Field(..., description="自然语言策略描述，如 '当MACD金叉时买入，跌破MA20止损'")
    include_stock_context: bool = Field(default=True, description="是否包含股票市场上下文")


class StrategyRule(BaseModel):
    rule: str
    type: str = Field(default="entry", description="entry/exit/risk/stop_loss/take_profit")


class NLGenerateResponse(BaseModel):
    strategy_name: str
    rules: List[StrategyRule]
    indicators: List[str]
    risk_notes: str
    raw_json: Optional[str] = None


class AutocompleteRequest(BaseModel):
    partial: str = Field(..., description="用户输入的部分策略描述")
    cursor: int = Field(default=0, description="光标位置")


class AutocompleteSuggestion(BaseModel):
    text: str
    type: str = Field(default="keyword", description="keyword/indicator/operator/value")
    score: float = 1.0


class AutocompleteResponse(BaseModel):
    suggestions: List[AutocompleteSuggestion]
    completed_text: Optional[str] = None


# ============== Strategy Autocomplete Knowledge Base ==============

STRATEGY_KEYWORDS = [
    "买入", "卖出", "止损", "止盈", "建仓", "平仓", "加仓", "减仓", "持仓", "空仓",
    "金叉", "死叉", "突破", "跌破", "站上", "回踩",
    "MACD", "KDJ", "RSI", "MA", "EMA", "BOLL", "WR", "CCI", "DMI", "ATR", "OBV",
    "5日", "10日", "20日", "30日", "60日", "120日", "250日",
    "PE", "PB", "ROE", "市值", "换手率", "成交量", "涨跌幅",
    "多头", "空头", "震荡", "趋势", "波段", "日内", "隔夜",
    "追涨", "杀跌", "抄底", "逃顶", "价值投资", "成长股", "蓝筹股", "题材股",
]

INDICATOR_TEMPLATES = [
    ("MACD金叉", "entry", "当MACD的DIF线上穿DEA线时买入"),
    ("MACD死叉", "exit", "当MACD的DIF线下穿DEA线时卖出"),
    ("KDJ金叉", "entry", "当KDJ的K线上穿D线时买入"),
    ("KDJ死叉", "exit", "当KDJ的K线下穿D线时卖出"),
    ("RSI超卖", "entry", "当RSI低于30时买入"),
    ("RSI超买", "exit", "当RSI高于70时卖出"),
    ("MA金叉", "entry", "当短期均线上穿长期均线时买入"),
    ("MA死叉", "exit", "当短期均线下穿长期均线时卖出"),
    ("突破BOLL上轨", "entry", "当价格突破BOLL上轨时买入"),
    ("跌破BOLL下轨", "exit", "当价格跌破BOLL下轨时卖出"),
    ("站上20日线", "entry", "当收盘价站上20日均线时买入"),
    ("跌破20日线", "exit", "当收盘价跌破20日均线时止损"),
    ("站上60日线", "entry", "当收盘价站上60日均线时买入"),
    ("跌破60日线", "exit", "当收盘价跌破60日均线时止损"),
    ("放量突破", "entry", "当成交量放大并突破关键价位时买入"),
    ("缩量整理", "holding", "在整理阶段持有，等待方向明确"),
]

RISK_TEMPLATES = [
    "严格止损，建议止损位设置在入场价下方3%-5%",
    "控制仓位，单只股票仓位不超过总资产的20%",
    "分散投资，避免单吊一只股票",
    "趋势破坏时果断离场，不抄底不预测底部",
    "设置合理的盈亏比，止盈止损比例至少2:1",
    "避免在市场剧烈波动时追涨杀跌",
    "定期复盘策略表现，及时优化参数",
]


def _build_autocomplete(partial: str) -> AutocompleteResponse:
    """Simple rule-based autocomplete for strategy partial input."""
    p = partial.strip()
    if not p:
        return AutocompleteResponse(suggestions=[])

    suggestions: List[AutocompleteSuggestion] = []
    p_lower = p.lower()

    # Match keywords
    for kw in STRATEGY_KEYWORDS:
        if kw in p:
            continue
        # Prefix match
        if kw.startswith(p) or (len(p) >= 2 and kw.startswith(p_lower)):
            suggestions.append(AutocompleteSuggestion(
                text=kw, type="keyword", score=0.9
            ))

    # Match indicator templates
    for tmpl, rtype, rule_text in INDICATOR_TEMPLATES:
        if tmpl in p:
            continue
        if tmpl.startswith(p) or (len(p) >= 2 and tmpl.startswith(p_lower)):
            suggestions.append(AutocompleteSuggestion(
                text=tmpl, type="indicator", score=0.85
            ))

    # Sort by score, deduplicate
    seen = set()
    unique: List[AutocompleteSuggestion] = []
    for s in sorted(suggestions, key=lambda x: -x.score):
        if s.text not in seen:
            seen.add(s.text)
            unique.append(s)

    return AutocompleteResponse(suggestions=unique[:10])


# ============== Routes ==============

@router.post("/nl-generate", response_model=NLGenerateResponse)
def nl_generate_strategy(
    req: NLGenerateRequest,
    model_name: str = "minimax",
    db: Session = Depends(get_db)
):
    """
    Generate a structured trading strategy from natural language description.
    Uses AI to parse the description and return structured rules, indicators, and risk notes.
    """
    stock_data: List[Dict[str, Any]] = []
    if req.include_stock_context:
        all_stocks = get_stock_list()
        symbols = [s["symbol"] for s in all_stocks[:100]]
        quotes = get_realtime_quotes(symbols)
        stock_data = [
            {
                "symbol": q.get("symbol", ""),
                "name": q.get("name", ""),
                "price": q.get("price", 0),
                "change_pct": q.get("change_pct", 0),
                "pe": q.get("pe"),
                "pb": q.get("pb"),
                "market_cap": q.get("market_cap"),
            }
            for q in quotes
            if q.get("price", 0) > 0
        ]

    ai_service = get_ai_service(model_name=model_name, db=db)
    raw = ai_service.generate_strategy(req.description, stock_data)

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        parsed = {
            "strategy_name": "策略",
            "rules": [],
            "indicators": [],
            "risk_notes": f"AI解析失败: {raw[:200]}"
        }

    # Normalize rules
    rules: List[StrategyRule] = []
    raw_rules = parsed.get("rules", [])
    if isinstance(raw_rules, list):
        for r in raw_rules:
            if isinstance(r, str):
                rules.append(StrategyRule(rule=r, type="entry"))
            elif isinstance(r, dict):
                rules.append(StrategyRule(
                    rule=r.get("rule", str(r)),
                    type=r.get("type", "entry")
                ))

    # Normalize indicators
    indicators: List[str] = parsed.get("indicators", [])
    if isinstance(indicators, list):
        indicators = [str(i) for i in indicators]

    return NLGenerateResponse(
        strategy_name=parsed.get("strategy_name", "未命名策略"),
        rules=rules,
        indicators=indicators,
        risk_notes=parsed.get("risk_notes", ""),
        raw_json=raw if raw != parsed else None,
    )


@router.post("/autocomplete", response_model=AutocompleteResponse)
def autocomplete_strategy(
    req: AutocompleteRequest,
    db: Session = Depends(get_db)
):
    """
    Provide autocomplete suggestions for strategy partial input.
    Uses a rule-based approach with strategy keywords and indicator templates.
    """
    # For very short input, return common starting points
    p = req.partial.strip()
    if len(p) < 1:
        return AutocompleteResponse(suggestions=[])

    return _build_autocomplete(p)
