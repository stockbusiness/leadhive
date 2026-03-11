import logging
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from server.database import get_db
from server.auth import require_system_admin
from server.models import SystemSettings
from server.services.encryption import encrypt_value, decrypt_value, should_encrypt

router = APIRouter(tags=["admin_hubsrev"])
logger = logging.getLogger(__name__)

HUBSREV_KEYS = ["hubsrev_enabled", "hubsrev_webhook_url", "hubsrev_api_key"]


def _get(db: Session, key: str) -> str:
    row = db.query(SystemSettings).filter(SystemSettings.key == key).first()
    if not row or not row.value:
        return ""
    return decrypt_value(row.value)


def _set(db: Session, key: str, value: str):
    row = db.query(SystemSettings).filter(SystemSettings.key == key).first()
    stored = encrypt_value(value) if should_encrypt(key) and value else value
    if row:
        row.value = stored
    else:
        db.add(SystemSettings(key=key, value=stored))


@router.get("/api/admin/hubsrev/settings")
def get_hubsrev_settings(
    current_user=Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    api_key_raw = _get(db, "hubsrev_api_key")
    masked_key = ""
    if api_key_raw:
        if len(api_key_raw) <= 8:
            masked_key = "****"
        else:
            masked_key = api_key_raw[:6] + "*" * (len(api_key_raw) - 10) + api_key_raw[-4:]

    return {
        "hubsrev_enabled": _get(db, "hubsrev_enabled") or "true",
        "hubsrev_webhook_url": _get(db, "hubsrev_webhook_url"),
        "hubsrev_api_key_set": bool(api_key_raw),
        "hubsrev_api_key_masked": masked_key,
    }


class HubsrevSettingsBody(BaseModel):
    hubsrev_enabled: Optional[str] = None
    hubsrev_webhook_url: Optional[str] = None
    hubsrev_api_key: Optional[str] = None


@router.put("/api/admin/hubsrev/settings")
def save_hubsrev_settings(
    body: HubsrevSettingsBody,
    current_user=Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    if body.hubsrev_enabled is not None:
        _set(db, "hubsrev_enabled", body.hubsrev_enabled)
    if body.hubsrev_webhook_url is not None:
        _set(db, "hubsrev_webhook_url", body.hubsrev_webhook_url.strip())
    if body.hubsrev_api_key is not None and body.hubsrev_api_key.strip():
        _set(db, "hubsrev_api_key", body.hubsrev_api_key.strip())
    db.commit()
    return {"message": "Hubsrev設定を保存しました"}


@router.post("/api/admin/hubsrev/test")
def test_hubsrev(
    current_user=Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    from server.services.hubsrev import send_to_hubsrev
    ok = send_to_hubsrev(
        db,
        sender_name="LeadHive テスト",
        sender_email="test@leadhive.work",
        sender_company="COOLWORKS株式会社",
        subject="【テスト送信】LeadHive Hubsrev 連携確認",
        body_text="これはLeadHiveからのWebhookテスト送信です。正常に受信できていれば連携は成功しています。",
        source_system="LeadHive",
        source_type="form",
    )
    if ok:
        return {"message": "テスト送信に成功しました。Hubsrevの受信ボックスをご確認ください。"}
    from fastapi import HTTPException
    raise HTTPException(status_code=400, detail="送信に失敗しました。WebhookURLとAPIキーを確認してください。")
