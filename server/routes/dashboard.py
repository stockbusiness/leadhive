from datetime import date, timedelta, datetime
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from server.database import get_db
from server.models import Company, ApiUsageLog, CollectionLog, User, Project, ActivityLog
from server.schemas import company_to_dict
from server.services.cache import cache_get, cache_set
from server.auth import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("")
def get_dashboard(
    project_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cache_key = f"dashboard_{project_id}" if project_id else "dashboard"
    cached = cache_get(cache_key, ttl=60)
    if cached:
        today = date.today()
        usage_log = db.query(ApiUsageLog).filter(ApiUsageLog.usage_date == today).first()
        cached["api_usage_today"] = usage_log.request_count if usage_log else 0
        cached["today_followups"] = _get_today_followups(project_id, db)
        cached["top_uncontacted"] = _get_top_uncontacted(project_id, db)
        cached["replied_companies"] = _get_replied(project_id, db)
        return cached

    org_project_ids = [p.id for p in db.query(Project.id).filter(Project.org_id == current_user.org_id).all()]

    def scoped(q):
        if project_id:
            return q.filter(Company.project_id == project_id)
        return q.filter(Company.project_id.in_(org_project_ids))

    total = scoped(db.query(func.count(Company.id))).scalar() or 0
    unique_domains = scoped(db.query(func.count(func.distinct(Company.domain)))).scalar() or 0

    unconfirmed = scoped(db.query(func.count(Company.id)).filter(
        Company.status == "未確認"
    )).scalar() or 0

    high_score = scoped(db.query(func.count(Company.id)).filter(
        Company.score_rank.in_(["A", "B"])
    )).scalar() or 0

    with_contact = scoped(db.query(func.count(Company.id)).filter(
        Company.contact_url.isnot(None),
        Company.contact_url != "",
    )).scalar() or 0

    by_category = dict(
        scoped(db.query(Company.category_main, func.count(Company.id)))
        .group_by(Company.category_main)
        .all()
    )

    by_status = dict(
        scoped(db.query(Company.status, func.count(Company.id)))
        .group_by(Company.status)
        .all()
    )

    by_rank = dict(
        scoped(db.query(Company.score_rank, func.count(Company.id)))
        .group_by(Company.score_rank)
        .all()
    )

    by_prefecture = dict(
        scoped(db.query(Company.prefecture, func.count(Company.id))
        .filter(Company.prefecture.isnot(None), Company.prefecture != ""))
        .group_by(Company.prefecture)
        .all()
    )

    ec_companies = scoped(db.query(func.count(Company.id)).filter(
        Company.ec_flag == True
    )).scalar() or 0

    platform_rows = (
        scoped(
            db.query(Company.cms_type, func.count(Company.id))
            .filter(
                Company.ec_flag == True,
                Company.cms_type.isnot(None),
                Company.cms_type != "",
            )
        )
        .group_by(Company.cms_type)
        .all()
    )
    ec_platform_distribution = {row[0]: row[1] for row in platform_rows if row[1] > 0}

    recent_companies = scoped(db.query(Company)).order_by(desc(Company.created_at)).limit(5).all()

    today = date.today()
    usage_log = db.query(ApiUsageLog).filter(ApiUsageLog.usage_date == today).first()
    api_usage_today = usage_log.request_count if usage_log else 0

    thirty_days_ago = date.today() - timedelta(days=29)
    trend_q = (
        db.query(
            func.date(CollectionLog.created_at).label("day"),
            func.sum(CollectionLog.success_count).label("count"),
        )
        .filter(func.date(CollectionLog.created_at) >= thirty_days_ago)
    )
    if project_id:
        trend_q = trend_q.filter(CollectionLog.project_id == project_id)
    trend_rows = trend_q.group_by(func.date(CollectionLog.created_at)).order_by(func.date(CollectionLog.created_at)).all()
    trend_map = {str(row.day): int(row.count or 0) for row in trend_rows}
    daily_trend = []
    for i in range(30):
        d = (thirty_days_ago + timedelta(days=i)).isoformat()
        daily_trend.append({"date": d, "count": trend_map.get(d, 0)})

    result = {
        "total": total,
        "unique_domains": unique_domains,
        "unconfirmed": unconfirmed,
        "high_score": high_score,
        "with_contact": with_contact,
        "by_category": by_category,
        "by_status": by_status,
        "by_rank": by_rank,
        "by_prefecture": by_prefecture,
        "ec_companies": ec_companies,
        "ec_platform_distribution": ec_platform_distribution,
        "recent_companies": [company_to_dict(c) for c in recent_companies],
        "api_usage_today": api_usage_today,
        "api_daily_limit": 100,
        "daily_collection_trend": daily_trend,
        "today_followups": _get_today_followups(project_id, db),
        "top_uncontacted": _get_top_uncontacted(project_id, db),
        "replied_companies": _get_replied(project_id, db),
    }

    cache_set(cache_key, result)
    return result


def _get_today_followups(project_id, db):
    today = date.today()
    q = db.query(Company).filter(
        Company.follow_up_date.isnot(None),
        Company.follow_up_date <= today,
        Company.status.notin_(["代理店化", "失注", "除外"]),
    )
    if project_id:
        q = q.filter(Company.project_id == project_id)
    companies = q.order_by(Company.follow_up_date).limit(10).all()
    return [company_to_dict(c) for c in companies]


def _get_top_uncontacted(project_id, db):
    q = db.query(Company).filter(
        Company.score_rank.in_(["A", "B"]),
        Company.status.in_(["未確認", "対象候補", "アプローチ前"]),
        Company.contact_url.isnot(None),
        Company.contact_url != "",
    )
    if project_id:
        q = q.filter(Company.project_id == project_id)
    companies = q.order_by(desc(Company.score_total)).limit(5).all()
    return [company_to_dict(c) for c in companies]


def _get_replied(project_id, db):
    q = db.query(Company).filter(Company.status == "返信あり")
    if project_id:
        q = q.filter(Company.project_id == project_id)
    companies = q.order_by(desc(Company.updated_at)).limit(5).all()
    return [company_to_dict(c) for c in companies]


@router.get("/team")
def get_team_dashboard(
    project_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    org_projects = db.query(Project).filter(Project.org_id == current_user.org_id).all()
    org_project_ids = [p.id for p in org_projects]
    if project_id and project_id in org_project_ids:
        scoped_project_ids = [project_id]
    else:
        scoped_project_ids = org_project_ids

    members = db.query(User).filter(User.org_id == current_user.org_id).all()

    today = date.today()
    this_month_start = today.replace(day=1)
    week_start = today - timedelta(days=today.weekday())

    approached_statuses = ["フォーム送信済", "コンタクト済み", "返信あり", "面談化", "商談中", "代理店化"]
    meeting_statuses = ["面談化", "商談中", "代理店化"]

    total_collected_this_month = db.query(func.count(Company.id)).filter(
        Company.project_id.in_(scoped_project_ids),
        func.date(Company.created_at) >= this_month_start,
    ).scalar() or 0

    approached_count = db.query(func.count(Company.id)).filter(
        Company.project_id.in_(scoped_project_ids),
        Company.status.in_(approached_statuses),
    ).scalar() or 0

    meeting_count = db.query(func.count(Company.id)).filter(
        Company.project_id.in_(scoped_project_ids),
        Company.status.in_(meeting_statuses),
    ).scalar() or 0

    overdue_total = db.query(func.count(Company.id)).filter(
        Company.project_id.in_(scoped_project_ids),
        Company.follow_up_date.isnot(None),
        Company.follow_up_date < today,
        Company.status.notin_(["代理店化", "失注", "除外"]),
    ).scalar() or 0

    member_stats = []
    for member in members:
        assigned = db.query(func.count(Company.id)).filter(
            Company.assignee_id == member.id,
            Company.project_id.in_(scoped_project_ids),
        ).scalar() or 0

        status_rows = db.query(Company.status, func.count(Company.id)).filter(
            Company.assignee_id == member.id,
            Company.project_id.in_(scoped_project_ids),
        ).group_by(Company.status).all()
        status_breakdown = {row[0]: row[1] for row in status_rows}

        activity_count = db.query(func.count(ActivityLog.id)).filter(
            ActivityLog.company_id.in_(
                db.query(Company.id).filter(
                    Company.assignee_id == member.id,
                    Company.project_id.in_(scoped_project_ids),
                ).subquery()
            ),
            func.date(ActivityLog.created_at) >= week_start,
        ).scalar() or 0

        overdue_count = db.query(func.count(Company.id)).filter(
            Company.assignee_id == member.id,
            Company.project_id.in_(scoped_project_ids),
            Company.follow_up_date.isnot(None),
            Company.follow_up_date < today,
            Company.status.notin_(["代理店化", "失注", "除外"]),
        ).scalar() or 0

        member_stats.append({
            "user_id": member.id,
            "display_name": member.display_name or member.email,
            "email": member.email,
            "assigned_count": assigned,
            "status_breakdown": status_breakdown,
            "activity_count_this_week": activity_count,
            "overdue_followups": overdue_count,
        })

    return {
        "members": member_stats,
        "team_summary": {
            "total_collected_this_month": total_collected_this_month,
            "approached_count": approached_count,
            "meeting_count": meeting_count,
            "overdue_count": overdue_total,
        },
    }
