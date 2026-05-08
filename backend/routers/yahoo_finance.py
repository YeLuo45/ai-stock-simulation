"""
Router: Yahoo Finance K-line data for US/international stocks.
Supports stocks, indices, ETFs, crypto via Yahoo Finance API.
"""
from datetime import datetime, timedelta
from typing import List, Dict, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

router = APIRouter(prefix="/api/yahoo", tags=["yahoo_finance"])

# Period mapping for Yahoo Finance
PERIOD_MAP = {
    "1d": "1d",
    "5d": "5d",
    "1mo": "1mo",
    "3mo": "3mo",
    "6mo": "6mo",
    "1y": "1y",
    "2y": "2y",
    "5y": "5y",
    "10y": "10y",
    "ytd": "ytd",
    "max": "max",
}

INTERVAL_MAP = {
    "daily": "1d",
    "weekly": "1wk",
    "monthly": "1mo",
    "5m": "5m",
    "15m": "15m",
    "30m": "30m",
    "60m": "60m",
}


class YahooKLineResponse(BaseModel):
    symbol: str
    period: str
    interval: str
    data: List[Dict]
    count: int
    from_cache: bool = False


class YahooSearchResponse(BaseModel):
    query: str
    results: List[Dict]
    count: int


class YahooInfoResponse(BaseModel):
    symbol: str
    name: Optional[str]
    sector: Optional[str]
    industry: Optional[str]
    market_cap: Optional[float]
    pe_ratio: Optional[float]
    dividend_yield: Optional[float]
    w52_high: Optional[float]
    w52_low: Optional[float]
    currency: Optional[str]


def _record_to_dict(row) -> Dict:
    """Convert a yfinance ticker row to dict format."""
    return {
        "date": str(row.get("date", "")),
        "open": float(row.get("open", 0)),
        "high": float(row.get("high", 0)),
        "low": float(row.get("low", 0)),
        "close": float(row.get("close", 0)),
        "volume": float(row.get("volume", 0)),
    }


@router.get("/kline/{symbol}", response_model=YahooKLineResponse)
def get_yahoo_kline(
    symbol: str,
    period: str = Query("1y", description="yfinance period: 1d,5d,1mo,3mo,6mo,1y,2y,5y,10y,ytd,max"),
    interval: str = Query("1d", description="data interval: 1d,1wk,1mo,5m,15m,30m,60m"),
    start_date: str = Query("", description="YYYY-MM-DD, overrides period if set"),
    end_date: str = Query("", description="YYYY-MM-DD, defaults to today"),
):
    """
    Get K-line data from Yahoo Finance for US/international stocks.
    
    Examples:
    - GET /api/yahoo/kline/AAPL?period=1y&interval=1d
    - GET /api/yahoo/kline/MSFT?period=2y&interval=1wk
    - GET /api/yahoo/kline/^GSPC?period=1y&interval=1d (S&P 500 index)
    - GET /api/yahoo/kline/BTC-USD?period=1y&interval=1d (crypto)
    - GET /api/yahoo/kline/SPY?period=1mo&interval=5m (ETF with intraday data)
    """
    try:
        import yfinance as yf
    except ImportError:
        raise HTTPException(status_code=503, detail="yfinance not installed. Install with: pip install yfinance")
    
    if not symbol:
        raise HTTPException(status_code=400, detail="Symbol is required")
    
    symbol = symbol.upper().strip()
    
    # Map interval
    mapped_interval = INTERVAL_MAP.get(interval, interval)
    
    try:
        ticker = yf.Ticker(symbol)
        
        if start_date and end_date:
            df = ticker.history(start=start_date, end=end_date, interval=mapped_interval)
        else:
            df = ticker.history(period=period, interval=mapped_interval)
        
        if df is None or df.empty:
            return YahooKLineResponse(
                symbol=symbol,
                period=period,
                interval=mapped_interval,
                data=[],
                count=0,
                from_cache=False,
            )
        
        records = []
        for idx, row in df.iterrows():
            date_str = idx.strftime("%Y-%m-%d") if hasattr(idx, 'strftime') else str(idx)
            records.append({
                "date": date_str,
                "open": float(row.get("Open", 0) or 0),
                "high": float(row.get("High", 0) or 0),
                "low": float(row.get("Low", 0) or 0),
                "close": float(row.get("Close", 0) or 0),
                "volume": float(row.get("Volume", 0) or 0),
            })
        
        # Sort by date ascending
        records.sort(key=lambda x: x["date"])
        
        return YahooKLineResponse(
            symbol=symbol,
            period=period,
            interval=mapped_interval,
            data=records,
            count=len(records),
            from_cache=False,
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Yahoo Finance error: {str(e)}")


@router.get("/search", response_model=YahooSearchResponse)
def search_yahoo_symbols(
    query: str = Query(..., description="Search query"),
    limit: int = Query(10, description="Max results", ge=1, le=50),
):
    """
    Search for symbols on Yahoo Finance.
    """
    try:
        from yfinance import search
    except ImportError:
        raise HTTPException(status_code=503, detail="yfinance not installed")
    
    if not query:
        raise HTTPException(status_code=400, detail="Query is required")
    
    try:
        results = search(query, limit=limit)
        symbols = []
        for r in results.get("quotes", []):
            symbols.append({
                "symbol": r.get("symbol", ""),
                "name": r.get("longname") or r.get("shortname", ""),
                "exchange": r.get("exchange", ""),
                "type": r.get("quoteType", ""),
            })
        
        return YahooSearchResponse(
            query=query,
            results=symbols,
            count=len(symbols),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search error: {str(e)}")


@router.get("/info/{symbol}", response_model=YahooInfoResponse)
def get_yahoo_info(symbol: str):
    """
    Get stock info from Yahoo Finance.
    """
    try:
        import yfinance as yf
    except ImportError:
        raise HTTPException(status_code=503, detail="yfinance not installed")
    
    symbol = symbol.upper().strip()
    
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info
        
        return YahooInfoResponse(
            symbol=symbol,
            name=info.get("longName") or info.get("shortName"),
            sector=info.get("sector"),
            industry=info.get("industry"),
            market_cap=info.get("marketCap"),
            pe_ratio=info.get("trailingPE"),
            dividend_yield=info.get("dividendYield"),
            w52_high=info.get("fiftyTwoWeekHigh"),
            w52_low=info.get("fiftyTwoWeekLow"),
            currency=info.get("currency"),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Info error: {str(e)}")


@router.get("/realtime/{symbol}")
def get_yahoo_realtime(symbol: str):
    """
    Get realtime quote from Yahoo Finance.
    """
    try:
        import yfinance as yf
    except ImportError:
        raise HTTPException(status_code=503, detail="yfinance not installed")
    
    symbol = symbol.upper().strip()
    
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.fast_info
        
        return {
            "symbol": symbol,
            "name": info.get("long_name") or symbol,
            "price": info.get("last_price") or 0,
            "currency": info.get("currency") or "USD",
            "market_cap": info.get("market_cap") or 0,
            "exchange": info.get("exchange") or "Unknown",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Realtime quote error: {str(e)}")


# US Index aliases for easy access
US_INDICES = {
    "^GSPC": "S&P 500",
    "^DJI": "Dow Jones Industrial Average",
    "^IXIC": "NASDAQ Composite",
    "^VIX": "CBOE Volatility Index",
    "^RUT": "Russell 2000",
}


@router.get("/indices")
def get_us_indices():
    """Get major US indices quotes."""
    try:
        import yfinance as yf
    except ImportError:
        raise HTTPException(status_code=503, detail="yfinance not installed")
    
    results = []
    for sym, name in US_INDICES.items():
        try:
            ticker = yf.Ticker(sym)
            info = ticker.fast_info
            results.append({
                "symbol": sym,
                "name": name,
                "price": info.get("last_price") or 0,
                "currency": info.get("currency") or "USD",
            })
        except:
            results.append({
                "symbol": sym,
                "name": name,
                "price": None,
                "currency": "USD",
            })
    
    return {"indices": results}
