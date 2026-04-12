"""Market data service using AkShare for Chinese stock data."""
import json
import time
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
from functools import lru_cache
from sqlalchemy.orm import Session
from database import SessionLocal
from models import StockCache


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _get_cache(db: Session, symbol: str, data_type: str) -> Optional[Dict]:
    """Get data from cache if fresh (< 5 min)."""
    cache = db.query(StockCache).filter(
        StockCache.symbol == symbol,
        StockCache.data_type == data_type
    ).first()
    if cache:
        age = (datetime.now() - cache.updated_at).total_seconds()
        if age < 300:  # 5分钟内有效
            return cache.data
    return None


def _set_cache(db: Session, symbol: str, name: str, data_type: str, data: Dict):
    """Cache market data."""
    cache = db.query(StockCache).filter(
        StockCache.symbol == symbol,
        StockCache.data_type == data_type
    ).first()
    if cache:
        cache.data = data
        cache.name = name
        cache.updated_at = datetime.now()
    else:
        db.add(StockCache(symbol=symbol, name=name, data_type=data_type, data=data))
    db.commit()


def get_akshare():
    """Lazy-load akshare to avoid import errors."""
    try:
        import akshare as ak
        return ak
    except ImportError:
        return None


@lru_cache(maxsize=1)
def get_stock_list() -> List[Dict]:
    """Get list of all A-share stocks."""
    db = next(get_db())
    try:
        cached = _get_cache(db, "__all_stocks__", "list")
        if cached:
            return cached
    except Exception:
        pass

    ak = get_akshare()
    if not ak:
        return _get_mock_stock_list()

    try:
        df = ak.stock_info_a_code_name()
        stocks = []
        for _, row in df.iterrows():
            code = str(row.get("code", "")).zfill(6)
            # Only include main board stocks (exclude ETFs, indexes, etc.)
            if code.startswith(("0", "3", "6")):
                stocks.append({
                    "symbol": code,
                    "name": row.get("name", ""),
                    "exchange": "SH" if code.startswith(("0", "6")) else "SZ"
                })
        result = stocks[:5000]  # Limit for MVP
        _set_cache(db, "__all_stocks__", "全部股票", "list", result)
        return result
    except Exception as e:
        print(f"[AkShare] stock_list error: {e}")
        return _get_mock_stock_list()
    finally:
        db.close()


def _get_mock_stock_list() -> List[Dict]:
    """Mock stock list for when AkShare is unavailable."""
    return [
        {"symbol": "000001", "name": "平安银行", "exchange": "SZ"},
        {"symbol": "000002", "name": "万科A", "exchange": "SZ"},
        {"symbol": "000004", "name": "国华网安", "exchange": "SZ"},
        {"symbol": "000005", "name": "ST星源", "exchange": "SZ"},
        {"symbol": "000006", "name": "深振业A", "exchange": "SZ"},
        {"symbol": "000007", "name": "全新好", "exchange": "SZ"},
        {"symbol": "000008", "name": "神州高铁", "exchange": "SZ"},
        {"symbol": "000009", "name": "中国宝安", "exchange": "SZ"},
        {"symbol": "000010", "name": "美丽生态", "exchange": "SZ"},
        {"symbol": "600000", "name": "浦发银行", "exchange": "SH"},
        {"symbol": "600001", "name": "邯郸钢铁", "exchange": "SH"},
        {"symbol": "600004", "name": "白云机场", "exchange": "SH"},
        {"symbol": "600006", "name": "东风汽车", "exchange": "SH"},
        {"symbol": "600007", "name": "中国国贸", "exchange": "SH"},
        {"symbol": "600008", "name": "首创股份", "exchange": "SH"},
        {"symbol": "600009", "name": "上海机场", "exchange": "SH"},
        {"symbol": "600010", "name": "包钢股份", "exchange": "SH"},
        {"symbol": "600011", "name": "华能国际", "exchange": "SH"},
        {"symbol": "600012", "name": "皖通高速", "exchange": "SH"},
        {"symbol": "600015", "name": "华夏银行", "exchange": "SH"},
        {"symbol": "600016", "name": "民生银行", "exchange": "SH"},
        {"symbol": "600018", "name": "上港集团", "exchange": "SH"},
        {"symbol": "600019", "name": "宝钢股份", "exchange": "SH"},
        {"symbol": "600028", "name": "中国石化", "exchange": "SH"},
        {"symbol": "600030", "name": "中信证券", "exchange": "SH"},
        {"symbol": "600031", "name": "三一重工", "exchange": "SH"},
        {"symbol": "600036", "name": "招商银行", "exchange": "SH"},
        {"symbol": "600048", "name": "保利发展", "exchange": "SH"},
        {"symbol": "600050", "name": "中国联通", "exchange": "SH"},
        {"symbol": "600104", "name": "上汽集团", "exchange": "SH"},
        {"symbol": "600519", "name": "贵州茅台", "exchange": "SH"},
        {"symbol": "601012", "name": "隆基绿能", "exchange": "SH"},
        {"symbol": "601088", "name": "中国神华", "exchange": "SH"},
        {"symbol": "601166", "name": "兴业银行", "exchange": "SH"},
        {"symbol": "601288", "name": "农业银行", "exchange": "SH"},
        {"symbol": "601318", "name": "中国平安", "exchange": "SH"},
        {"symbol": "601398", "name": "工商银行", "exchange": "SH"},
        {"symbol": "601628", "name": "中国人寿", "exchange": "SH"},
        {"symbol": "601857", "name": "中国石油", "exchange": "SH"},
        {"symbol": "601888", "name": "中国中免", "exchange": "SH"},
        {"symbol": "601939", "name": "建设银行", "exchange": "SH"},
        {"symbol": "601989", "name": "中国重工", "exchange": "SH"},
        {"symbol": "603259", "name": "药明康德", "exchange": "SH"},
        {"symbol": "603288", "name": "海天味业", "exchange": "SH"},
        {"symbol": "603501", "name": "韦尔股份", "exchange": "SH"},
        {"symbol": "688041", "name": "寒武纪", "exchange": "SH"},
        {"symbol": "688981", "name": "中芯国际", "exchange": "SH"},
    ]


def get_realtime_quotes(symbols: List[str]) -> List[Dict]:
    """Get real-time quotes for given stock symbols."""
    db = next(get_db())
    result = []

    try:
        ak = get_akshare()
        if not ak:
            return [_make_mock_quote(s, db) for s in symbols]

        try:
            df = ak.stock_zh_a_spot_em()
            for sym in symbols:
                row = df[df["代码"] == sym]
                if not row.empty:
                    r = row.iloc[0]
                    quote = {
                        "symbol": str(r["代码"]),
                        "name": str(r["名称"]),
                        "price": float(r["最新价"]) if r["最新价"] not in ["--", None, ""] else 0,
                        "change_pct": float(r["涨跌幅"]) if r["涨跌幅"] not in ["--", None, ""] else 0,
                        "volume": float(r["成交量"]) if r["成交量"] not in ["--", None, ""] else 0,
                        "pe": float(r["市盈率-动态"]) if r["市盈率-动态"] not in ["--", None, "", 0] else None,
                        "pb": float(r["市净率"]) if r["市净率"] not in ["--", None, "", 0] else None,
                        "market_cap": float(r["总市值"]) / 1e8 if r["总市值"] not in ["--", None, ""] else None,
                    }
                    _set_cache(db, sym, quote["name"], "realtime", quote)
                    result.append(quote)
                else:
                    result.append(_make_mock_quote(sym, db))
        except Exception as e:
            print(f"[AkShare] realtime_quotes error: {e}")
            for sym in symbols:
                result.append(_make_mock_quote(sym, db))
    finally:
        db.close()

    return result


def _make_mock_quote(symbol: str, db: Session) -> Dict:
    """Generate a mock quote when real data unavailable."""
    import random
    name_map = {s["symbol"]: s["name"] for s in _get_mock_stock_list()}
    name = name_map.get(symbol, symbol)
    base_prices = {
        "600519": 1700.0, "601318": 45.0, "600036": 35.0, "000001": 12.0,
        "000002": 8.0, "600000": 8.0, "600016": 4.0, "601012": 25.0,
    }
    base = base_prices.get(symbol, random.uniform(5, 100))
    change = random.uniform(-5, 5)
    return {
        "symbol": symbol,
        "name": name,
        "price": round(base, 2),
        "change_pct": round(change, 2),
        "volume": random.randint(1_000_000, 100_000_000),
        "pe": round(random.uniform(5, 50), 2),
        "pb": round(random.uniform(0.5, 5), 2),
        "market_cap": round(random.uniform(100, 10000), 2),
    }


def get_kline_data(symbol: str, period: str = "daily", start_date: str = "", end_date: str = "") -> List[Dict]:
    """Get historical K-line data for a stock."""
    db = next(get_db())
    cache_key = f"{symbol}_{period}"
    try:
        cached = _get_cache(db, cache_key, "kline")
        if cached:
            return cached
    except Exception:
        pass

    ak = get_akshare()
    result = []

    if not ak:
        result = _get_mock_kline(symbol)
    else:
        try:
            if start_date and end_date:
                df = ak.stock_zh_a_hist(
                    symbol=symbol, period=period,
                    start_date=start_date.replace("-", ""),
                    end_date=end_date.replace("-", ""),
                    adjust="qfq"
                )
            else:
                df = ak.stock_zh_a_hist(symbol=symbol, period=period, adjust="qfq")
            for _, row in df.iterrows():
                result.append({
                    "date": str(row.get("日期", "")),
                    "open": float(row.get("开盘", 0)),
                    "high": float(row.get("最高", 0)),
                    "low": float(row.get("最低", 0)),
                    "close": float(row.get("收盘", 0)),
                    "volume": float(row.get("成交量", 0)),
                    "turnover": float(row.get("成交额", 0)) if "成交额" in row else 0,
                })
        except Exception as e:
            print(f"[AkShare] kline error for {symbol}: {e}")
            result = _get_mock_kline(symbol)

    _set_cache(db, cache_key, symbol, "kline", result)
    db.close()
    return result


def _get_mock_kline(symbol: str, days: int = 120) -> List[Dict]:
    """Generate mock K-line data."""
    import random
    base_prices = {
        "600519": 1700.0, "601318": 45.0, "600036": 35.0, "000001": 12.0,
        "000002": 8.0, "600000": 8.0, "600016": 4.0, "601012": 25.0,
    }
    base = base_prices.get(symbol, 20.0)
    data = []
    price = base
    for i in range(days):
        date = (datetime.now() - timedelta(days=days-i)).strftime("%Y-%m-%d")
        change = random.uniform(-0.03, 0.03)
        price = max(price * (1 + change), 1)
        high = price * (1 + random.uniform(0, 0.02))
        low = price * (1 - random.uniform(0, 0.02))
        data.append({
            "date": date,
            "open": round(price * (1 + random.uniform(-0.01, 0.01)), 2),
            "high": round(high, 2),
            "low": round(low, 2),
            "close": round(price, 2),
            "volume": random.randint(5_000_000, 50_000_000),
            "turnover": random.randint(500_000_000, 5_000_000_000),
        })
    return data


def calculate_technicals(kline_data: List[Dict]) -> Dict[str, Any]:
    """Calculate technical indicators from K-line data."""
    if not kline_data or len(kline_data) < 5:
        return {}

    closes = [d["close"] for d in kline_data]
    highs = [d["high"] for d in kline_data]
    lows = [d["low"] for d in kline_data]
    volumes = [d["volume"] for d in kline_data]

    result = {}

    # MA
    for period in [5, 10, 20, 60]:
        if len(closes) >= period:
            ma = sum(closes[-period:]) / period
            result[f"MA{period}"] = round(ma, 2)

    # RSI
    if len(closes) >= 14:
        deltas = [closes[i] - closes[i-1] for i in range(1, len(closes))]
        gains = [d for d in deltas[-14:] if d > 0]
        losses = [-d for d in deltas[-14:] if d < 0]
        avg_gain = sum(gains) / 14 if gains else 0
        avg_loss = sum(losses) / 14 if losses else 0
        rs = avg_gain / avg_loss if avg_loss else 0
        result["RSI"] = round(100 - (100 / (1 + rs)), 2) if rs else 50

    # MACD
    if len(closes) >= 26:
        ema12 = _ema(closes, 12)
        ema26 = _ema(closes, 26)
        macd = ema12 - ema26
        signal = _ema([macd] * 9, 9) if len(closes) >= 34 else macd * 0.9
        result["MACD"] = round(macd, 2)
        result["MACD_SIGNAL"] = round(signal, 2)
        result["MACD_HIST"] = round(macd - signal, 2)

    # KDJ
    if len(closes) >= 9:
        k, d = 50, 50
        for idx in range(len(closes) - 9, len(closes)):
            window_lows = lows[max(0, idx - 8):idx + 1]
            window_highs = highs[max(0, idx - 8):idx + 1]
            rsv = (closes[idx] - min(window_lows)) / (max(window_highs) - min(window_lows) + 0.001) * 100
            k = k * 2/3 + rsv * 1/3
            d = d * 2/3 + k * 1/3
        result["KDJ_K"] = round(k, 2)
        result["KDJ_D"] = round(d, 2)
        result["KDJ_J"] = round(3*k - 2*d, 2)

    # BOLL
    if len(closes) >= 20:
        ma20 = sum(closes[-20:]) / 20
        variance = sum((c - ma20)**2 for c in closes[-20:]) / 20
        std = variance ** 0.5
        result["BOLL_MID"] = round(ma20, 2)
        result["BOLL_UPPER"] = round(ma20 + 2*std, 2)
        result["BOLL_LOWER"] = round(ma20 - 2*std, 2)

    return result


def _ema(data: List[float], period: int) -> float:
    """Calculate exponential moving average."""
    if len(data) < period:
        return sum(data) / len(data)
    multiplier = 2 / (period + 1)
    ema = sum(data[:period]) / period
    for price in data[period:]:
        ema = (price - ema) * multiplier + ema
    return ema


def search_stocks(keyword: str) -> List[Dict]:
    """Search stocks by name or code."""
    all_stocks = get_stock_list()
    kw = keyword.lower()
    results = [s for s in all_stocks if kw in s["symbol"] or kw in s["name"].lower()]
    return results[:50]
