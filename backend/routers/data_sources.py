"""Router: 多行情数据源管理."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import (
    DataSource as DataSourceModel,
    DataSourceItem,
    DataSourceResponse,
    DataSourceUpdateRequest,
)

router = APIRouter(prefix="/api/data-sources", tags=["data_sources"])


@router.get("", response_model=DataSourceResponse)
def list_data_sources(db: Session = Depends(get_db)):
    """List all available data sources and their enabled status."""
    records = db.query(DataSourceModel).order_by(DataSourceModel.priority).all()
    sources = [
        DataSourceItem(
            id=r.id,
            name=r.name,
            enabled=r.enabled,
            priority=r.priority,
            status="available",
        )
        for r in records
    ]
    return DataSourceResponse(sources=sources)


@router.put("/{source_id}")
def update_data_source(source_id: str, req: DataSourceUpdateRequest, db: Session = Depends(get_db)):
    """Enable or disable a data source."""
    record = db.query(DataSourceModel).filter(DataSourceModel.id == source_id).first()
    if not record:
        raise HTTPException(status_code=404, detail=f"数据源 '{source_id}' 不存在")

    record.enabled = req.enabled
    db.commit()

    # Sync to in-memory manager
    from data_sources.manager import get_ds_manager
    get_ds_manager().set_enabled(source_id, req.enabled)

    return {
        "message": f"{'启用' if req.enabled else '禁用'}成功",
        "source_id": source_id,
        "enabled": req.enabled,
    }
