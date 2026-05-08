"""
统一数据源管理器
支持多数据源接入和降级策略
"""
from typing import Dict, Any, Optional
from database import SessionLocal
from models import DataSource

# 全局单例实例（延迟初始化，数据库表创建前不要实例化）
ds_manager: "DataSourceManager | None" = None


def get_ds_manager() -> "DataSourceManager":
    """获取全局数据源管理器单例"""
    global ds_manager
    if ds_manager is None:
        ds_manager = DataSourceManager()
    return ds_manager


class DataSourceManager:
    """统一行情数据源管理器"""

    def __init__(self):
        self._source_cache: Dict[str, Any] = {}
        self._load_sources()

    def _load_sources(self):
        """从数据库加载数据源配置"""
        db = SessionLocal()
        try:
            sources = db.query(DataSource).all()
            self._sources = {s.id: s for s in sources}
        finally:
            db.close()

    def is_enabled(self, source_id: str) -> bool:
        """检查数据源是否启用"""
        self._load_sources()
        source = self._sources.get(source_id)
        return source.enabled if source else False

    def get_enabled_sources(self) -> list[str]:
        """获取所有已启用的数据源ID，按优先级排序"""
        self._load_sources()
        enabled = [
            (sid, s.priority) for sid, s in self._sources.items() if s.enabled
        ]
        enabled.sort(key=lambda x: x[1])
        return [sid for sid, _ in enabled]

    def get_source_status(self, source_id: str) -> str:
        """获取数据源状态"""
        if source_id not in self._sources:
            return "unknown"
        return "ok" if self._sources[source_id].enabled else "disabled"

    def set_enabled(self, source_id: str, enabled: bool):
        """启用/禁用数据源"""
        db = SessionLocal()
        try:
            source = db.query(DataSource).filter(DataSource.id == source_id).first()
            if source:
                source.enabled = enabled
                db.commit()
        finally:
            db.close()
        self._load_sources()

    def get_data(self, source_id: str, data_type: str, **kwargs) -> Optional[Any]:
        """从指定数据源获取数据，支持降级"""
        fallback_order = self.get_enabled_sources()
        
        # 如果指定源不可用，从优先级列表中选择
        if source_id and not self.is_enabled(source_id):
            source_id = None

        if source_id:
            fallback_order = [source_id] + [s for s in fallback_order if s != source_id]

        errors = []
        for sid in fallback_order:
            try:
                adapter = self._get_adapter(sid)
                if adapter and hasattr(adapter, data_type):
                    method = getattr(adapter, data_type)
                    return method(**kwargs)
            except Exception as e:
                errors.append(f"{sid}: {e}")
                continue

        # 全部失败，返回None
        print(f"[DataSourceManager] All sources failed for {data_type}: {errors}")
        return None

    def _get_adapter(self, source_id: str):
        """获取数据源适配器"""
        if source_id in self._source_cache:
            return self._source_cache[source_id]

        adapter = None
        if source_id == "east_money":
            from . import east_money
            adapter = east_money.EastMoneyAdapter()
        elif source_id == "tonghuashun":
            from . import tonghuashun
            adapter = tonghuashun.TonghuashunAdapter()
        elif source_id == "joinquant":
            from . import joinquant
            adapter = joinquant.JoinQuantAdapter()
        elif source_id == "yahoo_finance":
            from . import yahoo_finance
            adapter = yahoo_finance.YahooFinanceAdapter()

        if adapter:
            self._source_cache[source_id] = adapter
        return adapter

    def get_ipo_info(self, stock_code: str) -> Optional[Dict[str, Any]]:
        """获取IPO信息，支持降级"""
        for sid in self.get_enabled_sources():
            adapter = self._get_adapter(sid)
            if adapter and hasattr(adapter, "get_ipo_info"):
                try:
                    result = adapter.get_ipo_info(stock_code)
                    if result:
                        return {"success": True, "data": result, "source_used": sid}
                except Exception:
                    continue
        return {"success": False, "data": None, "source_used": "unknown"}

    def get_realtime_quote(self, stock_code: str) -> Optional[Dict[str, Any]]:
        """获取实时行情，支持降级"""
        for sid in self.get_enabled_sources():
            adapter = self._get_adapter(sid)
            if adapter and hasattr(adapter, "get_realtime_quote"):
                try:
                    result = adapter.get_realtime_quote(stock_code)
                    if result:
                        return {"success": True, "data": result, "source_used": sid}
                except Exception:
                    continue
        return {"success": False, "data": None, "source_used": "unknown"}

    def get_historical_kline(self, stock_code: str, period: str = "daily", 
                              start_date: str = "", end_date: str = "") -> Optional[Dict[str, Any]]:
        """获取历史K线，支持降级"""
        for sid in self.get_enabled_sources():
            adapter = self._get_adapter(sid)
            if adapter and hasattr(adapter, "get_historical_kline"):
                try:
                    result = adapter.get_historical_kline(stock_code, period, start_date, end_date)
                    if result is not None:
                        return {"success": True, "data": result, "source_used": sid}
                except Exception:
                    continue
        return {"success": False, "data": None, "source_used": "unknown"}

    def get_stock_info(self, stock_code: str) -> Optional[Dict[str, Any]]:
        """获取股票基本信息，支持降级"""
        for sid in self.get_enabled_sources():
            adapter = self._get_adapter(sid)
            if adapter and hasattr(adapter, "get_stock_info"):
                try:
                    result = adapter.get_stock_info(stock_code)
                    if result:
                        return {"success": True, "data": result, "source_used": sid}
                except Exception:
                    continue
        return {"success": False, "data": None, "source_used": "unknown"}

    def get_financial_data(self, stock_code: str) -> Optional[Dict[str, Any]]:
        """获取财务数据，支持降级"""
        for sid in self.get_enabled_sources():
            adapter = self._get_adapter(sid)
            if adapter and hasattr(adapter, "get_financial_data"):
                try:
                    result = adapter.get_financial_data(stock_code)
                    if result:
                        return {"success": True, "data": result, "source_used": sid}
                except Exception:
                    continue
        return {"success": False, "data": None, "source_used": "unknown"}
