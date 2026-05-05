"""
Router: 股票池管理 (Stock Pool CRUD)
支持创建/查询/更新/删除自定义股票池
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime

from database import get_db

router = APIRouter(prefix="/api/stock-pools", tags=["stock_pools"])


# ============== SQLAlchemy Model (dynamic table per pool) ==============
# We use a JSON-based approach: StockPool table stores pool metadata,
# and pool stocks are stored in StockPoolItem table

from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, JSON
from sqlalchemy.sql import func
from database import Base


class StockPool(Base):
    """股票池元数据表"""
    __tablename__ = "stock_pools"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)          # 池名称，如 "我的自选股"
    description = Column(Text, default="")        # 池描述
    pool_type = Column(String, default="custom")   # custom / industry / concept / ai
    color = Column(String, default="#3b82f6")     # 前端展示颜色
    is_default = Column(Boolean, default=False)   # 是否默认池
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


class StockPoolItem(Base):
    """股票池内具体股票"""
    __tablename__ = "stock_pool_items"

    id = Column(Integer, primary_key=True, index=True)
    pool_id = Column(Integer, nullable=False, index=True)
    symbol = Column(String, nullable=False, index=True)
    name = Column(String, default="")
    added_at = Column(DateTime, default=func.now())
    notes = Column(Text, default="")               # 备注（如为何加入）
    tags = Column(JSON, default=[])               # 自定义标签


# ============== Pydantic Models ==============

class StockPoolCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="股票池名称")
    description: str = Field(default="", max_length=500)
    pool_type: str = Field(default="custom")
    color: str = Field(default="#3b82f6")
    is_default: bool = Field(default=False)


class StockPoolUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    pool_type: Optional[str] = None
    color: Optional[str] = None
    is_default: Optional[bool] = None


class StockPoolItemAdd(BaseModel):
    symbol: str = Field(..., description="股票代码")
    name: str = Field(default="", description="股票名称")
    notes: str = Field(default="")
    tags: List[str] = Field(default_factory=list)


class StockPoolItemUpdate(BaseModel):
    notes: Optional[str] = None
    tags: Optional[List[str]] = None


class StockPoolResponse(BaseModel):
    id: int
    name: str
    description: str
    pool_type: str
    color: str
    is_default: bool
    stock_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class StockPoolDetailResponse(BaseModel):
    id: int
    name: str
    description: str
    pool_type: str
    color: str
    is_default: bool
    stocks: List[dict]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class StockPoolListResponse(BaseModel):
    pools: List[StockPoolResponse]
    total: int


# ============== 辅助函数 ==============

def _ensure_tables(db: Session):
    """确保表已创建（动态创建）"""
    Base.metadata.create_all(bind=db.get_bind())


def _get_pool_or_404(db: Session, pool_id: int) -> StockPool:
    pool = db.query(StockPool).filter(StockPool.id == pool_id).first()
    if not pool:
        raise HTTPException(status_code=404, detail=f"股票池 {pool_id} 不存在")
    return pool


# ============== API: 股票池 CRUD ==============

@router.get("", response_model=StockPoolListResponse)
def list_stock_pools(db: Session = Depends(get_db)):
    """
    获取所有股票池列表
    """
    _ensure_tables(db)
    pools = db.query(StockPool).order_by(StockPool.is_default.desc(), StockPool.created_at.desc()).all()

    result = []
    for pool in pools:
        count = db.query(StockPoolItem).filter(StockPoolItem.pool_id == pool.id).count()
        result.append(StockPoolResponse(
            id=pool.id,
            name=pool.name,
            description=pool.description,
            pool_type=pool.pool_type,
            color=pool.color,
            is_default=pool.is_default,
            stock_count=count,
            created_at=pool.created_at,
            updated_at=pool.updated_at,
        ))

    return StockPoolListResponse(pools=result, total=len(result))


@router.post("", response_model=StockPoolResponse, status_code=201)
def create_stock_pool(req: StockPoolCreate, db: Session = Depends(get_db)):
    """
    创建新股票池
    """
    _ensure_tables(db)

    # 如果设为默认，先取消其他默认
    if req.is_default:
        db.query(StockPool).update({StockPool.is_default: False})

    pool = StockPool(
        name=req.name,
        description=req.description,
        pool_type=req.pool_type,
        color=req.color,
        is_default=req.is_default,
    )
    db.add(pool)
    db.commit()
    db.refresh(pool)

    return StockPoolResponse(
        id=pool.id,
        name=pool.name,
        description=pool.description,
        pool_type=pool.pool_type,
        color=pool.color,
        is_default=pool.is_default,
        stock_count=0,
        created_at=pool.created_at,
        updated_at=pool.updated_at,
    )


@router.get("/{pool_id}", response_model=StockPoolDetailResponse)
def get_stock_pool(pool_id: int, db: Session = Depends(get_db)):
    """
    获取股票池详情（含内含股票列表）
    """
    _ensure_tables(db)
    pool = _get_pool_or_404(db, pool_id)

    items = db.query(StockPoolItem).filter(StockPoolItem.pool_id == pool_id).order_by(StockPoolItem.added_at.desc()).all()

    stocks = [
        {
            "id": item.id,
            "symbol": item.symbol,
            "name": item.name,
            "added_at": item.added_at.isoformat() if item.added_at else None,
            "notes": item.notes,
            "tags": item.tags or [],
        }
        for item in items
    ]

    return StockPoolDetailResponse(
        id=pool.id,
        name=pool.name,
        description=pool.description,
        pool_type=pool.pool_type,
        color=pool.color,
        is_default=pool.is_default,
        stocks=stocks,
        created_at=pool.created_at,
        updated_at=pool.updated_at,
    )


@router.put("/{pool_id}", response_model=StockPoolResponse)
def update_stock_pool(pool_id: int, req: StockPoolUpdate, db: Session = Depends(get_db)):
    """
    更新股票池信息
    """
    _ensure_tables(db)
    pool = _get_pool_or_404(db, pool_id)

    if req.is_default is True:
        db.query(StockPool).update({StockPool.is_default: False})

    if req.name is not None:
        pool.name = req.name
    if req.description is not None:
        pool.description = req.description
    if req.pool_type is not None:
        pool.pool_type = req.pool_type
    if req.color is not None:
        pool.color = req.color
    if req.is_default is not None:
        pool.is_default = req.is_default

    db.commit()
    db.refresh(pool)

    count = db.query(StockPoolItem).filter(StockPoolItem.pool_id == pool.id).count()

    return StockPoolResponse(
        id=pool.id,
        name=pool.name,
        description=pool.description,
        pool_type=pool.pool_type,
        color=pool.color,
        is_default=pool.is_default,
        stock_count=count,
        created_at=pool.created_at,
        updated_at=pool.updated_at,
    )


@router.delete("/{pool_id}")
def delete_stock_pool(pool_id: int, db: Session = Depends(get_db)):
    """
    删除股票池（同时删除池内所有股票）
    """
    _ensure_tables(db)
    pool = _get_pool_or_404(db, pool_id)

    # 删除池内股票
    db.query(StockPoolItem).filter(StockPoolItem.pool_id == pool_id).delete()
    # 删除池
    db.delete(pool)
    db.commit()

    return {"message": f"股票池 '{pool.name}' 已删除", "pool_id": pool_id}


# ============== API: 股票池内股票的增删改 ==============

@router.post("/{pool_id}/stocks", status_code=201)
def add_stock_to_pool(pool_id: int, req: StockPoolItemAdd, db: Session = Depends(get_db)):
    """
    添加股票到股票池
    """
    _ensure_tables(db)
    pool = _get_pool_or_404(db, pool_id)

    # 检查是否已存在
    existing = db.query(StockPoolItem).filter(
        StockPoolItem.pool_id == pool_id,
        StockPoolItem.symbol == req.symbol
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail=f"股票 {req.symbol} 已在池中")

    item = StockPoolItem(
        pool_id=pool_id,
        symbol=req.symbol,
        name=req.name or req.symbol,
        notes=req.notes,
        tags=req.tags,
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    return {
        "message": f"股票 {req.symbol} 已添加到池 '{pool.name}'",
        "id": item.id,
        "symbol": item.symbol,
        "name": item.name,
    }


@router.delete("/{pool_id}/stocks/{symbol}")
def remove_stock_from_pool(pool_id: int, symbol: str, db: Session = Depends(get_db)):
    """
    从股票池移除股票
    """
    _ensure_tables(db)
    _get_pool_or_404(db, pool_id)

    item = db.query(StockPoolItem).filter(
        StockPoolItem.pool_id == pool_id,
        StockPoolItem.symbol == symbol
    ).first()

    if not item:
        raise HTTPException(status_code=404, detail=f"股票 {symbol} 不在池中")

    db.delete(item)
    db.commit()

    return {"message": f"股票 {symbol} 已从池中移除"}


@router.put("/{pool_id}/stocks/{symbol}", response_model=dict)
def update_pool_stock(pool_id: int, symbol: str, req: StockPoolItemUpdate, db: Session = Depends(get_db)):
    """
    更新池内股票备注/标签
    """
    _ensure_tables(db)
    _get_pool_or_404(db, pool_id)

    item = db.query(StockPoolItem).filter(
        StockPoolItem.pool_id == pool_id,
        StockPoolItem.symbol == symbol
    ).first()

    if not item:
        raise HTTPException(status_code=404, detail=f"股票 {symbol} 不在池中")

    if req.notes is not None:
        item.notes = req.notes
    if req.tags is not None:
        item.tags = req.tags

    db.commit()
    db.refresh(item)

    return {
        "symbol": item.symbol,
        "name": item.name,
        "notes": item.notes,
        "tags": item.tags or [],
    }


@router.get("/{pool_id}/stocks", response_model=List[dict])
def get_pool_stocks(pool_id: int, db: Session = Depends(get_db)):
    """
    获取股票池内所有股票
    """
    _ensure_tables(db)
    _get_pool_or_404(db, pool_id)

    items = db.query(StockPoolItem).filter(
        StockPoolItem.pool_id == pool_id
    ).order_by(StockPoolItem.added_at.desc()).all()

    return [
        {
            "id": item.id,
            "symbol": item.symbol,
            "name": item.name,
            "added_at": item.added_at.isoformat() if item.added_at else None,
            "notes": item.notes,
            "tags": item.tags or [],
        }
        for item in items
    ]
