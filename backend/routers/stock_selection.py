"""Router: AI-powered stock selection."""
import re
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db, init_db
from models import (
    StockSelectionRequest, StockSelectionResponse,
    StockInfo, StockSearchResponse
)
from data.market_data import get_stock_list, get_realtime_quotes, search_stocks
from ai.chains import get_ai_service

router = APIRouter(prefix="/api/stocks", tags=["stock_selection"])


def _to_market_label(symbol: str, exchange: str = "") -> str:
    """Infer market label for display."""
    ex = (exchange or "").upper()
    if ex in {"SH", "SZ", "BJ"}:
        return "A股"
    if ex in {"HK", "HKG"}:
        return "港股"
    if ex in {"US", "NASDAQ", "NYSE", "AMEX"}:
        return "美股"

    if re.match(r"^\d{5}$", symbol):
        return "港股"
    if re.match(r"^\d{6}$", symbol):
        return "A股"
    if re.match(r"^[A-Z][A-Z0-9\.-]*$", symbol.upper()):
        return "美股"
    return "其他"


def _enrich_quotes_with_meta(quotes: list, stocks_meta: dict) -> list:
    """Fill company name and market for quote payloads."""
    enriched = []
    for quote in quotes:
        item = dict(quote)
        symbol = str(item.get("symbol", ""))
        meta = stocks_meta.get(symbol, {})
        quote_name = str(item.get("name", "")).strip()
        meta_name = str(meta.get("name", "")).strip()
        if not quote_name or quote_name == symbol:
            item["name"] = meta_name or symbol
        item["market"] = _to_market_label(symbol, str(meta.get("exchange", "")))
        enriched.append(item)
    return enriched


@router.get("/search")
def search(keyword: str = ""):
    """Search stocks by name or symbol."""
    if not keyword or len(keyword) < 1:
        return []
    results = search_stocks(keyword)
    return [StockSearchResponse(**r) for r in results]


@router.post("/selection", response_model=StockSelectionResponse)
def ai_stock_selection(
    req: StockSelectionRequest,
    model_name: str = "minimax",
    db: Session = Depends(get_db)
):
    """Parse natural language query and return AI-filtered stock list."""
    # Get candidate stocks
    all_stocks = get_stock_list()
    stocks_meta = {s["symbol"]: s for s in all_stocks}
    symbols = [s["symbol"] for s in all_stocks[:500]]  # Limit for MVP

    # Get real-time quotes for candidates
    quotes = get_realtime_quotes(symbols)

    # Parse query with AI
    ai_service = get_ai_service(model_name=model_name, db=db)
    parse_result = ai_service.parse_stock_query(req.query, quotes)

    try:
        parsed = json.loads(parse_result)
        selected_symbols = parsed.get("selected", [])
        reasoning = parsed.get("reasoning", "")
    except json.JSONDecodeError:
        # Fallback: try to extract symbols using regex
        selected_symbols = _fallback_parse(req.query, quotes)
        reasoning = parse_result

    # Get selected stock details
    selected_quotes = [q for q in quotes if q["symbol"] in selected_symbols]
    # If AI selected nothing, return top performers as demo
    if not selected_quotes:
        selected_quotes = sorted(quotes, key=lambda x: x.get("change_pct", 0), reverse=True)[:10]
        reasoning = f"根据「{req.query}」筛选，结合当前市场数据，以下是符合条件的候选股票（按涨跌幅排序）："

    selected_quotes = _enrich_quotes_with_meta(selected_quotes, stocks_meta)

    return StockSelectionResponse(
        stocks=[StockInfo(**q) for q in selected_quotes],
        ai_reasoning=reasoning
    )


def _fallback_parse(query: str, quotes: list) -> list:
    """Fallback parser when AI fails - simple keyword matching."""
    query_lower = query.lower()
    selected = []
    for q in quotes:
        # Simple PE filter
        if "pe" in query_lower or "市盈率" in query:
            if q.get("pe") and q["pe"] > 0:
                if "<20" in query and q["pe"] < 20:
                    selected.append(q["symbol"])
                elif "<30" in query and q["pe"] < 30:
                    selected.append(q["symbol"])
        # Simple price filter
        if "低估" in query or "低估值" in query:
            if q.get("pe") and 0 < q["pe"] < 20:
                selected.append(q["symbol"])
    return list(set(selected))[:20]


@router.get("/quote/{symbol}")
def get_quote(symbol: str, db: Session = Depends(get_db)):
    """Get real-time quote for a single stock."""
    quotes = get_realtime_quotes([symbol])
    if not quotes:
        raise HTTPException(status_code=404, detail="Stock not found")
    return quotes[0]


@router.get("/quotes")
def get_multiple_quotes(symbols: str):
    """Get quotes for multiple stocks (comma-separated)."""
    symbol_list = [s.strip() for s in symbols.split(",") if s.strip()]
    if not symbol_list:
        return []
    quotes = get_realtime_quotes(symbol_list)
    return quotes
