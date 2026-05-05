"""K-line data SQLite cache with incremental update support."""
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import StaticPool
import os
import json

# Use a separate SQLite DB for K-line cache (to avoid schema conflicts)
KLINE_DB_PATH = os.path.join(os.path.dirname(__file__), "kline_cache.db")

kline_engine = create_engine(
    f"sqlite:///{KLINE_DB_PATH}",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    echo=False,
)
KlineSession = sessionmaker(autocommit=False, autoflush=False, bind=kline_engine)
KlineBase = declarative_base()


class KlineCache(KlineBase):
    """K-line data cache table."""
    __tablename__ = "kline_cache"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    symbol = Column(String, index=True, nullable=False)
    date = Column(String, nullable=False)  # "YYYY-MM-DD"
    period = Column(String, nullable=False, default="daily")  # "daily" or "weekly"
    open = Column(Float, default=0.0)
    close = Column(Float, default=0.0)
    high = Column(Float, default=0.0)
    low = Column(Float, default=0.0)
    volume = Column(Float, default=0.0)
    turnover = Column(Float, default=0.0)
    updated_at = Column(DateTime, default=datetime.now)

    __table_args__ = (
        # Unique constraint: one record per symbol + date + period
        {"sqlite_autoincrement": True},
    )


def init_kline_db():
    """Initialize the K-line cache database."""
    KlineBase.metadata.create_all(bind=kline_engine)


def _get_session():
    return KlineSession()


def get_cached_klines(symbol: str, period: str = "daily") -> List[Dict]:
    """Get all cached K-line records for a symbol."""
    session = _get_session()
    try:
        records = session.query(KlineCache).filter(
            KlineCache.symbol == symbol,
            KlineCache.period == period,
        ).order_by(KlineCache.date).all()
        return [_record_to_dict(r) for r in records]
    finally:
        session.close()


def get_latest_cached_date(symbol: str, period: str = "daily") -> Optional[str]:
    """Get the latest date available in cache for a symbol."""
    session = _get_session()
    try:
        record = session.query(KlineCache).filter(
            KlineCache.symbol == symbol,
            KlineCache.period == period,
        ).order_by(KlineCache.date.desc()).first()
        return record.date if record else None
    finally:
        session.close()


def get_earliest_cached_date(symbol: str, period: str = "daily") -> Optional[str]:
    """Get the earliest date available in cache for a symbol."""
    session = _get_session()
    try:
        record = session.query(KlineCache).filter(
            KlineCache.symbol == symbol,
            KlineCache.period == period,
        ).order_by(KlineCache.date.asc()).first()
        return record.date if record else None
    finally:
        session.close()


def _record_to_dict(r: KlineCache) -> Dict:
    return {
        "date": r.date,
        "open": r.open,
        "close": r.close,
        "high": r.high,
        "low": r.low,
        "volume": r.volume,
        "turnover": r.turnover,
    }


def cache_klines(symbol: str, period: str, klines: List[Dict]):
    """Cache K-line records, inserting or replacing existing ones."""
    if not klines:
        return
    session = _get_session()
    try:
        for k in klines:
            existing = session.query(KlineCache).filter(
                KlineCache.symbol == symbol,
                KlineCache.date == k["date"],
                KlineCache.period == period,
            ).first()
            if existing:
                existing.open = k.get("open", 0)
                existing.close = k.get("close", 0)
                existing.high = k.get("high", 0)
                existing.low = k.get("low", 0)
                existing.volume = k.get("volume", 0)
                existing.turnover = k.get("turnover", 0)
                existing.updated_at = datetime.now()
            else:
                session.add(KlineCache(
                    symbol=symbol,
                    date=k["date"],
                    period=period,
                    open=k.get("open", 0),
                    close=k.get("close", 0),
                    high=k.get("high", 0),
                    low=k.get("low", 0),
                    volume=k.get("volume", 0),
                    turnover=k.get("turnover", 0),
                ))
        session.commit()
    finally:
        session.close()


def get_available_symbols() -> List[str]:
    """Get list of symbols that have cached K-line data."""
    session = _get_session()
    try:
        result = session.query(KlineCache.symbol).distinct().all()
        return [r[0] for r in result]
    finally:
        session.close()


def clear_cache(symbol: Optional[str] = None):
    """Clear cache for a specific symbol or all if None."""
    session = _get_session()
    try:
        if symbol:
            session.query(KlineCache).filter(KlineCache.symbol == symbol).delete()
        else:
            session.query(KlineCache).delete()
        session.commit()
    finally:
        session.close()


def fetch_from_akshare(symbol: str, period: str = "daily",
                        start_date: str = "", end_date: str = "") -> List[Dict]:
    """Fetch K-line data from AkShare, returns list of dicts."""
    try:
        import akshare as ak
    except ImportError:
        return []

    try:
        adjust = "qfq"
        period_map = {"daily": "daily", "weekly": "weekly"}
        ak_period = period_map.get(period, "daily")

        if start_date and end_date:
            start_str = start_date.replace("-", "")
            end_str = end_date.replace("-", "")
            df = ak.stock_zh_a_hist(
                symbol=symbol,
                period=ak_period,
                start_date=start_str,
                end_date=end_str,
                adjust=adjust,
            )
        else:
            df = ak.stock_zh_a_hist(symbol=symbol, period=ak_period, adjust=adjust)

        result = []
        for _, row in df.iterrows():
            date_val = row.get("日期", "")
            if isinstance(date_val, str) and len(date_val) == 10:
                pass  # Already "YYYY-MM-DD"
            elif hasattr(date_val, 'strftime'):
                date_val = date_val.strftime("%Y-%m-%d")
            else:
                date_val = str(date_val)
            result.append({
                "date": date_val,
                "open": float(row.get("开盘", 0)),
                "close": float(row.get("收盘", 0)),
                "high": float(row.get("最高", 0)),
                "low": float(row.get("最低", 0)),
                "volume": float(row.get("成交量", 0)),
                "turnover": float(row.get("成交额", 0)) if "成交额" in row else 0,
            })
        return result
    except Exception as e:
        print(f"[AkShare] fetch_kline error for {symbol}: {e}")
        return []


def fetch_index_from_akshare(symbol: str, period: str = "daily") -> List[Dict]:
    """Fetch index K-line data from AkShare."""
    try:
        import akshare as ak
    except ImportError:
        return []

    # Map common index codes
    index_map = {
        "000001": "sh000001",  # 上证指数
        "399001": "sz399001",  # 深证成指
        "399006": "sz399006",  # 创业板指
        "000688": "sh000688",  # 科创50
    }

    ak_code = index_map.get(symbol, symbol)

    try:
        period_map = {"daily": "daily", "weekly": "weekly"}
        ak_period = period_map.get(period, "daily")

        # Use index data APIs
        df = ak.stock_zh_index_daily(symbol=ak_code)
        # Filter by period if needed
        result = []
        for _, row in df.iterrows():
            date_val = str(row.get("日期", ""))
            if len(date_val) != 10:
                continue
            result.append({
                "date": date_val,
                "open": float(row.get("开盘", 0)),
                "close": float(row.get("收盘", 0)),
                "high": float(row.get("最高", 0)),
                "low": float(row.get("最低", 0)),
                "volume": float(row.get("成交量", 0)),
                "turnover": float(row.get("成交额", 0)) if "成交额" in row else 0,
            })
        return result[-500:]  # Last 500 records
    except Exception as e:
        print(f"[AkShare] fetch_index error for {symbol}: {e}")
        return []


def get_kline_with_cache(symbol: str, period: str = "daily",
                          start_date: str = "", end_date: str = "",
                          use_cache: bool = True) -> Tuple[List[Dict], bool]:
    """
    Get K-line data with cache-first strategy.
    Returns (data, from_cache_only) tuple.
    If cache has data and no refresh needed, returns cached data.
    Otherwise fetches from AkShare and updates cache.
    """
    # Ensure date format YYYY-MM-DD
    if start_date and len(start_date) == 8:
        start_date = f"{start_date[:4]}-{start_date[4:6]}-{start_date[6:8]}"
    if end_date and len(end_date) == 8:
        end_date = f"{end_date[:4]}-{end_date[4:6]}-{end_date[6:8]}"

    cached = get_cached_klines(symbol, period)
    latest_cached = get_latest_cached_date(symbol, period) if cached else None

    if use_cache and cached:
        # If caller specified start/end date, filter cached data
        if start_date or end_date:
            filtered = cached
            if start_date:
                filtered = [k for k in filtered if k["date"] >= start_date]
            if end_date:
                filtered = [k for k in filtered if k["date"] <= end_date]
            if filtered:
                return filtered, True

        # If we have recent cache (within last 5 days), use it
        if latest_cached:
            try:
                latest_dt = datetime.strptime(latest_cached, "%Y-%m-%d")
                if (datetime.now() - latest_dt).days <= 5:
                    return cached, True
            except ValueError:
                pass

    # Fetch from AkShare
    today = datetime.now().strftime("%Y-%m-%d")
    if not start_date:
        # Default start: 2 years ago
        start_date = (datetime.now() - timedelta(days=730)).strftime("%Y-%m-%d")

    fetched = fetch_from_akshare(symbol, period, start_date, today)
    if fetched:
        cache_klines(symbol, period, fetched)
        # Filter fetched data to requested range
        result = fetched
        if start_date:
            result = [k for k in result if k["date"] >= start_date]
        if end_date:
            result = [k for k in result if k["date"] <= end_date]
        return result, False

    # Fallback to cache if AkShare fails
    return cached if cached else [], False


# Initialize on module load
init_kline_db()
