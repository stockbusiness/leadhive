"""
Slack通知の集約サービス。
SystemSettings の slack_notification_triggers キーで通知トリガーを管理。
"""
import json
import logging
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

DEFAULT_TRIGGERS = {
    "rank_a_added": True,
    "email_opened": True,
}


def get_triggers(db: Session) -> dict:
    try:
        from server.models import SystemSettings
        row = db.query(SystemSettings).filter(SystemSettings.key == "slack_notification_triggers").first()
        if row and row.value:
            stored = json.loads(row.value)
            return {**DEFAULT_TRIGGERS, **stored}
    except Exception:
        pass
    return dict(DEFAULT_TRIGGERS)


def save_triggers(db: Session, triggers: dict):
    from server.models import SystemSettings
    row = db.query(SystemSettings).filter(SystemSettings.key == "slack_notification_triggers").first()
    serialized = json.dumps(triggers)
    if row:
        row.value = serialized
    else:
        db.add(SystemSettings(key="slack_notification_triggers", value=serialized))
    db.commit()


def _get_webhook(db: Session) -> str | None:
    try:
        from server.models import AppSetting
        from server.services.encryption import decrypt_value
        row = db.query(AppSetting).filter(AppSetting.setting_key == "slack_webhook_url").first()
        if row and row.setting_value:
            return decrypt_value(row.setting_value)
    except Exception:
        pass
    return None


def notify_rank_a_company(db: Session, company_name: str, domain: str | None = None, project_name: str | None = None):
    """Aランク企業が追加されたときに通知する。"""
    try:
        triggers = get_triggers(db)
        if not triggers.get("rank_a_added"):
            return
        webhook = _get_webhook(db)
        if not webhook:
            return
        from server.services.slack import send_slack_notification
        parts = [f"⭐ *Aランク企業が追加されました*"]
        parts.append(f"企業名: {company_name}")
        if domain:
            parts.append(f"ドメイン: {domain}")
        if project_name:
            parts.append(f"プロジェクト: {project_name}")
        send_slack_notification("\n".join(parts), webhook)
    except Exception as e:
        logger.warning(f"notify_rank_a_company failed: {e}")


def notify_email_opened(db: Session, company_name: str, subject: str, open_count: int, org_id: int | None = None):
    """メールが開封されたときに通知する。"""
    try:
        triggers = get_triggers(db)
        if not triggers.get("email_opened"):
            return
        webhook = _get_webhook(db)
        if not webhook:
            return
        from server.services.slack import send_slack_notification
        label = "（初回開封）" if open_count == 1 else f"（{open_count}回目）"
        msg = (
            f"📧 *メール開封を検知しました* {label}\n"
            f"企業名: {company_name}\n"
            f"件名: {subject}"
        )
        send_slack_notification(msg, webhook)
    except Exception as e:
        logger.warning(f"notify_email_opened failed: {e}")
