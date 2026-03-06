from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from server.database import get_db
from server.models import Company

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("")
def get_dashboard(db: Session = Depends(get_db)):
    total = db.query(func.count(Company.id)).scalar() or 0

    unique_domains = db.query(func.count(func.distinct(Company.domain))).scalar() or 0

    unconfirmed = db.query(func.count(Company.id)).filter(
        Company.status == "未確認"
    ).scalar() or 0

    high_score = db.query(func.count(Company.id)).filter(
        Company.score_rank.in_(["A", "B"])
    ).scalar() or 0

    with_contact = db.query(func.count(Company.id)).filter(
        Company.contact_url.isnot(None),
        Company.contact_url != "",
    ).scalar() or 0

    by_category = dict(
        db.query(Company.category_main, func.count(Company.id))
        .group_by(Company.category_main)
        .all()
    )

    by_status = dict(
        db.query(Company.status, func.count(Company.id))
        .group_by(Company.status)
        .all()
    )

    by_rank = dict(
        db.query(Company.score_rank, func.count(Company.id))
        .group_by(Company.score_rank)
        .all()
    )

    return {
        "total": total,
        "unique_domains": unique_domains,
        "unconfirmed": unconfirmed,
        "high_score": high_score,
        "with_contact": with_contact,
        "by_category": by_category,
        "by_status": by_status,
        "by_rank": by_rank,
    }
