import logging
import requests
from typing import Optional

logger = logging.getLogger(__name__)

HUBSREV_KEYS = ["hubsrev_enabled", "hubsrev_webhook_url", "hubsrev_api_key"]


def _get_hubsrev_settings(db) -> dict:
    from server.models import SystemSettings
    from server.services.encryption import decrypt_value
    rows = db.query(SystemSettings).filter(SystemSettings.key.in_(HUBSREV_KEYS)).all()
    result = {r.key: decrypt_value(r.value) if r.value else "" for r in rows}
    for k in HUBSREV_KEYS:
        result.setdefault(k, "")
    return result


def send_to_hubsrev(
    db,
    sender_name: str,
    sender_email: str,
    subject: str,
    body_text: str,
    sender_company: Optional[str] = None,
    source_system: Optional[str] = "LeadHive",
    source_type: str = "form",
) -> bool:
    try:
        settings = _get_hubsrev_settings(db)

        if settings.get("hubsrev_enabled", "true") == "false":
            return False

        webhook_url = settings.get("hubsrev_webhook_url", "").strip()
        api_key = settings.get("hubsrev_api_key", "").strip()

        if not webhook_url or not api_key:
            return False

        payload = {
            "senderName": sender_name,
            "senderEmail": sender_email,
            "subject": subject,
            "bodyText": body_text,
            "sourceSystem": source_system,
            "sourceType": source_type,
        }
        if sender_company:
            payload["senderCompany"] = sender_company

        resp = requests.post(
            webhook_url,
            json=payload,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            timeout=10,
        )

        if resp.status_code in (200, 201):
            logger.info("Hubsrev webhook sent: %s → %s", subject, resp.json().get("inboxNo", ""))
            return True
        else:
            logger.warning("Hubsrev webhook failed: %s %s", resp.status_code, resp.text[:200])
            return False

    except Exception as e:
        logger.error("Hubsrev webhook error: %s", e)
        return False
