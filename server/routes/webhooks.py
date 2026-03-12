import hashlib
import hmac
import json
import threading
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, HttpUrl
from typing import List, Optional
from sqlalchemy.orm import Session
from server.database import get_db
from server.models import OutboundWebhook, User
from server.auth import get_current_user, require_admin

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])

ALLOWED_EVENTS = [
    "company.created",
    "company.stage_changed",
    "company.enriched",
    "collection.completed",
    "member.invited",
    "member.joined",
]


class WebhookCreate(BaseModel):
    name: str
    url: str
    secret: Optional[str] = None
    events: List[str] = []
    is_active: bool = True


class WebhookUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    secret: Optional[str] = None
    events: Optional[List[str]] = None
    is_active: Optional[bool] = None


@router.get("")
def list_webhooks(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    hooks = db.query(OutboundWebhook).filter(OutboundWebhook.org_id == current_user.org_id).all()
    return [_hook_to_dict(h) for h in hooks]


@router.post("")
def create_webhook(
    body: WebhookCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if not body.url.startswith("https://") and not body.url.startswith("http://"):
        raise HTTPException(status_code=400, detail="URLは http:// または https:// から始まる必要があります")
    invalid = [e for e in body.events if e not in ALLOWED_EVENTS]
    if invalid:
        raise HTTPException(status_code=400, detail=f"不正なイベント: {', '.join(invalid)}")
    hook = OutboundWebhook(
        org_id=current_user.org_id,
        name=body.name,
        url=body.url,
        secret=body.secret,
        events=body.events,
        is_active=body.is_active,
    )
    db.add(hook)
    db.commit()
    db.refresh(hook)
    return _hook_to_dict(hook)


@router.put("/{hook_id}")
def update_webhook(
    hook_id: int,
    body: WebhookUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    hook = db.query(OutboundWebhook).filter(
        OutboundWebhook.id == hook_id,
        OutboundWebhook.org_id == current_user.org_id,
    ).first()
    if not hook:
        raise HTTPException(status_code=404, detail="Webhookが見つかりません")
    if body.name is not None:
        hook.name = body.name
    if body.url is not None:
        hook.url = body.url
    if body.secret is not None:
        hook.secret = body.secret
    if body.events is not None:
        invalid = [e for e in body.events if e not in ALLOWED_EVENTS]
        if invalid:
            raise HTTPException(status_code=400, detail=f"不正なイベント: {', '.join(invalid)}")
        hook.events = body.events
    if body.is_active is not None:
        hook.is_active = body.is_active
    db.commit()
    db.refresh(hook)
    return _hook_to_dict(hook)


@router.delete("/{hook_id}")
def delete_webhook(
    hook_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    hook = db.query(OutboundWebhook).filter(
        OutboundWebhook.id == hook_id,
        OutboundWebhook.org_id == current_user.org_id,
    ).first()
    if not hook:
        raise HTTPException(status_code=404, detail="Webhookが見つかりません")
    db.delete(hook)
    db.commit()
    return {"message": "削除しました"}


@router.post("/{hook_id}/test")
def test_webhook(
    hook_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    hook = db.query(OutboundWebhook).filter(
        OutboundWebhook.id == hook_id,
        OutboundWebhook.org_id == current_user.org_id,
    ).first()
    if not hook:
        raise HTTPException(status_code=404, detail="Webhookが見つかりません")
    payload = {
        "event": "test",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "data": {"message": "LeadHive Webhook テスト送信"},
    }
    status_code, error = _send_webhook(hook, payload)
    hook.last_triggered_at = datetime.utcnow()
    hook.last_status_code = status_code
    if error or (status_code and status_code >= 400):
        hook.failure_count = (hook.failure_count or 0) + 1
    else:
        hook.failure_count = 0
    db.commit()
    if error:
        return {"success": False, "error": error}
    return {"success": True, "status_code": status_code}


@router.get("/events")
def list_events(current_user: User = Depends(get_current_user)):
    return {"events": ALLOWED_EVENTS}


def _hook_to_dict(h: OutboundWebhook) -> dict:
    return {
        "id": h.id,
        "name": h.name,
        "url": h.url,
        "has_secret": bool(h.secret),
        "events": h.events or [],
        "is_active": h.is_active,
        "created_at": h.created_at.isoformat() if h.created_at else None,
        "last_triggered_at": h.last_triggered_at.isoformat() if h.last_triggered_at else None,
        "last_status_code": h.last_status_code,
        "failure_count": h.failure_count,
    }


def _send_webhook(hook: OutboundWebhook, payload: dict):
    import urllib.request, urllib.error
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    headers = {"Content-Type": "application/json", "User-Agent": "LeadHive-Webhook/1.0"}
    if hook.secret:
        sig = hmac.new(hook.secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
        headers["X-LeadHive-Signature"] = f"sha256={sig}"
    req = urllib.request.Request(hook.url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status, None
    except urllib.error.HTTPError as e:
        return e.code, str(e)
    except Exception as e:
        return None, str(e)


def fire_event(db: Session, org_id: int, event: str, data: dict):
    hooks = db.query(OutboundWebhook).filter(
        OutboundWebhook.org_id == org_id,
        OutboundWebhook.is_active == True,
    ).all()
    active = [h for h in hooks if event in (h.events or [])]
    if not active:
        return
    payload = {
        "event": event,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "org_id": org_id,
        "data": data,
    }

    def _dispatch():
        from server.database import SessionLocal
        _db = SessionLocal()
        try:
            for hook in active:
                status_code, error = _send_webhook(hook, payload)
                db_hook = _db.query(OutboundWebhook).filter(OutboundWebhook.id == hook.id).first()
                if db_hook:
                    db_hook.last_triggered_at = datetime.utcnow()
                    db_hook.last_status_code = status_code
                    if error or (status_code and status_code >= 400):
                        db_hook.failure_count = (db_hook.failure_count or 0) + 1
                    else:
                        db_hook.failure_count = 0
                    _db.commit()
        except Exception as exc:
            logger.error("Webhook dispatch error: %s", exc)
        finally:
            _db.close()

    threading.Thread(target=_dispatch, daemon=True).start()
