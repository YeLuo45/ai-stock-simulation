"""
Router: 东方财富板块/概念数据 (EastMoney Board/Sector Data)
提供板块行情、概念板块、行业板块、资金流向等接口
"""
from fastapi import APIRouter, Query
from typing import Optional, List
from pydantic import BaseModel
import pandas as pd

router = APIRouter(prefix="/api/eastmoney", tags=["eastmoney_boards"])

# ============== Pydantic Models ==============

class BoardItem(BaseModel):
    """板块条目"""
    code: str
    name: str
    change_pct: float       # 涨跌幅 %
    turnover_rate: float    # 换手率 %
    leading_stocks: List[dict] = []  # 领涨股

    class Config:
        from_attributes = True


class BoardDetail(BaseModel):
    """板块详情"""
    code: str
    name: str
    change_pct: float
    turnover_rate: float
    market_cap: Optional[float] = None      # 总市值（亿元）
    flow_in: Optional[float] = None        # 资金流入（万元）
    flow_out: Optional[float] = None       # 资金流出（万元）
    net_flow: Optional[float] = None       # 净流入（万元）
    stock_count: int = 0
    rising_count: int = 0                   # 上涨数
    falling_count: int = 0                  # 下跌数
    leading_stocks: List[dict] = []
    concept_desc: Optional[str] = None     # 概念描述


class StockInBoard(BaseModel):
    """板块内的股票"""
    symbol: str
    name: str
    price: float
    change_pct: float
    volume: float
    turnover_rate: float


class BoardListResponse(BaseModel):
    boards: List[BoardItem]
    total: int
    board_type: str  # concept / industry / sector


# ============== 辅助函数 ==============

def _safe_float(val, default=0.0):
    try:
        v = float(val)
        if pd.isna(v):
            return default
        return v
    except (TypeError, ValueError):
        return default


def _to_board_item(row, leading=None) -> BoardItem:
    return BoardItem(
        code=str(row.get("代码", "")),
        name=str(row.get("名称", "")),
        change_pct=_safe_float(row.get("涨跌幅", 0)),
        turnover_rate=_safe_float(row.get("换手率", 0)),
        leading_stocks=leading or [],
    )


# ============== API: 概念板块 ==============

@router.get("/boards/concept", response_model=BoardListResponse)
def get_concept_boards(
    top: int = Query(50, ge=1, le=200, description="返回数量"),
    sort_by: str = Query("change_pct", description="排序字段: change_pct/turnover_rate"),
    ascending: bool = Query(False, description="升序/降序"),
):
    """
    获取概念板块列表（涨幅榜、换手率榜等）
    数据来源：东方财富概念板块
    """
    try:
        import akshare as ak
        df = ak.stock_board_concept_name_em()
        if df is None or df.empty:
            return BoardListResponse(boards=[], total=0, board_type="concept")

        # 清理列名
        if "涨跌幅" not in df.columns and "涨跌幅" in str(df.columns):
            df.columns = [str(c) for c in df.columns]

        # 排序
        sort_col = "涨跌幅" if sort_by == "change_pct" else "换手率"
        if sort_col in df.columns:
            df = df.sort_values(sort_col, ascending=ascending)

        df = df.head(top)

        boards = []
        for _, row in df.iterrows():
            boards.append(_to_board_item(row))

        return BoardListResponse(
            boards=boards,
            total=len(boards),
            board_type="concept",
        )
    except Exception as e:
        return BoardListResponse(boards=[], total=0, board_type="concept")


@router.get("/boards/industry", response_model=BoardListResponse)
def get_industry_boards(
    top: int = Query(50, ge=1, le=200),
    sort_by: str = Query("change_pct"),
    ascending: bool = Query(False),
):
    """
    获取行业板块列表
    """
    try:
        import akshare as ak
        df = ak.stock_board_industry_name_em()
        if df is None or df.empty:
            return BoardListResponse(boards=[], total=0, board_type="industry")

        sort_col = "涨跌幅" if sort_by == "change_pct" else "换手率"
        if sort_col in df.columns:
            df = df.sort_values(sort_col, ascending=ascending)

        df = df.head(top)

        boards = []
        for _, row in df.iterrows():
            boards.append(_to_board_item(row))

        return BoardListResponse(
            boards=boards,
            total=len(boards),
            board_type="industry",
        )
    except Exception as e:
        return BoardListResponse(boards=[], total=0, board_type="industry")


@router.get("/boards/sector", response_model=BoardListResponse)
def get_sector_boards(
    top: int = Query(50, ge=1, le=200),
    sort_by: str = Query("change_pct"),
    ascending: bool = Query(False),
):
    """
    获取地域板块列表
    """
    try:
        import akshare as ak
        df = ak.stock_board_area_name_em()
        if df is None or df.empty:
            return BoardListResponse(boards=[], total=0, board_type="sector")

        sort_col = "涨跌幅" if sort_by == "change_pct" else "换手率"
        if sort_col in df.columns:
            df = df.sort_values(sort_col, ascending=ascending)

        df = df.head(top)

        boards = []
        for _, row in df.iterrows():
            boards.append(_to_board_item(row))

        return BoardListResponse(
            boards=boards,
            total=len(boards),
            board_type="sector",
        )
    except Exception as e:
        return BoardListResponse(boards=[], total=0, board_type="sector")


# ============== API: 板块详情 ==============

@router.get("/boards/{board_code}", response_model=BoardDetail)
def get_board_detail(board_code: str):
    """
    获取板块详细信息（含资金流向）
    board_code: 东方财富板块代码，如 "BK0428"（锂电池）
    """
    try:
        import akshare as ak
        # 获取板块成分股
        df = ak.stock_board_concept_cons_em(symbol=board_code)
        if df is None or df.empty:
            # 尝试行业板块
            df = ak.stock_board_industry_cons_em(symbol=board_code)

        detail = BoardDetail(
            code=board_code,
            name=board_code,
            change_pct=0.0,
            turnover_rate=0.0,
            stock_count=0,
            rising_count=0,
            falling_count=0,
            leading_stocks=[],
        )

        if df is not None and not df.empty:
            detail.stock_count = len(df)

            # 提取领涨股（涨幅最大的3只）
            if "涨跌幅" in df.columns:
                df_sorted = df.sort_values("涨跌幅", ascending=False).head(3)
                detail.leading_stocks = [
                    {
                        "symbol": str(row.get("代码", "")),
                        "name": str(row.get("名称", "")),
                        "change_pct": _safe_float(row.get("涨跌幅", 0)),
                    }
                    for _, row in df_sorted.iterrows()
                ]
                detail.rising_count = int((df["涨跌幅"] > 0).sum())
                detail.falling_count = int((df["涨跌幅"] < 0).sum())

            # 取第一条的涨跌幅作为板块涨跌幅
            first = df.iloc[0]
            detail.change_pct = _safe_float(first.get("涨跌幅", 0))
            detail.turnover_rate = _safe_float(first.get("换手率", 0))
            if "板块名称" in df.columns:
                detail.name = str(first.get("板块名称", board_code))

        return detail

    except Exception as e:
        return BoardDetail(
            code=board_code,
            name=board_code,
            change_pct=0.0,
            turnover_rate=0.0,
            stock_count=0,
            leading_stocks=[],
        )


# ============== API: 板块内股票 ==============

@router.get("/boards/{board_code}/stocks", response_model=List[StockInBoard])
def get_board_stocks(
    board_code: str,
    top: int = Query(50, ge=1, le=100),
    sort_by: str = Query("change_pct"),
    ascending: bool = Query(False),
):
    """
    获取指定板块内的成分股列表
    """
    try:
        import akshare as ak
        # 优先尝试概念板块
        try:
            df = ak.stock_board_concept_cons_em(symbol=board_code)
        except Exception:
            try:
                df = ak.stock_board_industry_cons_em(symbol=board_code)
            except Exception:
                df = ak.stock_board_area_cons_em(symbol=board_code)

        if df is None or df.empty:
            return []

        sort_col_map = {
            "change_pct": "涨跌幅",
            "turnover_rate": "换手率",
            "volume": "成交量",
        }
        sort_col = sort_col_map.get(sort_by, "涨跌幅")
        if sort_col in df.columns:
            df = df.sort_values(sort_col, ascending=ascending)

        df = df.head(top)

        stocks = []
        for _, row in df.iterrows():
            stocks.append(StockInBoard(
                symbol=str(row.get("代码", "")),
                name=str(row.get("名称", "")),
                price=_safe_float(row.get("最新价", 0)),
                change_pct=_safe_float(row.get("涨跌幅", 0)),
                volume=_safe_float(row.get("成交量", 0)),
                turnover_rate=_safe_float(row.get("换手率", 0)),
            ))

        return stocks

    except Exception as e:
        return []


# ============== API: 热门板块/概念 ==============

@router.get("/boards/hot", response_model=List[BoardItem])
def get_hot_boards(
    limit: int = Query(10, ge=1, le=30),
):
    """
    获取当前热门板块（综合排名）
    """
    try:
        import akshare as ak
        # 东财热门板块排行
        df = ak.stock_board_concept_hot_em()
        if df is None or df.empty:
            return []

        df = df.head(limit)
        boards = []
        for _, row in df.iterrows():
            boards.append(_to_board_item(row))

        return boards
    except Exception as e:
        return []


# ============== API: 板块资金流向 ==============

@router.get("/boards/{board_code}/money-flow")
def get_board_money_flow(board_code: str):
    """
    获取板块资金流向
    """
    try:
        import akshare as ak
        # 概念板块资金流向
        try:
            df = ak.stock_board_concept_money_flow_em(symbol=board_code)
        except Exception:
            df = ak.stock_board_industry_money_flow_em(symbol=board_code)

        if df is None or df.empty:
            return {
                "code": board_code,
                "flow_in": 0.0,
                "flow_out": 0.0,
                "net_flow": 0.0,
                "change_pct": 0.0,
            }

        first = df.iloc[0]
        flow_in = _safe_float(first.get("主力净流入-净额", 0))
        flow_out = _safe_float(first.get("主力净流出-净额", 0))

        return {
            "code": board_code,
            "name": str(first.get("名称", board_code)),
            "flow_in": flow_in,
            "flow_out": flow_out,
            "net_flow": flow_in - flow_out,
            "change_pct": _safe_float(first.get("涨跌幅", 0)),
        }
    except Exception as e:
        return {
            "code": board_code,
            "flow_in": 0.0,
            "flow_out": 0.0,
            "net_flow": 0.0,
            "change_pct": 0.0,
            "error": str(e),
        }


# ============== API: 搜索板块 ==============

@router.get("/boards/search", response_model=List[BoardItem])
def search_boards(
    keyword: str = Query(..., min_length=1, description="搜索关键词"),
    board_type: str = Query("concept", description="板块类型: concept/industry/sector"),
):
    """
    搜索板块（按名称模糊匹配）
    """
    try:
        import akshare as ak

        if board_type == "concept":
            df = ak.stock_board_concept_name_em()
        elif board_type == "industry":
            df = ak.stock_board_industry_name_em()
        else:
            df = ak.stock_board_area_name_em()

        if df is None or df.empty:
            return []

        # 模糊匹配
        mask = df["名称"].astype(str).str.contains(keyword, na=False)
        df = df[mask].head(20)

        boards = []
        for _, row in df.iterrows():
            boards.append(_to_board_item(row))

        return boards
    except Exception as e:
        return []
