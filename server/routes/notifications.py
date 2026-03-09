from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from server.database import get_db
from server.models import Company, Project, User
from server.auth import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

COMPLETED_STATUSES = ["代理店化", "失注", "除外"]


def _owned_project_ids(user: User, db: Session) -> list:
    return [p.id for p in db.query(Project.id).filter(Project.org_id == user.org_id).all()]


@router.get("/follow-ups")
def get_follow_up_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today = date.today()
    project_ids = _owned_project_ids(current_user, db)

    base_q = db.query(Company).filter(
        Company.project_id.in_(project_ids),
        Company.follow_up_date.isnot(None),
        Company.status.notin_(COMPLETED_STATUSES),
    )

    if not (current_user.role == "admin" or current_user.is_system_admin):
        base_q = base_q.filter(Company.assignee_id == current_user.id)

    today_items = (
        base_q.filter(Company.follow_up_date == today)
        .order_by(Company.score_total.desc())
        .limit(20)
        .all()
    )

    overdue_items = (
        base_q.filter(Company.follow_up_date < today)
        .order_by(Company.follow_up_date.asc(), Company.score_total.desc())
        .limit(20)
        .all()
    )

    def to_card(c: Company) -> dict:
        return {
            "id": c.id,
            "company_name": c.company_name or "",
            "follow_up_date": c.follow_up_date.isoformat() if c.follow_up_date else None,
            "status": c.status or "未確認",
            "score_rank": c.score_rank or "D",
            "score_total": c.score_total or 0,
        }

    return {
        "today": [to_card(c) for c in today_items],
        "overdue": [to_card(c) for c in overdue_items],
        "today_count": len(today_items),
        "overdue_count": len(overdue_items),
        "total": len(today_items) + len(overdue_items),
    }
