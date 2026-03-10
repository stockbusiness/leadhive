import hmac
import hashlib
import json
import logging
import requests
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def _get_setting(db: Session, key: str) -> Optional[str]:
    from server.models import SystemSettings
    from server.services.encryption import decrypt_value
    row = db.query(SystemSettings).filter(SystemSettings.key == key).first()
    if not row or not row.value:
        return None
    return decrypt_value(row.value)


def _get_commitrev_config(db: Session) -> Optional[dict]:
    hmac_secret = _get_setting(db, "commitrev_hmac_secret")
    tenant_id = _get_setting(db, "commitrev_tenant_id")
    product_code = _get_setting(db, "commitrev_product_code")
    base_url = _get_setting(db, "commitrev_base_url") or "https://app.commitrev.com"
    if not hmac_secret or not tenant_id or not product_code:
        return None
    return {
        "hmac_secret": hmac_secret,
        "tenant_id": tenant_id,
        "product_code": product_code,
        "base_url": base_url.rstrip("/"),
    }


def _sign(secret: str, body: str) -> str:
    return hmac.new(secret.encode("utf-8"), body.encode("utf-8"), hashlib.sha256).hexdigest()


def send_event(
    db: Session,
    event_type: str,
    idempotency_key: str,
    extra_payload: Optional[dict] = None,
) -> bool:
    config = _get_commitrev_config(db)
    if not config:
        logger.debug("CommitRev not configured, skipping event: %s", event_type)
        return False

    payload = {
        "event_type": event_type,
        "idempotency_key": idempotency_key,
        "event_time": datetime.now(timezone.utc).isoformat(),
        "product_code": config["product_code"],
        "tenant_id": int(config["tenant_id"]),
    }
    if extra_payload:
        payload["payload"] = extra_payload

    body = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    signature = _sign(config["hmac_secret"], body)

    url = f"{config['base_url']}/v1/events"
    headers = {
        "Content-Type": "application/json",
        "x-signature": signature,
        "x-tenant-id": config["tenant_id"],
    }

    try:
        resp = requests.post(url, data=body.encode("utf-8"), headers=headers, timeout=10)
        if resp.status_code in (200, 201):
            logger.info("CommitRev event sent: %s (idempotency_key=%s) -> %s", event_type, idempotency_key, resp.status_code)
            return True
        else:
            logger.warning("CommitRev event failed: %s %s -> %s %s", event_type, idempotency_key, resp.status_code, resp.text[:200])
            return False
    except Exception as e:
        logger.error("CommitRev request error: %s", e)
        return False


def send_lead_created(db: Session, user_id: int, email: str, org_name: str = "") -> bool:
    return send_event(
        db=db,
        event_type="lead_created",
        idempotency_key=f"user_{user_id}",
        extra_payload={"email": email, "org_name": org_name},
    )


def send_purchase_completed(db: Session, org_id: int, plan_name: str, stripe_session_id: str) -> bool:
    return send_event(
        db=db,
        event_type="purchase_completed",
        idempotency_key=f"stripe_{stripe_session_id}",
        extra_payload={"org_id": org_id, "plan_name": plan_name},
    )
