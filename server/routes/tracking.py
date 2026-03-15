import base64
import logging
from datetime import datetime
from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session
from server.database import get_db
from server.models import SalesMessage, Company, SystemLog, AppSetting

router = APIRouter(tags=["tracking"])
logger = logging.getLogger(__name__)

_PIXEL_GIF = base64.b64decode(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
)


def _get_company(db: Session, company_id: int) -> Company | None:
    try:
        return db.query(Company).filter(Company.id == company_id).first()
    except Exception:
        return None


def _log_open(db: Session, msg: SalesMessage, company: Company | None):
    """SystemLogにメール開封イベントを記録する。"""
    try:
        company_name = company.company_name if company else f"company_id={msg.company_id}"
        log = SystemLog(
            action="email_opened",
            actor_email=None,
            actor_org=None,
            target=company_name,
            detail=f"message_id={msg.id} subject={msg.subject[:80]} open_count={msg.open_count}",
        )
        db.add(log)
        db.commit()
    except Exception as e:
        logger.warning(f"SystemLog write failed: {e}")


def _slack_open(db: Session, msg: SalesMessage, company: Company | None):
    """Slack通知（設定済みの場合のみ）。"""
    try:
        from server.services.slack_notifier import notify_email_opened
        company_name = company.company_name if company else f"company_id={msg.company_id}"
        notify_email_opened(
            db=db,
            company_name=company_name,
            subject=msg.subject,
            open_count=msg.open_count,
            org_id=msg.org_id,
        )
    except Exception as e:
        logger.warning(f"Slack open notify failed: {e}")


@router.get("/api/track/{token}.gif", include_in_schema=False)
def track_open(token: str, db: Session = Depends(get_db)):
    try:
        msg = db.query(SalesMessage).filter(SalesMessage.tracking_token == token).first()
        if msg:
            is_first_open = msg.opened_at is None
            if is_first_open:
                msg.opened_at = datetime.utcnow()
            msg.open_count = (msg.open_count or 0) + 1
            db.commit()
            db.refresh(msg)
            logger.info(f"Email opened: message_id={msg.id} count={msg.open_count}")

            company = _get_company(db, msg.company_id)
            _log_open(db, msg, company)
            _slack_open(db, msg, company)
    except Exception as e:
        logger.error(f"Tracking error: {e}")

    return Response(content=_PIXEL_GIF, media_type="image/gif", headers={
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
    })
