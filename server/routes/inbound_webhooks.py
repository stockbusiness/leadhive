import logging
import secrets
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from server.database import get_db
from server.auth import require_admin
from server.models import InboundWebhookSource

router = APIRouter(tags=["inbound_webhooks"])
logger = logging.getLogger(__name__)


def _serialize(row: InboundWebhookSource) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "sourceKey": row.source_key,
        "enabled": row.enabled,
        "nameField": row.name_field,
        "emailField": row.email_field,
        "companyField": row.company_field,
        "phoneField": row.phone_field,
        "messageField": row.message_field,
        "totalReceived": row.total_received,
        "lastReceivedAt": row.last_received_at.isoformat() if row.last_received_at else None,
        "createdAt": row.created_at.isoformat() if row.created_at else None,
    }


class WebhookSourceBody(BaseModel):
    name: str
    enabled: Optional[bool] = True
    nameField: Optional[str] = None
    emailField: Optional[str] = None
    companyField: Optional[str] = None
    phoneField: Optional[str] = None
    messageField: Optional[str] = None


class WebhookSourceUpdateBody(BaseModel):
    name: Optional[str] = None
    enabled: Optional[bool] = None
    nameField: Optional[str] = None
    emailField: Optional[str] = None
    companyField: Optional[str] = None
    phoneField: Optional[str] = None
    messageField: Optional[str] = None


@router.get("/api/admin/inbound-webhooks")
def list_inbound_webhooks(
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(InboundWebhookSource)
        .filter(InboundWebhookSource.org_id == current_user.org_id)
        .order_by(InboundWebhookSource.created_at.desc())
        .all()
    )
    return [_serialize(r) for r in rows]


@router.post("/api/admin/inbound-webhooks", status_code=201)
def create_inbound_webhook(
    body: WebhookSourceBody,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    source_key = secrets.token_hex(24)
    row = InboundWebhookSource(
        org_id=current_user.org_id,
        name=body.name.strip(),
        source_key=source_key,
        enabled=body.enabled if body.enabled is not None else True,
        name_field=body.nameField,
        email_field=body.emailField,
        company_field=body.companyField,
        phone_field=body.phoneField,
        message_field=body.messageField,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _serialize(row)


@router.put("/api/admin/inbound-webhooks/{webhook_id}")
def update_inbound_webhook(
    webhook_id: int,
    body: WebhookSourceUpdateBody,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    row = db.query(InboundWebhookSource).filter(
        InboundWebhookSource.id == webhook_id,
        InboundWebhookSource.org_id == current_user.org_id,
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Webhookソースが見つかりません")
    if body.name is not None:
        row.name = body.name.strip()
    if body.enabled is not None:
        row.enabled = body.enabled
    if body.nameField is not None:
        row.name_field = body.nameField
    if body.emailField is not None:
        row.email_field = body.emailField
    if body.companyField is not None:
        row.company_field = body.companyField
    if body.phoneField is not None:
        row.phone_field = body.phoneField
    if body.messageField is not None:
        row.message_field = body.messageField
    db.commit()
    return _serialize(row)


@router.delete("/api/admin/inbound-webhooks/{webhook_id}")
def delete_inbound_webhook(
    webhook_id: int,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    row = db.query(InboundWebhookSource).filter(
        InboundWebhookSource.id == webhook_id,
        InboundWebhookSource.org_id == current_user.org_id,
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Webhookソースが見つかりません")
    db.delete(row)
    db.commit()
    return {"message": "削除しました"}
