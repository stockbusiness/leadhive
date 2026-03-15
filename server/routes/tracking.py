import base64
import logging
from datetime import datetime
from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session
from server.database import get_db
from server.models import SalesMessage

router = APIRouter(tags=["tracking"])
logger = logging.getLogger(__name__)

# 1x1透明GIF（base64）
_PIXEL_GIF = base64.b64decode(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
)


@router.get("/api/track/{token}.gif", include_in_schema=False)
def track_open(token: str, db: Session = Depends(get_db)):
    try:
        msg = db.query(SalesMessage).filter(SalesMessage.tracking_token == token).first()
        if msg:
            if msg.opened_at is None:
                msg.opened_at = datetime.utcnow()
            msg.open_count = (msg.open_count or 0) + 1
            db.commit()
            logger.info(f"Email opened: message_id={msg.id} count={msg.open_count}")
    except Exception as e:
        logger.error(f"Tracking error: {e}")

    return Response(content=_PIXEL_GIF, media_type="image/gif", headers={
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
    })
