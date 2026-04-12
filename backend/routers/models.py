"""Router: AI model configuration management."""
import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ai.chains import AIService
from config import settings
from database import get_db
from models import (
    AIModelConfig as AIModelConfigRecord,
    AIModelConfigRequest,
    AIModelConfigResponse,
)

router = APIRouter(prefix="/api/models", tags=["ai_models"])


def _get_api_protocol(config: AIModelConfigRecord) -> str | None:
    """Read API protocol from stored JSON config."""
    if isinstance(config.config_data, dict):
        protocol = config.config_data.get("api_protocol")
        if isinstance(protocol, str) and protocol:
            return protocol
    return None


def _extract_test_error(result: str) -> str:
    """Extract an actionable error from AI test output."""
    try:
        payload = json.loads(result)
    except json.JSONDecodeError:
        return ""

    if isinstance(payload, dict):
        summary = payload.get("summary")
        if isinstance(summary, str) and summary.startswith("分析失败:"):
            return summary.replace("分析失败:", "", 1).strip()
        error = payload.get("error")
        if isinstance(error, str) and error.strip():
            return error.strip()

    return ""


def _normalize_test_error(error: str) -> dict:
    """Map raw provider errors to user-friendly messages."""
    normalized = error.strip()
    lowered = normalized.lower()

    if any(token in lowered for token in ["429", "quota", "insufficient", "balance", "余额", "限额"]):
        return {
            "error_code": "quota_exceeded",
            "message": "额度不足或请求受限，请检查账户余额、套餐额度或稍后重试。",
            "detail": normalized,
            "error": normalized,
        }

    if any(token in lowered for token in ["404", "not found", "<html>"]):
        return {
            "error_code": "endpoint_protocol_mismatch",
            "message": "接口地址不兼容，请检查 Base URL 是否与所选协议匹配。",
            "detail": normalized,
            "error": normalized,
        }

    if any(token in lowered for token in ["401", "unauthorized", "invalid api key", "invalid_api_key"]):
        return {
            "error_code": "invalid_api_key",
            "message": "API Key 无效，请检查后重新输入。",
            "detail": normalized,
            "error": normalized,
        }

    if any(token in lowered for token in ["timeout", "connection", "network", "ssl", "dns"]):
        return {
            "error_code": "network_error",
            "message": "网络连接失败，请检查网络或稍后重试。",
            "detail": normalized,
            "error": normalized,
        }

    return {
        "error_code": "unknown_error",
        "message": "模型连接测试失败，请检查配置后重试。",
        "detail": normalized,
        "error": normalized,
    }


@router.get("/configs", response_model=list[AIModelConfigResponse])
def list_configs(db: Session = Depends(get_db)):
    """List all AI model configurations."""
    configs = db.query(AIModelConfigRecord).all()
    result = []
    for c in configs:
        result.append(AIModelConfigResponse(
            model_name=c.model_name,
            base_url=c.base_url,
            api_protocol=_get_api_protocol(c),
            is_active=c.is_active,
            has_api_key=bool(c.api_key)
        ))
    return result


@router.post("/configs")
def save_config(req: AIModelConfigRequest, db: Session = Depends(get_db)):
    """Save or update AI model configuration."""
    config = db.query(AIModelConfigRecord).filter(
        AIModelConfigRecord.model_name == req.model_name
    ).first()

    if config:
        config.api_key = req.api_key
        config.base_url = req.base_url or config.base_url
        config.is_active = req.is_active
        config.config_data = {
            **(config.config_data or {}),
            "api_protocol": req.api_protocol,
        }
    else:
        config = AIModelConfigRecord(
            model_name=req.model_name,
            api_key=req.api_key,
            base_url=req.base_url,
            is_active=req.is_active,
            config_data={"api_protocol": req.api_protocol},
        )
        db.add(config)

    # If activating this model, deactivate others
    if req.is_active:
        db.query(AIModelConfigRecord).filter(
            AIModelConfigRecord.model_name != req.model_name
        ).update({"is_active": False})

    db.commit()
    return {"message": "配置已保存", "model": req.model_name, "active": req.is_active}


@router.post("/configs/{model_name}/activate")
def activate_model(model_name: str, db: Session = Depends(get_db)):
    """Activate a specific AI model."""
    config = db.query(AIModelConfigRecord).filter(
        AIModelConfigRecord.model_name == model_name
    ).first()

    if not config:
        raise HTTPException(status_code=404, detail="模型配置不存在")

    # Deactivate all
    db.query(AIModelConfigRecord).update({"is_active": False})
    config.is_active = True
    db.commit()

    return {"message": f"{model_name} 已激活"}


@router.get("/configs/active")
def get_active_config(db: Session = Depends(get_db)):
    """Get the currently active AI model config."""
    config = db.query(AIModelConfigRecord).filter(
        AIModelConfigRecord.is_active == True
    ).first()

    if not config:
        return {"model_name": settings.default_model, "is_active": True}

    return {
        "model_name": config.model_name,
        "base_url": config.base_url,
        "api_protocol": _get_api_protocol(config),
        "is_active": True
    }


@router.post("/test")
def test_model(
    model_name: str,
    api_key: str = "",
    base_url: str = "",
    api_protocol: str = "",
):
    """Test if an AI model configuration works."""
    try:
        service = AIService(
            model_name=model_name,
            api_key=api_key,
            base_url=base_url,
            api_protocol=api_protocol,
        )
        # Simple test
        result = service.analyze_technicals("000001", {
            "current_price": 12.0,
            "indicators": {"MA5": 11.8, "MA20": 11.5},
            "recent_klines": []
        })
        error = _extract_test_error(result)
        if error:
            return {"success": False, "model": model_name, **_normalize_test_error(error)}
        return {"success": True, "model": model_name, "response": result[:100]}
    except Exception as e:
        return {"success": False, "model": model_name, **_normalize_test_error(str(e))}
