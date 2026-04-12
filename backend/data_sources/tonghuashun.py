"""
同花顺数据源适配器
"""
import akshare as ak
from typing import Dict, Any, Optional


class TonghuashunAdapter:
    """同花顺数据源适配器"""

    def get_realtime_quote(self, stock_code: str) -> Optional[Dict[str, Any]]:
        """获取实时行情（同花顺接口）"""
        try:
            df = ak.stock_zh_a_spot_em()
            row = df[df["代码"] == stock_code]
            if row.empty:
                return None
            r = row.iloc[0]
            return {
                "source": "tonghuashun",
                "code": stock_code,
                "name": r.get("名称", ""),
                "price": float(r.get("最新价", 0)),
                "change_pct": float(r.get("涨跌幅", 0)),
                "volume": float(r.get("成交量", 0)),
            }
        except Exception as e:
            print(f"[Tonghuashun] get_realtime_quote failed: {e}")
            return None

    def get_historical_kline(self, stock_code: str, period: str = "daily",
                              start_date: str = "", end_date: str = "") -> Optional[Any]:
        """获取历史K线（同花顺）"""
        try:
            period_map = {"daily": "daily", "weekly": "weekly", "monthly": "monthly"}
            df = ak.stock_zh_a_hist(
                symbol=stock_code,
                period=period_map.get(period, "daily"),
                start_date=start_date.replace("-", "") if start_date else "20250101",
                end_date=end_date.replace("-", "") if end_date else "20260412",
                adjust="qfq"
            )
            return df
        except Exception as e:
            print(f"[Tonghuashun] get_historical_kline failed: {e}")
            return None

    def get_ipo_info(self, stock_code: str) -> Optional[Dict[str, Any]]:
        """获取IPO信息（同花顺主要复用东方财富数据，这里做降级兜底）"""
        # 同花顺暂无独立IPO摘要接口，复用东方财富
        return None

    def get_stock_info(self, stock_code: str) -> Optional[Dict[str, Any]]:
        """获取股票基本信息"""
        try:
            df = ak.stock_individual_info_em(symbol=stock_code)
            if df is not None:
                row = df.iloc[0]
                return {
                    "source": "tonghuashun",
                    "code": stock_code,
                    "name": row.get("股票简称", ""),
                    "market": row.get("市场类型", ""),
                    "pe": float(row.get("市盈率", 0)) if hasattr(row.get("市盈率", 0), '__float__') else None,
                    "pb": float(row.get("市净率", 0)) if hasattr(row.get("市净率", 0), '__float__') else None,
                    "roe": float(row.get("净资产收益率", 0)) if hasattr(row.get("净资产收益率", 0), '__float__') else None,
                    "market_cap": float(row.get("总市值", 0)) if hasattr(row.get("总市值", 0), '__float__') else None,
                }
        except Exception as e:
            print(f"[Tonghuashun] get_stock_info failed: {e}")
        return None

    def get_financial_data(self, stock_code: str) -> Optional[Dict[str, Any]]:
        """获取财务数据"""
        try:
            df = ak.stock_financial_analysis_indicator(
                symbol=stock_code,
                start_year="2020",
                end_year="2026",
                indicator_type="基本指标"
            )
            if df is not None and len(df) > 0:
                latest = df.iloc[-1]
                return {
                    "source": "tonghuashun",
                    "pe": float(latest.get("市盈率-动态", 0)) if hasattr(latest.get("市盈率-动态", 0), '__float__') else None,
                    "pb": float(latest.get("市净率", 0)) if hasattr(latest.get("市净率", 0), '__float__') else None,
                    "roe": float(latest.get("净资产收益率(加权)", 0)) if hasattr(latest.get("净资产收益率(加权)", 0), '__float__') else None,
                    "gross_margin": float(latest.get("销售毛利率", 0)) if hasattr(latest.get("销售毛利率", 0), '__float__') else None,
                    "revenue_growth": float(latest.get("营业收入同比增长", 0)) if hasattr(latest.get("营业收入同比增长", 0), '__float__') else None,
                    "net_profit_growth": float(latest.get("净利润同比增长", 0)) if hasattr(latest.get("净利润同比增长", 0), '__float__') else None,
                }
        except Exception as e:
            print(f"[Tonghuashun] get_financial_data failed: {e}")
        return None