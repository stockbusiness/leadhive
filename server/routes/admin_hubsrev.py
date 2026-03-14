import logging
from fastapi import APIRouter, Depends, Request, Header
from pydantic import BaseModel
from typing import Optional, Any, Dict
from sqlalchemy.orm import Session
from server.database import get_db
from server.auth import require_system_admin
from server.models import SystemSettings
from server.services.encryption import encrypt_value, decrypt_value, should_encrypt

router = APIRouter(tags=["admin_hubsrev"])
logger = logging.getLogger(__name__)

HUBSREV_KEYS = ["hubsrev_enabled", "hubsrev_webhook_url", "hubsrev_api_key", "hubsrev_webhook_secret"]


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


def _mask(raw: str) -> str:
    if not raw:
        return ""
    if len(raw) <= 8:
        return "****"
    return raw[:6] + "*" * (len(raw) - 10) + raw[-4:]


@router.get("/api/admin/hubsrev/settings")
def get_hubsrev_settings(
    current_user=Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    api_key_raw = _get(db, "hubsrev_api_key")
    secret_raw = _get(db, "hubsrev_webhook_secret")

    return {
        "hubsrev_enabled": _get(db, "hubsrev_enabled") or "true",
        "hubsrev_webhook_url": _get(db, "hubsrev_webhook_url"),
        "hubsrev_api_key_set": bool(api_key_raw),
        "hubsrev_api_key_masked": _mask(api_key_raw),
        "hubsrev_webhook_secret_set": bool(secret_raw),
        "hubsrev_webhook_secret_masked": _mask(secret_raw),
    }


class HubsrevSettingsBody(BaseModel):
    hubsrev_enabled: Optional[str] = None
    hubsrev_webhook_url: Optional[str] = None
    hubsrev_api_key: Optional[str] = None
    hubsrev_webhook_secret: Optional[str] = None


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
    if body.hubsrev_webhook_secret is not None and body.hubsrev_webhook_secret.strip():
        _set(db, "hubsrev_webhook_secret", body.hubsrev_webhook_secret.strip())
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


# ─── Hubsrev → LeadHive 受信Webhook ─────────────────────────────────────────

@router.post("/api/webhooks/hubsrev")
async def hubsrev_inbound_webhook(
    request: Request,
    authorization: Optional[str] = Header(None),
    x_hubsrev_signature: Optional[str] = Header(None, alias="x-hubsrev-signature"),
    x_hub_signature_256: Optional[str] = Header(None, alias="x-hub-signature-256"),
    db: Session = Depends(get_db),
):
    """
    Hubsrev の Outbound Webhook を受信するエンドポイント。
    Hubsrev管理画面 → Webhook設定 → エンドポイントURL に
    https://leadhive.work/api/webhooks/hubsrev を設定してください。
    """
    import json as _json
    import hmac as _hmac
    import hashlib as _hashlib
    from fastapi import HTTPException

    # ── 生ボディ取得（署名検証のため先に読む） ─────────────────────────
    raw_body = await request.body()

    # ── 署名シークレットによる検証（設定済みの場合のみ） ──────────────
    stored_secret = _get(db, "hubsrev_webhook_secret").strip()
    if stored_secret:
        sig_header = x_hubsrev_signature or x_hub_signature_256 or ""
        # "sha256=xxxxxx" 形式に対応
        sig_value = sig_header.removeprefix("sha256=").strip()
        expected = _hmac.new(
            stored_secret.encode(), raw_body, _hashlib.sha256
        ).hexdigest()
        if not _hmac.compare_digest(expected, sig_value):
            logger.warning(f"Hubsrev inbound: 署名検証失敗 header={sig_header!r}")
            raise HTTPException(status_code=401, detail="Invalid signature")

    # ── ペイロード取得 ──────────────────────────────────────────────────
    try:
        payload: Dict[str, Any] = _json.loads(raw_body)
    except Exception:
        payload = {}

    event = payload.get("event") or payload.get("type") or "unknown"
    logger.info(f"Hubsrev inbound webhook 受信: event={event} payload={_json.dumps(payload, ensure_ascii=False)[:300]}")

    return {"ok": True, "received": event}
