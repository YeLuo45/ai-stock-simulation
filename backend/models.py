"""Pydantic and SQLAlchemy models for the stock simulation app."""
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, JSON
from sqlalchemy.sql import func
from database import Base
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


# ============== SQLAlchemy Models ==============

class Portfolio(Base):
    __tablename__ = "portfolios"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, default="Default Portfolio")
    cash = Column(Float, default=1_000_000.0)  # 初始虚拟资金100万
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


class Position(Base):
    __tablename__ = "positions"
    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, default=1)
    symbol = Column(String, index=True)
    name = Column(String, default="")
    quantity = Column(Integer, default=0)
    avg_cost = Column(Float, default=0.0)  # 持仓成本
    current_price = Column(Float, default=0.0)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


class Trade(Base):
    __tablename__ = "trades"
    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, default=1)
    symbol = Column(String, index=True)
    name = Column(String, default="")
    trade_type = Column(String)  # "buy" or "sell"
    price = Column(Float)
    quantity = Column(Integer)
    commission = Column(Float, default=0.0)
    timestamp = Column(DateTime, default=func.now())


class StockCache(Base):
    __tablename__ = "stock_cache"
    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String, unique=True, index=True)
    name = Column(String, default="")
    data_type = Column(String)  # "realtime", "kline", "fundamental"
    data = Column(JSON)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


class AIModelConfig(Base):
    __tablename__ = "ai_model_configs"
    id = Column(Integer, primary_key=True, index=True)
    model_name = Column(String, unique=True)
    api_key = Column(Text)
    base_url = Column(Text)
    is_active = Column(Boolean, default=False)
    config_data = Column(JSON, default={})


class BacktestResult(Base):
    __tablename__ = "backtest_results"
    id = Column(Integer, primary_key=True, index=True)
    strategy_name = Column(String)
    params = Column(JSON, default={})
    results = Column(JSON, default={})
    created_at = Column(DateTime, default=func.now())


class AIModelPriority(Base):
    __tablename__ = "ai_model_priority"
    id = Column(Integer, primary_key=True, index=True)
    model_id = Column(String, unique=True)
    priority_order = Column(Integer, default=0)
    config_json = Column(JSON, default={})
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


class DataSource(Base):
    __tablename__ = "data_sources"
    id = Column(String, primary_key=True)  # "east_money", "tonghuashun", "joinquant"
    name = Column(String)
    enabled = Column(Boolean, default=True)
    priority = Column(Integer, default=0)
    config_json = Column(JSON, default={})
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


# ============== Pydantic Models ==============

class StockInfo(BaseModel):
    symbol: str
    name: str
    market: Optional[str] = None
    price: float
    change_pct: float
    volume: float
    pe: Optional[float] = None
    pb: Optional[float] = None
    roe: Optional[float] = None
    market_cap: Optional[float] = None


class StockSelectionRequest(BaseModel):
    query: str = Field(..., description="自然语言选股条件，如 'PE<20、近一年涨幅>30%的消费股'")


class StockSelectionResponse(BaseModel):
    stocks: List[StockInfo]
    ai_reasoning: str


class PositionResponse(BaseModel):
    id: int
    symbol: str
    name: str
    quantity: int
    avg_cost: float
    current_price: float
    market_value: float
    profit_loss: float
    profit_loss_pct: float

    class Config:
        from_attributes = True


class PortfolioResponse(BaseModel):
    id: int
    name: str
    cash: float
    total_market_value: float
    total_assets: float
    total_profit_loss: float
    total_profit_loss_pct: float
    positions: List[PositionResponse]


class TradeRequest(BaseModel):
    symbol: str
    name: str
    trade_type: str  # "buy" or "sell"
    quantity: int
    price: Optional[float] = None  # None = 市价


class TradeResponse(BaseModel):
    id: int
    symbol: str
    name: str
    trade_type: str
    price: float
    quantity: int
    commission: float
    total_cost: float
    timestamp: datetime

    class Config:
        from_attributes = True


class BacktestRequest(BaseModel):
    strategy_name: str
    symbols: List[str] = Field(default_factory=list, description="可选：指定回测标的，不填则用全部")
    start_date: str = "2023-01-01"
    end_date: str = "2026-04-01"
    initial_cash: float = 1_000_000.0
    params: Dict[str, Any] = Field(default_factory=dict)


class BacktestResponse(BaseModel):
    id: int
    strategy_name: str
    total_return: float
    annual_return: float
    max_drawdown: float
    sharpe_ratio: float
    win_rate: float
    total_trades: int
    equity_curve: List[Dict[str, float]]


class BatchBacktestResult(BaseModel):
    symbol: str
    name: str
    total_return: float
    sharpe_ratio: float
    max_drawdown: float
    win_rate: float
    trade_count: int


class BatchBacktestResponse(BaseModel):
    results: List[BatchBacktestResult]
    failed: List[str]
    progress: float  # 0.0 to 1.0


class TechnicalAnalysisRequest(BaseModel):
    symbol: str
    indicator_types: List[str] = Field(
        default_factory=lambda: ["MA", "MACD", "KDJ", "RSI", "BOLL"],
        description="技术指标类型"
    )


class TechnicalAnalysisResponse(BaseModel):
    symbol: str
    name: str
    current_price: float
    indicators: Dict[str, Any]
    ai_summary: str
    support_resistance: Dict[str, float]


class AIModelConfigRequest(BaseModel):
    model_name: str
    api_key: str
    base_url: Optional[str] = None
    api_protocol: Optional[str] = None
    is_active: bool = False


class AIModelConfigResponse(BaseModel):
    model_name: str
    base_url: Optional[str]
    api_protocol: Optional[str] = None
    is_active: bool
    has_api_key: bool

    class Config:
        from_attributes = True


class StockSearchResponse(BaseModel):
    symbol: str
    name: str
    exchange: str


# ============== IPO Evaluation ==============

class IPOEvaluationRequest(BaseModel):
    stock_code: str = Field(..., description="股票代码，如 '000001' 或 '688001'")


class FundamentalData(BaseModel):
    pe: Optional[float] = None
    pb: Optional[float] = None
    roe: Optional[float] = None
    gross_margin: Optional[float] = None
    revenue_growth: Optional[float] = None
    net_profit_growth: Optional[float] = None
    issue_price: Optional[float] = None
    circulating_shares: Optional[float] = None
    market_cap: Optional[float] = None
    listing_date: Optional[str] = None
    days_since_listing: Optional[int] = None


class TechnicalData(BaseModel):
    trend: str = "震荡"  # 上涨/震荡/下跌
    rsi: Optional[float] = None
    macd_signal: Optional[str] = None
    macd_value: Optional[float] = None
    support_level: Optional[float] = None
    resistance_level: Optional[float] = None
    ma5: Optional[float] = None
    ma10: Optional[float] = None
    ma20: Optional[float] = None
    current_price: Optional[float] = None
    change_pct: Optional[float] = None


class IPOEvaluationResponse(BaseModel):
    stock_code: str
    stock_name: str
    score: int = Field(..., ge=0, le=100)
    recommendation: str  # 强烈推荐/推荐/中性/回避/强烈回避
    fundamental: FundamentalData
    technical: TechnicalData
    analysis: str
    data_sources: List[str]
    requested_model: str
    actual_model: str
    fallback_used: bool = False
    fallback_reason: Optional[str] = None
    evaluated_at: str


# ============== AI Model Priority ==============

class AIModelPriorityItem(BaseModel):
    model_id: str
    priority_order: int
    config_json: Dict[str, Any] = Field(default_factory=dict)


class AIModelPriorityResponse(BaseModel):
    priority: List[str]  # list of model_id in priority order


class AIModelPriorityUpdateRequest(BaseModel):
    priority: List[str]


# ============== Data Source ==============

class DataSourceItem(BaseModel):
    id: str
    name: str
    enabled: bool
    priority: int
    status: str = "unknown"  # unknown/ok/error


class DataSourceResponse(BaseModel):
    sources: List[DataSourceItem]


class DataSourceUpdateRequest(BaseModel):
    enabled: bool
