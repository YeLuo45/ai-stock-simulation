"""Router: AI-powered technical analysis."""
import json
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from models import TechnicalAnalysisRequest, TechnicalAnalysisResponse
from data.market_data import get_realtime_quotes, get_kline_data, calculate_technicals
from ai.chains import get_ai_service

router = APIRouter(prefix="/api/analysis", tags=["analysis"])


@router.post("/technical", response_model=TechnicalAnalysisResponse)
def technical_analysis(
    req: TechnicalAnalysisRequest,
    model_name: str = "minimax",
    db: Session = Depends(get_db)
):
    """Perform AI-powered technical analysis on a stock."""
    # Get quote
    quotes = get_realtime_quotes([req.symbol])
    if not quotes:
        raise ValueError(f"无法获取 {req.symbol} 的行情数据")
    quote = quotes[0]

    # Get K-line data
    klines = get_kline_data(req.symbol, "daily")
    if not klines:
        raise ValueError(f"无法获取 {req.symbol} 的K线数据")

    # Calculate technical indicators
    indicators = calculate_technicals(klines)

    # Get recent K-line summary for AI
    recent_klines = klines[-30:] if len(klines) >= 30 else klines
    data_for_ai = {
        "symbol": req.symbol,
        "name": quote.get("name", req.symbol),
        "current_price": quote.get("price", 0),
        "change_pct": quote.get("change_pct", 0),
        "indicators": indicators,
        "recent_klines": [
            {"date": k["date"], "close": k["close"], "volume": k["volume"]}
            for k in recent_klines
        ]
    }

    # AI analysis
    ai_service = get_ai_service(model_name=model_name, db=db)
    analysis = ai_service.analyze_technicals(req.symbol, data_for_ai)

    try:
        ai_result = json.loads(analysis)
    except json.JSONDecodeError:
        ai_result = {
            "summary": analysis[:200],
            "trend": "震荡",
            "signals": ["数据解析异常"],
            "support": quote.get("price", 0) * 0.95,
            "resistance": quote.get("price", 0) * 1.05,
            "risk_level": "中"
        }

    return TechnicalAnalysisResponse(
        symbol=req.symbol,
        name=quote.get("name", req.symbol),
        current_price=quote.get("price", 0),
        indicators=indicators,
        ai_summary=ai_result.get("summary", ""),
        support_resistance={
            "support": ai_result.get("support", quote.get("price", 0) * 0.95),
            "resistance": ai_result.get("resistance", quote.get("price", 0) * 1.05)
        }
    )


@router.get("/indicators/{symbol}")
def get_indicators(symbol: str, db: Session = Depends(get_db)):
    """Get calculated technical indicators for a stock."""
    klines = get_kline_data(symbol, "daily")
    if not klines:
        return {"error": "无法获取K线数据"}
    indicators = calculate_technicals(klines)
    quote = get_realtime_quotes([symbol])
    return {
        "symbol": symbol,
        "name": quote[0].get("name", symbol) if quote else symbol,
        "current_price": quote[0].get("price", 0) if quote else 0,
        "indicators": indicators
    }
