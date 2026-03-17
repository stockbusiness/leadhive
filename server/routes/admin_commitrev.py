import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from server.database import get_db
from server.auth import require_system_admin
from server.models import SystemSettings
from server.services.encryption import encrypt_value, decrypt_value, should_encrypt

router = APIRouter(tags=["admin_commitrev"])
logger = logging.getLogger(__name__)

COMMITREV_KEYS = [
    "commitrev_api_key",
    "commitrev_hmac_secret",
    "commitrev_tenant_id",
    "commitrev_product_code",
    "commitrev_base_url",
    "commitrev_partner_apply_url",
]


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


@router.get("/api/admin/commitrev/settings")
def get_commitrev_settings(
    current_user=Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    api_key_raw = _get(db, "commitrev_api_key")
    hmac_raw = _get(db, "commitrev_hmac_secret")
    partner_url = _get(db, "commitrev_partner_apply_url")
    return {
        "commitrev_api_key": {"value": _mask(api_key_raw), "is_set": bool(api_key_raw)},
        "commitrev_hmac_secret": {"value": _mask(hmac_raw), "is_set": bool(hmac_raw)},
        "commitrev_tenant_id": {"value": _get(db, "commitrev_tenant_id"), "is_set": bool(_get(db, "commitrev_tenant_id"))},
        "commitrev_product_code": {"value": _get(db, "commitrev_product_code"), "is_set": bool(_get(db, "commitrev_product_code"))},
        "commitrev_base_url": {"value": _get(db, "commitrev_base_url") or "https://app.commitrev.com", "is_set": True},
        "commitrev_partner_apply_url": {"value": partner_url, "is_set": bool(partner_url)},
    }


@router.put("/api/admin/commitrev/settings")
def update_commitrev_settings(
    data: dict,
    current_user=Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    for key in COMMITREV_KEYS:
        val = data.get(key)
        if val is None:
            continue
        if val == "" or (isinstance(val, str) and all(c == "*" for c in val)):
            continue
        _set(db, key, val)
    db.commit()
    return {"message": "CommitRev設定を保存しました"}


@router.post("/api/admin/commitrev/test")
def test_commitrev(
    current_user=Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    from server.services.commitrev import send_event
    try:
        ok = send_event(
            db=db,
            event_type="lead_created",
            idempotency_key="commitrev_test_connection",
            customer_id="test@leadhive.work",
            extra_payload={"test": True},
        )
        if ok:
            return {"success": True, "message": "CommitRevへの接続テストに成功しました"}
        else:
            return {"success": False, "message": "イベント送信に失敗しました。設定内容を確認してください"}
    except Exception as e:
        logger.error("CommitRev test error: %s", e)
        return {"success": False, "message": f"エラー: {e}"}
