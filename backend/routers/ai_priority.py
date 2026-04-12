"""Router: AI模型优先级管理（拖拽排序持久化）."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from database import get_db
from models import AIModelPriority, AIModelPriorityResponse, AIModelPriorityUpdateRequest

router = APIRouter(prefix="/api/ai-model-priority", tags=["ai_priority"])

DEFAULT_PRIORITY = ["minimax", "zhipu", "claude", "gemini"]


def _ensure_default_priority(db: Session) -> None:
    """Ensure default priority records exist."""
    existing = db.query(AIModelPriority).all()
    if not existing:
        for i, model_id in enumerate(DEFAULT_PRIORITY):
            record = AIModelPriority(
                model_id=model_id,
                priority_order=i,
                config_json={},
            )
            db.add(record)
        db.commit()


@router.get("", response_model=AIModelPriorityResponse)
def get_priority(db: Session = Depends(get_db)):
    """Get current AI model priority order."""
    _ensure_default_priority(db)
    records = db.query(AIModelPriority).order_by(AIModelPriority.priority_order).all()
    return AIModelPriorityResponse(priority=[r.model_id for r in records])


@router.put("")
def update_priority(req: AIModelPriorityUpdateRequest, db: Session = Depends(get_db)):
    """Update AI model priority order (drag-and-drop save)."""
    _ensure_default_priority(db)

    # Validate all model_ids are known
    known_models = set(DEFAULT_PRIORITY)
    for model_id in req.priority:
        if model_id not in known_models:
            raise HTTPException(status_code=400, detail=f"未知模型: {model_id}")

    # Update priority orders
    for order, model_id in enumerate(req.priority):
        record = db.query(AIModelPriority).filter(
            AIModelPriority.model_id == model_id
        ).first()
        if record:
            record.priority_order = order

    db.commit()
    return {"message": "优先级已保存", "priority": req.priority}
