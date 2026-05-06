"""Stock Screener Service - 条件选股服务"""
import json
import random
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Literal
from functools import lru_cache

from data_sources.manager import get_ds_manager
from data.market_data import get_realtime_quotes, get_kline_data, calculate_technicals, get_stock_list


# ============== Filter Definitions ==============

class FilterOperator:
    """支持的过滤操作符"""
    GT = ">"   # greater than
    LT = "<"   # less than
    GTE = ">="
    LTE = "<="
    EQ = "=="
    NE = "!="
    IN = "in"       # 范围内
    NOT_IN = "not_in"


# ============== Financial Filters ==============

def filter_by_pe(stocks: List[Dict], operator: str, value: float) -> List[Dict]:
    """按PE筛选"""
    op_map = {
        ">": lambda x: x is not None and x > value,
        "<": lambda x: x is not None and x < value,
        ">=": lambda x: x is not None and x >= value,
        "<=": lambda x: x is not None and x <= value,
        "==": lambda x: x is not None and abs(x - value) < 0.01,
        "!=": lambda x: x is None or abs(x - value) >= 0.01,
    }
    fn = op_map.get(operator, lambda x: True)
    return [s for s in stocks if fn(s.get("pe"))]


def filter_by_pb(stocks: List[Dict], operator: str, value: float) -> List[Dict]:
    """按PB筛选"""
    op_map = {
        ">": lambda x: x is not None and x > value,
        "<": lambda x: x is not None and x < value,
        ">=": lambda x: x is not None and x >= value,
        "<=": lambda x: x is not None and x <= value,
        "==": lambda x: x is not None and abs(x - value) < 0.01,
    }
    fn = op_map.get(operator, lambda x: True)
    return [s for s in stocks if fn(s.get("pb"))]


def filter_by_roe(stocks: List[Dict], operator: str, value: float) -> List[Dict]:
    """按ROE筛选 (净资产收益率)"""
    op_map = {
        ">": lambda x: x is not None and x > value,
        "<": lambda x: x is not None and x < value,
        ">=": lambda x: x is not None and x >= value,
        "<=": lambda x: x is not None and x <= value,
    }
    fn = op_map.get(operator, lambda x: True)
    return [s for s in stocks if fn(s.get("roe"))]


def filter_by_dividend_yield(stocks: List[Dict], operator: str, value: float) -> List[Dict]:
    """按股息率筛选"""
    op_map = {
        ">": lambda x: x is not None and x > value,
        "<": lambda x: x is not None and x < value,
        ">=": lambda x: x is not None and x >= value,
        "<=": lambda x: x is not None and x <= value,
    }
    fn = op_map.get(operator, lambda x: True)
    return [s for s in stocks if fn(s.get("dividend_yield"))]


def filter_by_market_cap(stocks: List[Dict], operator: str, value: float) -> List[Dict]:
    """按市值筛选 (亿元)"""
    op_map = {
        ">": lambda x: x is not None and x > value,
        "<": lambda x: x is not None and x < value,
        ">=": lambda x: x is not None and x >= value,
        "<=": lambda x: x is not None and x <= value,
    }
    fn = op_map.get(operator, lambda x: True)
    return [s for s in stocks if fn(s.get("market_cap"))]


def filter_by_revenue_growth(stocks: List[Dict], operator: str, value: float) -> List[Dict]:
    """按营收增速筛选"""
    op_map = {
        ">": lambda x: x is not None and x > value,
        "<": lambda x: x is not None and x < value,
        ">=": lambda x: x is not None and x >= value,
        "<=": lambda x: x is not None and x <= value,
    }
    fn = op_map.get(operator, lambda x: True)
    return [s for s in stocks if fn(s.get("revenue_growth"))]


def filter_by_net_profit_growth(stocks: List[Dict], operator: str, value: float) -> List[Dict]:
    """按净利润增速筛选"""
    op_map = {
        ">": lambda x: x is not None and x > value,
        "<": lambda x: x is not None and x < value,
        ">=": lambda x: x is not None and x >= value,
        "<=": lambda x: x is not None and x <= value,
    }
    fn = op_map.get(operator, lambda x: True)
    return [s for s in stocks if fn(s.get("net_profit_growth"))]


# ============== Technical Filters ==============

def _get_technicals_for_stock(symbol: str) -> Dict[str, Any]:
    """获取单只股票的技术指标 (带缓存)"""
    klines = get_kline_data(symbol, period="daily")
    if not klines or len(klines) < 5:
        return {}
    return calculate_technicals(klines)


def filter_by_ma_bullish(stocks: List[Dict]) -> List[Dict]:
    """均线多头排列: MA5 > MA10 > MA20 > MA60"""
    result = []
    for stock in stocks:
        try:
            techs = _get_technicals_for_stock(stock["symbol"])
            ma5 = techs.get("MA5", 0)
            ma10 = techs.get("MA10", 0)
            ma20 = techs.get("MA20", 0)
            ma60 = techs.get("MA60", 0)
            if ma5 > ma10 > ma20 > ma60 > 0:
                stock["technicals"] = techs
                result.append(stock)
        except Exception:
            continue
    return result


def filter_by_price_breakout(stocks: List[Dict], lookback_days: int = 20) -> List[Dict]:
    """突破新高: 当前价格创N日新高"""
    result = []
    for stock in stocks:
        try:
            klines = get_kline_data(stock["symbol"], period="daily")
            if not klines or len(klines) < lookback_days:
                continue
            current_price = klines[-1]["close"]
            historical_high = max(k["high"] for k in klines[-lookback_days:-1])
            if current_price > historical_high:
                stock["technicals"] = calculate_technicals(klines)
                stock["historical_high"] = historical_high
                result.append(stock)
        except Exception:
            continue
    return result


def filter_by_volume_surge(stocks: List[Dict], surge_ratio: float = 2.0) -> List[Dict]:
    """成交量放大: 今日成交量 > 昨日成交量 * ratio"""
    result = []
    for stock in stocks:
        try:
            klines = get_kline_data(stock["symbol"], period="daily")
            if not klines or len(klines) < 2:
                continue
            vol_today = klines[-1]["volume"]
            vol_yesterday = klines[-2]["volume"]
            avg_vol = sum(k["volume"] for k in klines[-20:]) / min(20, len(klines)) if len(klines) >= 20 else vol_yesterday
            if vol_today > avg_vol * surge_ratio:
                stock["technicals"] = calculate_technicals(klines)
                stock["volume_ratio"] = round(vol_today / avg_vol, 2) if avg_vol > 0 else 0
                result.append(stock)
        except Exception:
            continue
    return result


def filter_by_macd_cross(stocks: List[Dict], direction: Literal["golden", "death"] = "golden") -> List[Dict]:
    """MACD金叉/死叉筛选"""
    result = []
    for stock in stocks:
        try:
            klines = get_kline_data(stock["symbol"], period="daily")
            if not klines or len(klines) < 34:
                continue
            techs = calculate_technicals(klines)
            macd = techs.get("MACD", 0)
            macd_signal = techs.get("MACD_SIGNAL", 0)
            
            if direction == "golden" and macd > macd_signal and macd > 0:
                # 金叉: MACD从下往上穿越信号线
                prev_macd = klines[-2]["close"] if len(klines) >= 2 else macd
                prev_signal = macd_signal * 0.95  # 简化判断
                if macd > macd_signal and prev_macd <= prev_signal:
                    stock["technicals"] = techs
                    result.append(stock)
            elif direction == "death" and macd < macd_signal and macd < 0:
                # 死叉: MACD从上往下穿越信号线
                prev_macd = klines[-2]["close"] if len(klines) >= 2 else macd
                prev_signal = macd_signal * 1.05
                if macd < macd_signal and prev_macd >= prev_signal:
                    stock["technicals"] = techs
                    result.append(stock)
        except Exception:
            continue
    return result


def filter_by_rsi_oversold(stocks: List[Dict], threshold: float = 30) -> List[Dict]:
    """RSI超卖筛选"""
    result = []
    for stock in stocks:
        try:
            klines = get_kline_data(stock["symbol"], period="daily")
            if not klines or len(klines) < 14:
                continue
            techs = calculate_technicals(klines)
            rsi = techs.get("RSI", 50)
            if rsi < threshold:
                stock["technicals"] = techs
                result.append(stock)
        except Exception:
            continue
    return result


def filter_by_rsi_overbought(stocks: List[Dict], threshold: float = 70) -> List[Dict]:
    """RSI超买筛选"""
    result = []
    for stock in stocks:
        try:
            klines = get_kline_data(stock["symbol"], period="daily")
            if not klines or len(klines) < 14:
                continue
            techs = calculate_technicals(klines)
            rsi = techs.get("RSI", 50)
            if rsi > threshold:
                stock["technicals"] = techs
                result.append(stock)
        except Exception:
            continue
    return result


# ============== News/Sentiment Filters ==============

def filter_by_profit_forecast(stocks: List[Dict]) -> List[Dict]:
    """业绩预告/业绩预增筛选"""
    result = []
    for stock in stocks:
        try:
            # 尝试获取财务数据中的业绩信息
            fin_result = get_ds_manager().get_financial_data(stock["symbol"])
            if fin_result.get("success"):
                fin_data = fin_result.get("data", {})
                # 检查是否有业绩预增标识
                if fin_data.get("profit_forecast") or fin_data.get("net_profit_growth", 0) > 20:
                    stock["financial"] = fin_data
                    result.append(stock)
        except Exception:
            continue
    return result


# ============== Filter Registry ==============

FINANCIAL_FILTERS = {
    "PE": filter_by_pe,
    "PB": filter_by_pb,
    "ROE": filter_by_roe,
    "股息率": filter_by_dividend_yield,
    "dividend_yield": filter_by_dividend_yield,
    "市值": filter_by_market_cap,
    "market_cap": filter_by_market_cap,
    "营收增速": filter_by_revenue_growth,
    "revenue_growth": filter_by_revenue_growth,
    "净利润增速": filter_by_net_profit_growth,
    "net_profit_growth": filter_by_net_profit_growth,
}

TECHNICAL_FILTERS = {
    "均线多头": filter_by_ma_bullish,
    "ma_bullish": filter_by_ma_bullish,
    "突破新高": filter_by_price_breakout,
    "breakout": filter_by_price_breakout,
    "成交量放大": filter_by_volume_surge,
    "volume_surge": filter_by_volume_surge,
    "MACD金叉": lambda s: filter_by_macd_cross(s, "golden"),
    "macd_golden": lambda s: filter_by_macd_cross(s, "golden"),
    "MACD死叉": lambda s: filter_by_macd_cross(s, "death"),
    "macd_death": lambda s: filter_by_macd_cross(s, "death"),
    "RSI超卖": filter_by_rsi_oversold,
    "rsi_oversold": filter_by_rsi_oversold,
    "RSI超买": filter_by_rsi_overbought,
    "rsi_overbought": filter_by_rsi_overbought,
}

SENTIMENT_FILTERS = {
    "业绩预告": filter_by_profit_forecast,
    "profit_forecast": filter_by_profit_forecast,
}

ALL_FILTERS = {**FINANCIAL_FILTERS, **TECHNICAL_FILTERS, **SENTIMENT_FILTERS}


# ============== Main Screener ==============

def parse_filter_spec(spec: Dict[str, Any]) -> tuple:
    """
    解析过滤器规格。
    返回: (filter_func, kwargs)
    """
    filter_type = spec.get("type", "")
    filter_params = spec.get("params", {})
    
    func = ALL_FILTERS.get(filter_type)
    if not func:
        return None, None
    
    return func, filter_params


def apply_filter(stocks: List[Dict], spec: Dict[str, Any]) -> List[Dict]:
    """应用单个过滤器"""
    filter_type = spec.get("type", "")
    filter_params = spec.get("params", {})
    
    func = ALL_FILTERS.get(filter_type)
    if not func:
        return stocks
    
    # 根据不同过滤器类型调用
    if filter_type in FINANCIAL_FILTERS:
        operator = filter_params.get("operator", ">")
        value = filter_params.get("value", 0)
        return func(stocks, operator, value)
    elif filter_type in TECHNICAL_FILTERS:
        if filter_type in ["突破新高", "breakout"]:
            days = filter_params.get("days", 20)
            return func(stocks, days)
        elif filter_type in ["成交量放大", "volume_surge"]:
            ratio = filter_params.get("ratio", 2.0)
            return func(stocks, ratio)
        elif filter_type in ["MACD金叉", "MACD死叉", "macd_golden", "macd_death"]:
            direction = "golden" if "金叉" in filter_type or filter_type == "macd_golden" else "death"
            return func(stocks, direction)
        elif filter_type in ["RSI超卖", "RSI超买", "rsi_oversold", "rsi_overbought"]:
            threshold = filter_params.get("threshold", 30 if "超卖" in filter_type else 70)
            return func(stocks, threshold)
        else:
            return func(stocks)
    elif filter_type in SENTIMENT_FILTERS:
        return func(stocks)
    
    return stocks


def screen_stocks(
    filters: List[Dict[str, Any]],
    logic: Literal["AND", "OR"] = "AND",
    limit: int = 100,
    offset: int = 0,
) -> Dict[str, Any]:
    """
    选股核心函数。
    
    Args:
        filters: 过滤器列表，每个元素包含 type 和 params
        logic: AND 或 OR 组合逻辑
        limit: 返回结果数量限制
        offset: 分页偏移
    
    Returns:
        {"stocks": [...], "total": N, "filters_applied": [...], "logic": "AND/OR"}
    """
    applied_filters = []
    
    # 获取基础股票列表 (限制500只用于性能)
    all_stocks = get_stock_list()[:500]
    
    # 获取实时行情
    symbols = [s["symbol"] for s in all_stocks]
    quotes = get_realtime_quotes(symbols)
    
    # 合并基础信息
    stock_map = {s["symbol"]: s for s in all_stocks}
    for quote in quotes:
        sym = quote.get("symbol")
        if sym in stock_map:
            stock_map[sym].update(quote)
    
    stocks = list(stock_map.values())
    
    # 补充财务数据
    stocks = _enrich_with_financial_data(stocks)
    
    # 应用过滤器
    if logic == "AND":
        # AND: 从全部股票开始，逐步过滤
        result = stocks
        for f in filters:
            before_count = len(result)
            result = apply_filter(result, f)
            if result:
                applied_filters.append({
                    "type": f.get("type"),
                    "params": f.get("params", {}),
                    "before": before_count,
                    "after": len(result),
                })
        final_result = result
    else:
        # OR: 分别应用每个过滤器，再合并去重
        sets = []
        for f in filters:
            subset = apply_filter(list(stocks), f)
            sets.append(set(s["symbol"] for s in subset))
            applied_filters.append({
                "type": f.get("type"),
                "params": f.get("params", {}),
                "matched": len(subset),
            })
        
        if sets:
            union = set()
            for s in sets:
                union |= s
            final_symbols = union
            final_result = [s for s in stocks if s["symbol"] in final_symbols]
        else:
            final_result = []
    
    # 分页
    total = len(final_result)
    paginated = final_result[offset:offset + limit]
    
    return {
        "stocks": paginated,
        "total": total,
        "filters_applied": applied_filters,
        "logic": logic,
    }


def _enrich_with_financial_data(stocks: List[Dict]) -> List[Dict]:
    """补充财务数据到股票列表"""
    for stock in stocks:
        try:
            fin_result = get_ds_manager().get_financial_data(stock["symbol"])
            if fin_result.get("success"):
                fin_data = fin_result.get("data", {})
                stock["roe"] = fin_data.get("roe")
                stock["gross_margin"] = fin_data.get("gross_margin")
        except Exception:
            pass
    return stocks


# ============== Convenience Functions ==============

def screen_by_preset(preset_name: str, limit: int = 50) -> Dict[str, Any]:
    """
    按预设条件选股。
    
    预设:
    - "低估价值": PE<20, PB<3, ROE>10
    - "成长激进": 净利润增速>30%, 营收增速>20%
    - "技术强势": 均线多头, MACD金叉
    - "量价齐升": 突破新高, 成交量放大
    - "超卖反弹": RSI超卖
    """
    presets: Dict[str, tuple] = {
        "低估价值": (
            [{"type": "PE", "params": {"operator": "<", "value": 20}},
             {"type": "PB", "params": {"operator": "<", "value": 3}},
             {"type": "ROE", "params": {"operator": ">", "value": 10}}],
            "AND"
        ),
        "成长激进": (
            [{"type": "净利润增速", "params": {"operator": ">", "value": 30}},
             {"type": "营收增速", "params": {"operator": ">", "value": 20}}],
            "AND"
        ),
        "技术强势": (
            [{"type": "均线多头", "params": {}},
             {"type": "MACD金叉", "params": {}}],
            "AND"
        ),
        "量价齐升": (
            [{"type": "突破新高", "params": {"days": 20}},
             {"type": "成交量放大", "params": {"ratio": 2.0}}],
            "AND"
        ),
        "超卖反弹": (
            [{"type": "RSI超卖", "params": {"threshold": 30}}],
            "AND"
        ),
        "高股息": (
            [{"type": "股息率", "params": {"operator": ">", "value": 3}}],
            "AND"
        ),
    }
    
    if preset_name not in presets:
        return {"stocks": [], "total": 0, "filters_applied": [], "logic": "AND", "error": f"未知预设: {preset_name}"}
    
    filters, logic = presets[preset_name]
    return screen_stocks(filters, logic, limit=limit)


def get_preset_list() -> List[Dict[str, str]]:
    """获取所有预设条件"""
    return [
        {"id": "低估价值", "name": "低估价值", "description": "PE<20, PB<3, ROE>10%", "category": "价值"},
        {"id": "成长激进", "name": "成长激进", "description": "净利润增速>30%, 营收增速>20%", "category": "成长"},
        {"id": "技术强势", "name": "技术强势", "description": "均线多头 + MACD金叉", "category": "技术"},
        {"id": "量价齐升", "name": "量价齐升", "description": "突破20日新高 + 成交量放大2倍", "category": "技术"},
        {"id": "超卖反弹", "name": "超卖反弹", "description": "RSI<30 超卖状态", "category": "技术"},
        {"id": "高股息", "name": "高股息", "description": "股息率>3%", "category": "价值"},
    ]
