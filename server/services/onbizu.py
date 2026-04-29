"""
Onbizu 連携サービス

LeadHive のユーザーイベント（登録・ログイン・オンボーディング・コンバージョン）を
Onbizu にリアルタイム送信する。

方式B（イベント取り込みAPI）を使用。HMAC-SHA256 署名付き POST。
設定キー（SystemSettings テーブル）:
  - onbizu_base_url        : Onbizu のベースURL（例: https://onbizu.example.com）
  - onbizu_product_key     : プロダクトキー
  - onbizu_webhook_secret  : HMAC-SHA256 署名生成用シークレット（暗号化保存）
"""

import hmac
import hashlib
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

import requests
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def _get_setting(db: Session, key: str) -> Optional[str]:
    from server.models import SystemSettings
    from server.services.encryption import decrypt_value
    row = db.query(SystemSettings).filter(SystemSettings.key == key).first()
    if not row or not row.value:
        return None
    return decrypt_value(row.value)


def _get_config(db: Session) -> Optional[dict]:
    base_url = _get_setting(db, "onbizu_base_url")
    product_key = _get_setting(db, "onbizu_product_key")
    webhook_secret = _get_setting(db, "onbizu_webhook_secret")

    if not base_url or not product_key or not webhook_secret:
        return None

    return {
        "base_url": base_url.rstrip("/"),
        "product_key": product_key,
        "webhook_secret": webhook_secret,
    }


def _sign(secret: str, body: str) -> str:
    return hmac.new(secret.encode("utf-8"), body.encode("utf-8"), hashlib.sha256).hexdigest()


def send_event(
    db: Session,
    event_type: str,
    external_user_id: str,
    email: Optional[str] = None,
    display_name: Optional[str] = None,
    plan_type: Optional[str] = None,
    extra: Optional[dict] = None,
    idempotency_key: Optional[str] = None,
) -> bool:
    config = _get_config(db)
    if not config:
        logger.debug("Onbizu not configured, skipping event: %s", event_type)
        return False

    payload: dict = {
        "productKey": config["product_key"],
        "externalUserId": str(external_user_id),
        "eventType": event_type,
    }
    if email:
        payload["email"] = email
    if display_name:
        payload["displayName"] = display_name
    if plan_type:
        payload["planType"] = plan_type
    if extra:
        payload.update(extra)

    body = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    signature = _sign(config["webhook_secret"], body)
    idem_key = idempotency_key or str(uuid.uuid4())

    headers = {
        "Content-Type": "application/json",
        "x-webhook-signature": f"sha256={signature}",
        "idempotency-key": idem_key,
    }

    url = f"{config['base_url']}/api/events/ingest"

    try:
        resp = requests.post(url, data=body.encode("utf-8"), headers=headers, timeout=10)
        if resp.status_code in (200, 201, 202):
            logger.info(
                "Onbizu event sent: %s user=%s -> %s",
                event_type, external_user_id, resp.status_code,
            )
            return True
        else:
            logger.warning(
                "Onbizu event failed: %s user=%s -> %s %s",
                event_type, external_user_id, resp.status_code, resp.text[:200],
            )
            return False
    except Exception as e:
        logger.error("Onbizu request error: %s", e)
        return False


def send_user_registered(
    db: Session,
    user_id: int,
    email: str,
    display_name: str = "",
    org_name: str = "",
    plan_type: str = "free",
) -> bool:
    return send_event(
        db=db,
        event_type="user_registered",
        external_user_id=f"user_{user_id}",
        email=email,
        display_name=display_name or email,
        plan_type=plan_type,
        extra={"org_name": org_name},
        idempotency_key=f"onbizu_register_{user_id}",
    )


def send_user_login(
    db: Session,
    user_id: int,
    email: str,
    display_name: str = "",
) -> bool:
    return send_event(
        db=db,
        event_type="user_login",
        external_user_id=f"user_{user_id}",
        email=email,
        display_name=display_name or email,
        idempotency_key=f"onbizu_login_{user_id}_{datetime.now(timezone.utc).strftime('%Y%m%d')}",
    )


def send_onboarding_completed(
    db: Session,
    user_id: int,
    email: str,
    display_name: str = "",
    org_name: str = "",
) -> bool:
    return send_event(
        db=db,
        event_type="onboarding_completed",
        external_user_id=f"user_{user_id}",
        email=email,
        display_name=display_name or email,
        extra={"org_name": org_name},
        idempotency_key=f"onbizu_onboarding_{user_id}",
    )


def send_conversion(
    db: Session,
    user_id: int,
    email: str,
    display_name: str = "",
    plan_name: str = "",
    stripe_session_id: str = "",
) -> bool:
    return send_event(
        db=db,
        event_type="conversion",
        external_user_id=f"user_{user_id}",
        email=email,
        display_name=display_name or email,
        plan_type=plan_name,
        extra={"plan_name": plan_name, "stripe_session_id": stripe_session_id},
        idempotency_key=f"onbizu_conv_{stripe_session_id or user_id}",
    )


def send_step_completed(
    db: Session,
    user_id: int,
    email: str,
    step_name: str,
    display_name: str = "",
) -> bool:
    return send_event(
        db=db,
        event_type="step_completed",
        external_user_id=f"user_{user_id}",
        email=email,
        display_name=display_name or email,
        extra={"step": step_name},
        idempotency_key=f"onbizu_step_{user_id}_{step_name}",
    )
