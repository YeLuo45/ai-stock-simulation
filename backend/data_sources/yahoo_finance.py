"""
Yahoo Finance data source adapter using yfinance library.
Supports US stocks, indices, ETFs, and crypto.
"""
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
import yfinance as yf


class YahooFinanceAdapter:
    """Adapter for Yahoo Finance data source (yfinance)."""

    name = "yahoo_finance"
    display_name = "Yahoo Finance"

    def get_realtime_quote(self, stock_code: str) -> Optional[Dict[str, Any]]:
        """Get realtime quote for a US stock."""
        try:
            ticker = yf.Ticker(stock_code)
            info = ticker.fast_info
            return {
                "success": True,
                "data": {
                    "symbol": stock_code,
                    "name": info.get("long_name") or stock_code,
                    "price": info.get("last_price") or 0,
                    "change_pct": 0,  # Need history to calculate
                    "volume": info.get("last_volume") or 0,
                    "market_cap": info.get("market_cap") or 0,
                    "currency": info.get("currency") or "USD",
                }
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_historical_kline(
        self,
        stock_code: str,
        period: str = "1y",
        start_date: str = "",
        end_date: str = "",
        interval: str = "1d",
    ) -> Optional[List[Dict[str, Any]]]:
        """
        Get historical K-line data from Yahoo Finance.
        
        Args:
            stock_code: Symbol (e.g., "AAPL", "^GSPC", "BTC-USD")
            period: yfinance period string (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max)
            start_date: Start date YYYY-MM-DD (overrides period if provided)
            end_date: End date YYYY-MM-DD (defaults to today)
            interval: Data interval (1d, 1wk, 1mo, 5m, 15m, 30m, 60m, etc.)
        
        Returns:
            List of K-line dicts with date, open, high, low, close, volume
        """
        try:
            ticker = yf.Ticker(stock_code)
            
            if start_date and end_date:
                df = ticker.history(start=start_date, end=end_date, interval=interval)
            else:
                df = ticker.history(period=period, interval=interval)
            
            if df.empty:
                return []
            
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
            
            return records
        except Exception as e:
            print(f"[YahooFinance] get_historical_kline error for {stock_code}: {e}")
            return None

    def get_info(self, stock_code: str) -> Optional[Dict[str, Any]]:
        """Get stock info from Yahoo Finance."""
        try:
            ticker = yf.Ticker(stock_code)
            info = ticker.info
            return {
                "success": True,
                "data": {
                    "symbol": stock_code,
                    "name": info.get("longName") or info.get("shortName") or stock_code,
                    "sector": info.get("sector"),
                    "industry": info.get("industry"),
                    "market_cap": info.get("marketCap"),
                    "pe_ratio": info.get("trailingPE"),
                    "dividend_yield": info.get("dividendYield"),
                    "52w_high": info.get("fiftyTwoWeekHigh"),
                    "52w_low": info.get("fiftyTwoWeekLow"),
                    "currency": info.get("currency"),
                    "exchange": info.get("exchange"),
                }
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def search_symbols(self, query: str, limit: int = 10) -> List[Dict[str, str]]:
        """Search for symbols on Yahoo Finance."""
        try:
            from yfinance import search
            results = search(query, limit=limit)
            symbols = []
            for r in results.get("quotes", []):
                symbols.append({
                    "symbol": r.get("symbol", ""),
                    "name": r.get("longname") or r.get("shortname", ""),
                    "exch": r.get("exchange", ""),
                    "type": r.get("quoteType", ""),
                })
            return symbols
        except Exception as e:
            print(f"[YahooFinance] search error: {e}")
            return []

    def get_financial_data(self, stock_code: str) -> Optional[Dict[str, Any]]:
        """Get financial data (income statement, balance sheet, cash flow)."""
        try:
            ticker = yf.Ticker(stock_code)
            financials = ticker.financials
            balance = ticker.balance_sheet
            cashflow = ticker.cashflow
            
            return {
                "success": True,
                "data": {
                    "income_stmt": financials.to_dict() if not financials.empty else {},
                    "balance_sheet": balance.to_dict() if not balance.empty else {},
                    "cashflow": cashflow.to_dict() if not cashflow.empty else {},
                }
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_ipo_info(self, stock_code: str) -> Optional[Dict[str, Any]]:
        """Get IPO info (listing date, etc)."""
        try:
            ticker = yf.Ticker(stock_code)
            info = ticker.info
            return {
                "success": True,
                "data": {
                    "symbol": stock_code,
                    "name": info.get("longName") or stock_code,
                    "listing_date": info.get("firstTradeDateMinuteEpochStr"),
                    "exchange": info.get("exchange"),
                    "currency": info.get("currency"),
                }
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
