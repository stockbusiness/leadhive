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
    api_key = _get_setting(db, "commitrev_api_key")
    hmac_secret = _get_setting(db, "commitrev_hmac_secret")
    tenant_id = _get_setting(db, "commitrev_tenant_id")
    product_code = _get_setting(db, "commitrev_product_code")
    base_url = _get_setting(db, "commitrev_base_url") or "https://app.commitrev.com"

    if not product_code:
        return None
    if not api_key and not (hmac_secret and tenant_id):
        return None

    return {
        "api_key": api_key,
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
    customer_id: Optional[str] = None,
    amount: Optional[int] = None,
    extra_payload: Optional[dict] = None,
) -> bool:
    config = _get_commitrev_config(db)
    if not config:
        logger.debug("CommitRev not configured, skipping event: %s", event_type)
        return False

    event_payload: dict = {}
    if customer_id:
        event_payload["customer_id"] = customer_id
    if amount is not None:
        event_payload["amount"] = amount
    if extra_payload:
        event_payload.update(extra_payload)

    body_dict: dict = {
        "event_type": event_type,
        "idempotency_key": idempotency_key,
        "event_time": datetime.now(timezone.utc).isoformat(),
        "product_code": config["product_code"],
    }
    if config.get("tenant_id"):
        body_dict["tenant_id"] = int(config["tenant_id"])
    if event_payload:
        body_dict["payload"] = event_payload

    body = json.dumps(body_dict, separators=(",", ":"), ensure_ascii=False)
    url = f"{config['base_url']}/v1/events"

    if config.get("api_key"):
        headers = {
            "Content-Type": "application/json",
            "X-Api-Key": config["api_key"],
        }
    else:
        signature = _sign(config["hmac_secret"], body)
        headers = {
            "Content-Type": "application/json",
            "x-signature": signature,
            "x-tenant-id": config["tenant_id"],
        }

    try:
        resp = requests.post(url, data=body.encode("utf-8"), headers=headers, timeout=10)
        if resp.status_code in (200, 201):
            logger.info(
                "CommitRev event sent: %s idempotency_key=%s -> %s",
                event_type, idempotency_key, resp.status_code,
            )
            return True
        else:
            logger.warning(
                "CommitRev event failed: %s %s -> %s %s",
                event_type, idempotency_key, resp.status_code, resp.text[:200],
            )
            return False
    except Exception as e:
        logger.error("CommitRev request error: %s", e)
        return False


def send_lead_created(db: Session, user_id: int, email: str, org_name: str = "") -> bool:
    return send_event(
        db=db,
        event_type="lead_created",
        idempotency_key=f"user_{user_id}",
        customer_id=email,
        extra_payload={"org_name": org_name},
    )


def send_contract_signed(
    db: Session,
    org_id: int,
    user_email: str,
    plan_name: str,
    stripe_session_id: str,
    amount: Optional[int] = None,
) -> bool:
    return send_event(
        db=db,
        event_type="contract_signed",
        idempotency_key=f"contract-{stripe_session_id}",
        customer_id=user_email,
        amount=amount,
        extra_payload={"org_id": org_id, "plan_name": plan_name},
    )


def send_plan_conversion(
    db: Session,
    org_id: int,
    user_email: str,
    plan_name: str,
    stripe_session_id: str,
    amount: Optional[int] = None,
) -> bool:
    return send_event(
        db=db,
        event_type="plan_conversion",
        idempotency_key=f"upsell-{stripe_session_id}",
        customer_id=user_email,
        amount=amount,
        extra_payload={"org_id": org_id, "plan_name": plan_name},
    )


def send_monthly_renewal(
    db: Session,
    org_id: int,
    user_email: str,
    invoice_id: str,
    amount: Optional[int] = None,
    year_month: Optional[str] = None,
) -> bool:
    ym = year_month or datetime.now(timezone.utc).strftime("%Y-%m")
    return send_event(
        db=db,
        event_type="monthly_renewal",
        idempotency_key=f"renewal-{user_email}-{ym}",
        customer_id=user_email,
        amount=amount,
        extra_payload={"org_id": org_id, "invoice_id": invoice_id},
    )


def send_purchase_completed(db: Session, org_id: int, plan_name: str, stripe_session_id: str) -> bool:
    return send_event(
        db=db,
        event_type="purchase_completed",
        idempotency_key=f"stripe_{stripe_session_id}",
        extra_payload={"org_id": org_id, "plan_name": plan_name},
    )


def send_lp_lead_created(
    db: Session,
    inquiry_id: int,
    email: Optional[str] = None,
    company_name: Optional[str] = None,
    org_id: Optional[int] = None,
) -> bool:
    """LP資料請求受信時に lead_created イベントを送信する。"""
    return send_event(
        db=db,
        event_type="lead_created",
        idempotency_key=f"lp_inquiry_{inquiry_id}",
        customer_id=email or f"inquiry_{inquiry_id}",
        extra_payload={
            "inquiry_id": inquiry_id,
            "company_name": company_name or "",
            "org_id": org_id,
            "source": "lp_document_request",
        },
    )


def send_lp_plan_conversion(
    db: Session,
    inquiry_id: int,
    email: Optional[str] = None,
    company_name: Optional[str] = None,
    org_id: Optional[int] = None,
    amount: Optional[int] = None,
) -> bool:
    """LP経由のアップセル成約（closed_won の2回目以降）に plan_conversion イベントを送信する。"""
    return send_event(
        db=db,
        event_type="plan_conversion",
        idempotency_key=f"lp_upsell_{inquiry_id}",
        customer_id=email or f"inquiry_{inquiry_id}",
        amount=amount,
        extra_payload={
            "inquiry_id": inquiry_id,
            "company_name": company_name or "",
            "org_id": org_id,
            "source": "lp_document_request",
        },
    )


def send_lp_contract_signed(
    db: Session,
    inquiry_id: int,
    email: Optional[str] = None,
    company_name: Optional[str] = None,
    org_id: Optional[int] = None,
    amount: Optional[int] = None,
) -> bool:
    """LP経由の資料請求が成約（closed_won）になったときに contract_signed イベントを送信する。"""
    return send_event(
        db=db,
        event_type="contract_signed",
        idempotency_key=f"lp_won_{inquiry_id}",
        customer_id=email or f"inquiry_{inquiry_id}",
        amount=amount,
        extra_payload={
            "inquiry_id": inquiry_id,
            "company_name": company_name or "",
            "org_id": org_id,
            "source": "lp_document_request",
        },
    )
