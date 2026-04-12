"""EastMoney (东方财富) data source adapter using AkShare."""
from typing import Dict, Any, Optional
import pandas as pd
import akshare as ak


class EastMoneyAdapter:
    """Adapter for EastMoney data source."""

    name = "east_money"
    display_name = "东方财富"

    def get_ipo_info(self, stock_code: str) -> Dict[str, Any]:
        """Get IPO information for a stock."""
        try:
            df = ak.stock_individual_info_em(symbol=stock_code)
            info = {}
            for _, row in df.iterrows():
                info[str(row.get("item", ""))] = str(row.get("value", ""))
            return {"success": True, "data": info}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_realtime_quote(self, stock_code: str) -> Dict[str, Any]:
        """Get realtime quote for a stock."""
        try:
            df = ak.stock_zh_a_spot_em()
            row = df[df["代码"] == stock_code]
            if row.empty:
                return {"success": False, "error": "股票未找到"}
            r = row.iloc[0]
            return {
                "success": True,
                "data": {
                    "symbol": str(r.get("代码", "")),
                    "name": str(r.get("名称", "")),
                    "price": float(r.get("最新价", 0) or 0),
                    "change_pct": float(r.get("涨跌幅", 0) or 0),
                    "volume": float(r.get("成交量", 0) or 0),
                    "amount": float(r.get("成交额", 0) or 0),
                }
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_historical_kline(self, stock_code: str, period: str = "daily", adjust: str = "qfq") -> Dict[str, Any]:
        """Get historical K-line data."""
        try:
            df = ak.stock_zh_a_hist(symbol=stock_code, period=period, adjust=adjust)
            records = []
            for _, row in df.tail(60).iterrows():
                records.append({
                    "date": str(row.get("日期", "")),
                    "open": float(row.get("开盘", 0) or 0),
                    "high": float(row.get("最高", 0) or 0),
                    "low": float(row.get("最低", 0) or 0),
                    "close": float(row.get("收盘", 0) or 0),
                    "volume": float(row.get("成交量", 0) or 0),
                })
            return {"success": True, "data": records}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_financial_data(self, stock_code: str) -> Dict[str, Any]:
        """Get financial data (PE, PB, ROE etc)."""
        try:
            df = ak.stock_financial_analysis_indicator(symbol=stock_code)
            if df.empty:
                return {"success": False, "error": "无财务数据"}
            latest = df.iloc[-1]
            return {
                "success": True,
                "data": {
                    "pe": float(latest.get("市盈率", 0) or 0) if not pd.isna(latest.get("市盈率")) else None,
                    "pb": float(latest.get("市净率", 0) or 0) if not pd.isna(latest.get("市净率")) else None,
                    "roe": float(latest.get("净资产收益率", 0) or 0) if not pd.isna(latest.get("净资产收益率")) else None,
                    "gross_margin": float(latest.get("销售毛利率", 0) or 0) if not pd.isna(latest.get("销售毛利率")) else None,
                }
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_stock_info(self, stock_code: str) -> Dict[str, Any]:
        """Get basic stock info including industry, market cap."""
        try:
            df = ak.stock_individual_info_em(symbol=stock_code)
            info = {}
            for _, row in df.iterrows():
                item = str(row.get("item", ""))
                value = str(row.get("value", ""))
                info[item] = value
            return {"success": True, "data": info}
        except Exception as e:
            return {"success": False, "error": str(e)}
