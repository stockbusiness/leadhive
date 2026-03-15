import logging
from datetime import datetime
from fastapi import APIRouter, Depends, Request, Header
from pydantic import BaseModel
from typing import Optional, Any, Dict, List
from sqlalchemy.orm import Session
from server.database import get_db
from server.auth import require_system_admin
from server.models import SystemSettings, HubsrevEventLog, SystemLog
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
    data = payload.get("data") or {}
    logger.info(f"Hubsrev inbound webhook 受信: event={event} payload={_json.dumps(payload, ensure_ascii=False)[:300]}")

    # ── イベントログをDBに保存 ──────────────────────────────────────────
    try:
        ev_log = HubsrevEventLog(
            event=event,
            ticket_id=data.get("ticketId"),
            ticket_no=data.get("ticketNo"),
            subject=data.get("subject"),
            customer_name=data.get("customerName"),
            payload=payload,
        )
        db.add(ev_log)
        # 重要イベントはSystemLogにも記録
        if event in ("ticket.created", "ticket.replied", "ticket.status_changed", "ticket.resolved", "inbox.item_created"):
            label = {
                "ticket.created": "新規チケット作成",
                "ticket.replied": "チケット返信",
                "ticket.status_changed": "チケットステータス変更",
                "ticket.resolved": "チケット解決",
                "inbox.item_created": "受信ボックス新規アイテム",
            }.get(event, event)
            detail = f"{label}: {data.get('ticketNo') or data.get('ticketId') or ''} {data.get('subject') or data.get('customerName') or ''}"
            db.add(SystemLog(
                action="hubsrev_event",
                actor_email="Hubsrev",
                actor_org="Hubsrev",
                target=event,
                detail=detail.strip(),
            ))
        db.commit()
    except Exception as e:
        logger.error(f"Hubsrev inbound: DBへの保存に失敗: {e}")
        db.rollback()

    return {"ok": True, "received": event}


# ─── 受信イベント一覧 ──────────────────────────────────────────────────────────

@router.get("/api/admin/hubsrev/events")
def get_hubsrev_events(
    limit: int = 50,
    current_user=Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(HubsrevEventLog)
        .order_by(HubsrevEventLog.received_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": r.id,
            "event": r.event,
            "ticket_id": r.ticket_id,
            "ticket_no": r.ticket_no,
            "subject": r.subject,
            "customer_name": r.customer_name,
            "received_at": r.received_at.isoformat() if r.received_at else None,
        }
        for r in rows
    ]
