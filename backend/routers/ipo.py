"""
Router: IPO / 次新股价值评估
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from models import IPOEvaluationRequest, IPOEvaluationResponse, FundamentalData, TechnicalData
from services.ipo_evaluator import evaluate_ipo

router = APIRouter(prefix="/api/ipo", tags=["ipo"])


def _build_ipo_response(result: dict) -> IPOEvaluationResponse:
    fund_data = result.get("fundamental", {})
    tech_data = result.get("technical", {})

    fundamental = FundamentalData(
        pe=fund_data.get("pe"),
        pb=fund_data.get("pb"),
        roe=fund_data.get("roe"),
        gross_margin=fund_data.get("gross_margin"),
        revenue_growth=fund_data.get("revenue_growth"),
        net_profit_growth=fund_data.get("net_profit_growth"),
        issue_price=fund_data.get("issue_price"),
        circulating_shares=fund_data.get("circulating_shares"),
        market_cap=fund_data.get("market_cap"),
        listing_date=fund_data.get("listing_date"),
        days_since_listing=fund_data.get("days_since_listing"),
    )

    technical = TechnicalData(
        trend=tech_data.get("trend", "震荡"),
        rsi=tech_data.get("rsi"),
        macd_signal=tech_data.get("macd_signal"),
        macd_value=tech_data.get("macd_value"),
        support_level=tech_data.get("support_level"),
        resistance_level=tech_data.get("resistance_level"),
        ma5=tech_data.get("ma5"),
        ma10=tech_data.get("ma10"),
        ma20=tech_data.get("ma20"),
        current_price=tech_data.get("current_price"),
        change_pct=tech_data.get("change_pct"),
    )

    return IPOEvaluationResponse(
        stock_code=result["stock_code"],
        stock_name=result["stock_name"],
        score=result["score"],
        recommendation=result["recommendation"],
        fundamental=fundamental,
        technical=technical,
        analysis=result["analysis"],
        data_sources=result.get("data_sources", []),
        requested_model=result.get("requested_model", "minimax"),
        actual_model=result.get("actual_model", result.get("requested_model", "minimax")),
        fallback_used=result.get("fallback_used", False),
        fallback_reason=result.get("fallback_reason"),
        evaluated_at=result.get("evaluated_at", ""),
    )


def _usage_payload(model_name: str) -> dict:
    return {
        "status": "ok",
        "message": "请通过 stock_code 传入股票代码后再评估；支持 GET 查询参数或 POST JSON 请求体。",
        "model_name": model_name,
        "example_get": f"/api/ipo/evaluate?stock_code=688001&model_name={model_name}",
        "example_post": {
            "url": f"/api/ipo/evaluate?model_name={model_name}",
            "json_body": {"stock_code": "688001"},
        },
    }


@router.get("/evaluate")
def evaluate_ipo_get_endpoint(
    stock_code: str | None = Query(default=None, description="股票代码，如 688001"),
    model_name: str = "minimax",
    db: Session = Depends(get_db),
):
    """兼容浏览器直接访问；未传股票代码时返回调用说明。"""
    if not stock_code or not stock_code.strip():
        return _usage_payload(model_name)

    try:
        result = evaluate_ipo(stock_code, model_name=model_name, db=db)
        return _build_ipo_response(result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"IPO评估失败: {str(e)}")


@router.post("/evaluate", response_model=IPOEvaluationResponse)
def evaluate_ipo_endpoint(
    req: IPOEvaluationRequest,
    model_name: str = "minimax",
    db: Session = Depends(get_db),
):
    """
    评估新股/次新股价值
    - 基本面：PE、PB、ROE、毛利率、营收增长、净利润增长
    - 技术面：趋势、RSI、MACD、均线、支撑压力位
    - 综合评分：0-100，推荐建议
    """
    try:
        result = evaluate_ipo(req.stock_code, model_name=model_name, db=db)
        return _build_ipo_response(result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"IPO评估失败: {str(e)}")
