"""
多行情数据源适配器包
支持：东方财富(east_money)、同花顺(tonghuashun)、聚宽(joinquant)
"""
from .manager import DataSourceManager

__all__ = ["DataSourceManager"]
