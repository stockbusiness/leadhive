import csv
import io
import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from server.database import get_db
from server.auth import get_current_user
from server.models import SecurityEvent, User, Organization, Company, Project

router = APIRouter(prefix="/api/security", tags=["security"])


def _require_admin(current_user: User):
    if not current_user.is_system_admin:
        raise HTTPException(status_code=403, detail="システム管理者のみ操作できます")


@router.get("/events")
def list_security_events(
    limit: int = 100,
    event_type: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    q = db.query(SecurityEvent).order_by(SecurityEvent.created_at.desc())
    if event_type:
        q = q.filter(SecurityEvent.event_type == event_type)
    events = q.limit(limit).all()

    user_ids = {e.user_id for e in events if e.user_id}
    users = {u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()} if user_ids else {}

    return {
        "events": [
            {
                "id": e.id,
                "event_type": e.event_type,
                "user_id": e.user_id,
                "user_email": users[e.user_id].email if e.user_id and e.user_id in users else None,
                "org_id": e.org_id,
                "ip_address": e.ip_address,
                "details": e.details,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in events
        ]
    }


@router.get("/stats")
def get_security_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    from sqlalchemy import func
    from datetime import timedelta
    since_24h = datetime.utcnow() - timedelta(hours=24)
    since_7d = datetime.utcnow() - timedelta(days=7)

    total_events = db.query(SecurityEvent).count()
    failed_24h = db.query(SecurityEvent).filter(
        SecurityEvent.event_type == "login_failed",
        SecurityEvent.created_at >= since_24h,
    ).count()
    locked_now = db.query(User).filter(
        User.locked_until > datetime.utcnow()
    ).count()
    success_7d = db.query(SecurityEvent).filter(
        SecurityEvent.event_type == "login_success",
        SecurityEvent.created_at >= since_7d,
    ).count()
    exports_7d = db.query(SecurityEvent).filter(
        SecurityEvent.event_type == "data_exported",
        SecurityEvent.created_at >= since_7d,
    ).count()

    return {
        "total_events": total_events,
        "failed_logins_24h": failed_24h,
        "locked_accounts": locked_now,
        "logins_7d": success_7d,
        "exports_7d": exports_7d,
    }


@router.get("/locked-users")
def get_locked_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    users = db.query(User).filter(User.locked_until > datetime.utcnow()).all()
    return {
        "users": [
            {
                "id": u.id,
                "email": u.email,
                "display_name": u.display_name,
                "org_id": u.org_id,
                "failed_login_count": u.failed_login_count or 0,
                "locked_until": u.locked_until.isoformat() if u.locked_until else None,
            }
            for u in users
        ]
    }


@router.post("/unlock-user/{user_id}")
def unlock_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="ユーザーが見つかりません")
    user.locked_until = None
    user.failed_login_count = 0
    db.commit()

    try:
        ev = SecurityEvent(
            event_type="user_unlocked",
            user_id=user.id,
            org_id=user.org_id,
            details={"unlocked_by": current_user.id, "unlocked_by_email": current_user.email},
        )
        db.add(ev)
        db.commit()
    except Exception:
        pass

    return {"ok": True, "message": f"{user.email} のロックを解除しました"}


@router.get("/backup/companies")
def download_company_backup(
    project_id: int = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Company).filter(Company.project_id.in_(
        db.query(Project.id).filter(Project.org_id == current_user.org_id)
    ))
    if project_id:
        q = q.filter(Company.project_id == project_id)
    companies = q.order_by(Company.id).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "id", "company_name", "website_url", "domain", "email", "phone",
        "prefecture", "city", "category_main", "category_sub",
        "cms_type", "shopify_flag", "ec_flag", "score_total", "score_rank",
        "contact_url", "corporate_number", "created_at",
    ])
    for c in companies:
        writer.writerow([
            c.id, c.company_name, c.website_url or "", c.domain or "",
            c.email or "", c.phone or "", c.prefecture or "", c.city or "",
            c.category_main or "", c.category_sub or "",
            c.cms_type or "", int(bool(c.shopify_flag)), int(bool(c.ec_flag)),
            c.score_total or 0, c.score_rank or "D",
            c.contact_url or "", c.corporate_number or "",
            c.created_at.isoformat() if c.created_at else "",
        ])

    try:
        ev = SecurityEvent(
            event_type="data_exported",
            user_id=current_user.id,
            org_id=current_user.org_id,
            details={"type": "companies_csv", "count": len(companies), "project_id": project_id},
        )
        db.add(ev)
        db.commit()
    except Exception:
        pass

    now_str = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"leadhive_companies_{now_str}.csv"
    return Response(
        content=output.getvalue().encode("utf-8-sig"),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/backup/full")
def download_full_backup(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)

    orgs = db.query(Organization).all()
    users = db.query(User).all()
    projects = db.query(Project).all()
    companies = db.query(Company).all()

    data = {
        "exported_at": datetime.utcnow().isoformat(),
        "organizations": [
            {"id": o.id, "name": o.name, "created_at": o.created_at.isoformat() if o.created_at else None}
            for o in orgs
        ],
        "users": [
            {
                "id": u.id, "email": u.email, "role": u.role,
                "org_id": u.org_id, "display_name": u.display_name,
                "is_active": u.is_active, "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ],
        "projects": [
            {"id": p.id, "name": p.name, "org_id": p.org_id,
             "created_at": p.created_at.isoformat() if p.created_at else None}
            for p in projects
        ],
        "companies_count": len(companies),
        "companies": [
            {
                "id": c.id, "company_name": c.company_name, "website_url": c.website_url,
                "domain": c.domain, "email": c.email, "phone": c.phone,
                "prefecture": c.prefecture, "city": c.city,
                "category_main": c.category_main, "cms_type": c.cms_type,
                "shopify_flag": c.shopify_flag, "score_total": c.score_total,
                "score_rank": c.score_rank, "project_id": c.project_id,
                "org_id": c.org_id, "corporate_number": c.corporate_number,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c in companies
        ],
    }

    try:
        ev = SecurityEvent(
            event_type="data_exported",
            user_id=current_user.id,
            org_id=current_user.org_id,
            details={"type": "full_backup_json", "orgs": len(orgs), "companies": len(companies)},
        )
        db.add(ev)
        db.commit()
    except Exception:
        pass

    now_str = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"leadhive_backup_{now_str}.json"
    return Response(
        content=json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8"),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
