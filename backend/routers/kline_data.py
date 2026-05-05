"""Router: Real K-line data from AkShare with SQLite cache."""
from datetime import datetime
from typing import List, Dict, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from kline_cache import (
    get_kline_with_cache,
    fetch_from_akshare,
    fetch_index_from_akshare,
    get_cached_klines,
    get_latest_cached_date,
    get_available_symbols,
    cache_klines,
    clear_cache,
)

router = APIRouter(prefix="/api/kline", tags=["kline"])


# Pydantic models
class KLineResponse(BaseModel):
    symbol: str
    period: str
    data: List[Dict]
    count: int
    from_cache: bool
    latest_date: Optional[str] = None


class IndexKLineResponse(BaseModel):
    symbol: str
    name: str
    period: str
    data: List[Dict]
    count: int


class AvailableResponse(BaseModel):
    symbols: List[str]
    count: int


class RefreshRequest(BaseModel):
    symbol: str
    period: str = "daily"
    force: bool = False  # If True, ignore cache and fetch fresh


class RefreshResponse(BaseModel):
    symbol: str
    period: str
    records: int
    latest_date: Optional[str]
    message: str


# Index name mapping
INDEX_NAMES = {
    "000001": "上证指数",
    "399001": "深证成指",
    "399006": "创业板指",
    "000688": "科创50",
}


@router.get("/{symbol}", response_model=KLineResponse)
def get_kline(
    symbol: str,
    period: str = Query("daily", description="daily or weekly"),
    start_date: str = Query("", description="YYYY-MM-DD, default 2 years ago"),
    end_date: str = Query("", description="YYYY-MM-DD, default today"),
    use_cache: bool = Query(True, description="Whether to use cache"),
):
    """
    Get K-line data for a stock symbol.
    Priority: cache -> AkShare
    """
    # Normalize period
    if period not in ("daily", "weekly"):
        period = "daily"

    data, from_cache = get_kline_with_cache(
        symbol=symbol,
        period=period,
        start_date=start_date,
        end_date=end_date,
        use_cache=use_cache,
    )

    latest_date = get_latest_cached_date(symbol, period)

    return KLineResponse(
        symbol=symbol,
        period=period,
        data=data,
        count=len(data),
        from_cache=from_cache,
        latest_date=latest_date,
    )


@router.get("/index/{symbol}", response_model=IndexKLineResponse)
def get_index_kline(
    symbol: str,
    period: str = Query("daily", description="daily or weekly"),
    start_date: str = Query("", description="YYYY-MM-DD"),
    end_date: str = Query("", description="YYYY-MM-DD"),
):
    """
    Get K-line data for an index (上证指数/深证成指/创业板指/科创50).
    """
    if period not in ("daily", "weekly"):
        period = "daily"

    if symbol not in INDEX_NAMES and symbol not in ("000001", "399001", "399006", "000688"):
        raise HTTPException(status_code=400, detail=f"Unsupported index symbol: {symbol}")

    name = INDEX_NAMES.get(symbol, symbol)

    # Check if we have cached data
    cached = get_cached_klines(f"idx_{symbol}", period)
    if cached and start_date:
        cached = [k for k in cached if k["date"] >= start_date]
    if cached and end_date:
        cached = [k for k in cached if k["date"] <= end_date]

    if cached:
        return IndexKLineResponse(
            symbol=symbol,
            name=name,
            period=period,
            data=cached,
            count=len(cached),
        )

    # Fetch from AkShare
    fetched = fetch_index_from_akshare(symbol, period)
    if fetched:
        # Cache with prefix
        cache_klines(f"idx_{symbol}", period, fetched)
        if start_date:
            fetched = [k for k in fetched if k["date"] >= start_date]
        if end_date:
            fetched = [k for k in fetched if k["date"] <= end_date]
        return IndexKLineResponse(
            symbol=symbol,
            name=name,
            period=period,
            data=fetched,
            count=len(fetched),
        )

    return IndexKLineResponse(
        symbol=symbol,
        name=name,
        period=period,
        data=[],
        count=0,
    )


@router.post("/refresh", response_model=RefreshResponse)
def refresh_kline(req: RefreshRequest):
    """
    Manually refresh K-line data for a symbol.
    Force refresh ignores existing cache.
    """
    symbol = req.symbol
    period = req.period if req.period in ("daily", "weekly") else "daily"

    if req.force:
        clear_cache(symbol=symbol)

    # Force fetch from AkShare
    today = datetime.now().strftime("%Y-%m-%d")
    start = (datetime.now().strftime("%Y-%m-%d"))

    # Fetch last 2 years
    from datetime import timedelta
    start_date = (datetime.now() - timedelta(days=730)).strftime("%Y-%m-%d")

    data = fetch_from_akshare(symbol, period, start_date, today)
    if data:
        cache_klines(symbol, period, data)
        latest = data[-1]["date"] if data else None
        return RefreshResponse(
            symbol=symbol,
            period=period,
            records=len(data),
            latest_date=latest,
            message=f"Successfully refreshed {len(data)} records",
        )
    else:
        return RefreshResponse(
            symbol=symbol,
            period=period,
            records=0,
            latest_date=None,
            message="Failed to fetch data from AkShare",
        )


@router.get("/", response_model=AvailableResponse)
def get_available(
    period: str = Query("daily", description="Filter by period"),
):
    """
    Get list of symbols that have cached K-line data.
    """
    if period not in ("daily", "weekly"):
        period = "daily"

    symbols = get_available_symbols()
    # Filter out index symbols (they have idx_ prefix)
    stock_symbols = [s for s in symbols if not s.startswith("idx_")]

    return AvailableResponse(
        symbols=stock_symbols,
        count=len(stock_symbols),
    )


@router.get("/cache/status/{symbol}")
def get_cache_status(symbol: str):
    """Get cache status for a specific symbol."""
    daily_latest = get_latest_cached_date(symbol, "daily")
    weekly_latest = get_latest_cached_date(symbol, "weekly")
    daily_count = len(get_cached_klines(symbol, "daily"))
    weekly_count = len(get_cached_klines(symbol, "weekly"))

    return {
        "symbol": symbol,
        "daily": {
            "count": daily_count,
            "latest_date": daily_latest,
        },
        "weekly": {
            "count": weekly_count,
            "latest_date": weekly_latest,
        },
    }


@router.delete("/cache/{symbol}")
def delete_cache(symbol: str):
    """Clear cache for a specific symbol."""
    clear_cache(symbol=symbol)
    return {"message": f"Cache cleared for {symbol}"}
