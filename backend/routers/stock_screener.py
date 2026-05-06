"""Router: Stock Screener - 条件选股API"""
from typing import Optional, List, Literal
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.screener import screen_stocks, screen_by_preset, get_preset_list

router = APIRouter(prefix="/api/stock-screener", tags=["stock_screener"])


# ============== Request/Response Models ==============

class FilterSpec(BaseModel):
    """单个过滤器规格"""
    type: str = Field(..., description="过滤器类型: PE/PB/ROE/股息率/市值/营收增速/净利润增速/均线多头/突破新高/成交量放大/MACD金叉/MACD死叉/RSI超卖/RSI超买/业绩预告")
    params: dict = Field(default_factory=dict, description="过滤器参数")


class StockScreenerRequest(BaseModel):
    """选股请求"""
    filters: List[FilterSpec] = Field(default_factory=list, description="过滤器列表")
    logic: Literal["AND", "OR"] = Field(default="AND", description="多条件组合逻辑: AND或OR")
    preset: Optional[str] = Field(None, description="预设条件: 低估价值/成长激进/技术强势/量价齐升/超卖反弹/高股息")
    limit: int = Field(default=50, ge=1, le=500, description="返回结果数量")
    offset: int = Field(default=0, ge=0, description="分页偏移")


class ScreenerStockItem(BaseModel):
    """选股结果中的单个股票"""
    symbol: str
    name: str
    price: Optional[float] = None
    change_pct: Optional[float] = None
    volume: Optional[float] = None
    pe: Optional[float] = None
    pb: Optional[float] = None
    roe: Optional[float] = None
    market_cap: Optional[float] = None
    dividend_yield: Optional[float] = None
    revenue_growth: Optional[float] = None
    net_profit_growth: Optional[float] = None
    # 技术指标 (如果有)
    technicals: Optional[dict] = None
    # 附加信息
    volume_ratio: Optional[float] = None
    historical_high: Optional[float] = None


class FilterApplied(BaseModel):
    """已应用的过滤器信息"""
    type: str
    params: dict
    before: Optional[int] = None
    after: Optional[int] = None
    matched: Optional[int] = None


class StockScreenerResponse(BaseModel):
    """选股响应"""
    stocks: List[dict]
    total: int
    filters_applied: List[dict]
    logic: str


class PresetItem(BaseModel):
    """预设条件项"""
    id: str
    name: str
    description: str
    category: str


class PresetListResponse(BaseModel):
    """预设列表响应"""
    presets: List[PresetItem]


# ============== API Endpoints ==============

@router.post("", response_model=StockScreenerResponse)
def stock_screener(req: StockScreenerRequest):
    """
    条件选股接口。
    
    支持财务指标、技术面、消息面筛选条件，可自由组合AND/OR逻辑。
    
    **过滤器类型:**
    - 财务: PE, PB, ROE, 股息率, 市值, 营收增速, 净利润增速
    - 技术: 均线多头, 突破新高, 成交量放大, MACD金叉, MACD死叉, RSI超卖, RSI超买
    - 消息: 业绩预告
    
    **组合逻辑:**
    - AND: 同时满足所有条件
    - OR: 满足任一条件即可
    
    **使用示例:**
    ```json
    {
        "filters": [
            {"type": "PE", "params": {"operator": "<", "value": 20}},
            {"type": "ROE", "params": {"operator": ">", "value": 10}},
            {"type": "MACD金叉", "params": {}}
        ],
        "logic": "AND",
        "limit": 50
    }
    ```
    
    **预设快捷条件:**
    - preset="低估价值" -> PE<20, PB<3, ROE>10%
    - preset="成长激进" -> 净利润增速>30%, 营收增速>20%
    - preset="技术强势" -> 均线多头 + MACD金叉
    - preset="量价齐升" -> 突破20日新高 + 成交量放大
    - preset="超卖反弹" -> RSI<30
    - preset="高股息" -> 股息率>3%
    """
    # 如果指定了preset，忽略filters，使用预设条件
    if req.preset:
        result = screen_by_preset(req.preset, limit=req.limit)
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return StockScreenerResponse(**result)
    
    # 否则使用自定义过滤器
    filter_dicts = [f.model_dump() for f in req.filters]
    result = screen_stocks(
        filters=filter_dicts,
        logic=req.logic,
        limit=req.limit,
        offset=req.offset,
    )
    return StockScreenerResponse(**result)


@router.get("/presets", response_model=PresetListResponse)
def list_presets():
    """
    获取所有预设选股条件。
    
    返回系统预设的快捷选股条件列表，包含:
    - 低估价值、成长激进、技术强势、量价齐升、超卖反弹、高股息
    """
    presets = get_preset_list()
    return PresetListResponse(presets=[PresetItem(**p) for p in presets])


@router.get("/filters")
def list_available_filters():
    """
    获取所有可用的过滤器类型。
    
    返回支持的过滤器列表及其参数说明。
    """
    return {
        "financial": [
            {"type": "PE", "params": {"operator": ">/<//>=/<=/==", "value": float}, "description": "市盈率"},
            {"type": "PB", "params": {"operator": ">/<", "value": float}, "description": "市净率"},
            {"type": "ROE", "params": {"operator": ">/<", "value": float}, "description": "净资产收益率(%)"},
            {"type": "股息率", "params": {"operator": ">/<", "value": float}, "description": "股息率(%)"},
            {"type": "市值", "params": {"operator": ">/<", "value": float}, "description": "总市值(亿元)"},
            {"type": "营收增速", "params": {"operator": ">/<", "value": float}, "description": "营业收入增速(%)"},
            {"type": "净利润增速", "params": {"operator": ">/<", "value": float}, "description": "净利润增速(%)"},
        ],
        "technical": [
            {"type": "均线多头", "params": {}, "description": "MA5>MA10>MA20>MA60多头排列"},
            {"type": "突破新高", "params": {"days": int}, "description": "突破N日新高, 默认20日"},
            {"type": "成交量放大", "params": {"ratio": float}, "description": "成交量超过均量的倍数, 默认2.0"},
            {"type": "MACD金叉", "params": {}, "description": "MACD从下往上穿越信号线"},
            {"type": "MACD死叉", "params": {}, "description": "MACD从上往下穿越信号线"},
            {"type": "RSI超卖", "params": {"threshold": float}, "description": "RSI低于阈值, 默认30"},
            {"type": "RSI超买", "params": {"threshold": float}, "description": "RSI高于阈值, 默认70"},
        ],
        "sentiment": [
            {"type": "业绩预告", "params": {}, "description": "有业绩预告或业绩预增"},
        ],
        "logic_modes": ["AND", "OR"],
    }
