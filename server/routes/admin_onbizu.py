import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from server.database import get_db
from server.auth import require_system_admin
from server.models import SystemSettings
from server.services.encryption import encrypt_value, decrypt_value, should_encrypt

router = APIRouter(tags=["admin_onbizu"])
logger = logging.getLogger(__name__)

ONBIZU_KEYS = [
    "onbizu_base_url",
    "onbizu_product_key",
    "onbizu_webhook_secret",
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
    return raw[:4] + "*" * (len(raw) - 8) + raw[-4:]


@router.get("/api/admin/onbizu/settings")
def get_onbizu_settings(
    current_user=Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    secret_raw = _get(db, "onbizu_webhook_secret")
    return {
        "onbizu_base_url": {
            "value": _get(db, "onbizu_base_url"),
            "is_set": bool(_get(db, "onbizu_base_url")),
        },
        "onbizu_product_key": {
            "value": _get(db, "onbizu_product_key"),
            "is_set": bool(_get(db, "onbizu_product_key")),
        },
        "onbizu_webhook_secret": {
            "value": _mask(secret_raw),
            "is_set": bool(secret_raw),
        },
    }


@router.put("/api/admin/onbizu/settings")
def update_onbizu_settings(
    data: dict,
    current_user=Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    for key in ONBIZU_KEYS:
        val = data.get(key)
        if val is None:
            continue
        if isinstance(val, str) and val.strip() == "":
            continue
        if isinstance(val, str) and all(c == "*" for c in val) and val:
            continue
        _set(db, key, val)
    db.commit()
    return {"message": "Onbizu設定を保存しました"}


@router.post("/api/admin/onbizu/test")
def test_onbizu(
    current_user=Depends(require_system_admin),
    db: Session = Depends(get_db),
):
    from server.services.onbizu import send_event
    try:
        ok = send_event(
            db=db,
            event_type="user_login",
            external_user_id="test_leadhive_admin",
            email="admin@leadhive.work",
            display_name="LeadHive Test",
            idempotency_key="onbizu_test_connection",
        )
        if ok:
            return {"success": True, "message": "Onbizuへの接続テストに成功しました"}
        else:
            return {"success": False, "message": "送信に失敗しました。ベースURL・プロダクトキー・シークレットを確認してください"}
    except Exception as e:
        logger.error("Onbizu test error: %s", e)
        return {"success": False, "message": f"エラー: {e}"}
