from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from server.database import get_db
from server.models import User

router = APIRouter(prefix="/api/public", tags=["public"])


@router.get("/stats")
def public_stats(db: Session = Depends(get_db)):
    registered_users = db.query(func.count(User.id)).scalar() or 0
    return {
        "registered_users": registered_users,
        "founder_slots_remaining": max(0, 50 - registered_users),
        "founder_slots_total": 50,
    }
