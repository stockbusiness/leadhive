from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from server.database import get_db
from server.models import Plan, Organization, User, Project, Company
from server.auth import get_current_user, require_admin

router = APIRouter(prefix="/api/plans", tags=["plans"])


def check_plan_limit(org_id: int, resource: str, db: Session):
    """
    resource: 'members' | 'projects' | 'companies' | 'ai_analyses' | 'master_db_imports'
    Raises HTTPException 402 if limit is exceeded.
    Returns (plan, usage) tuple if within limits (or no plan set).
    """
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org or not org.plan_id:
        return

    plan = db.query(Plan).filter(Plan.id == org.plan_id).first()
    if not plan:
        return

    usage = get_org_usage(org_id, db)

    limit_map = {
        "members": ("max_members", usage["members"], "メンバー数"),
        "projects": ("max_projects", usage["projects"], "プロジェクト数"),
        "companies": ("max_companies", usage["companies"], "企業登録数"),
        "ai_analyses": ("max_ai_analyses_monthly", usage["ai_analyses_this_month"], "月次AI分析回数"),
        "master_db_imports": ("max_master_db_imports", usage["master_db_imports_this_month"], "マスターDBインポート"),
    }

    if resource not in limit_map:
        return

    field, current, label = limit_map[resource]
    limit = getattr(plan, field, None)
    if limit is not None and current >= limit:
        if limit == 0:
            raise HTTPException(
                status_code=402,
                detail=f"マスターDBの利用にはスターター以上のプランが必要です。現在のプラン「{plan.name}」ではご利用いただけません。"
            )
        raise HTTPException(
            status_code=402,
            detail=f"プラン「{plan.name}」の{label}上限（{limit}件/月）に達しています（今月: {current}件）。プランをアップグレードしてください。"
        )


class PlanBody(BaseModel):
    name: str
    description: Optional[str] = None
    price_monthly: Optional[int] = None
    max_members: Optional[int] = None
    max_projects: Optional[int] = None
    max_companies: Optional[int] = None
    max_ai_analyses_monthly: Optional[int] = None
    max_master_db_imports: Optional[int] = None
    api_daily_limit: Optional[int] = None
    is_active: bool = True


def plan_to_dict(plan: Plan) -> dict:
    return {
        "id": plan.id,
        "name": plan.name,
        "description": plan.description,
        "price_monthly": plan.price_monthly,
        "max_members": plan.max_members,
        "max_projects": plan.max_projects,
        "max_companies": plan.max_companies,
        "max_ai_analyses_monthly": plan.max_ai_analyses_monthly,
        "max_master_db_imports": plan.max_master_db_imports,
        "api_daily_limit": plan.api_daily_limit,
        "is_active": plan.is_active,
        "created_at": plan.created_at.isoformat() if plan.created_at else None,
        "updated_at": plan.updated_at.isoformat() if plan.updated_at else None,
    }


def get_org_usage(org_id: int, db: Session) -> dict:
    members = db.query(func.count(User.id)).filter(User.org_id == org_id).scalar() or 0
    projects = db.query(func.count(Project.id)).filter(Project.org_id == org_id).scalar() or 0

    project_ids = [row[0] for row in db.query(Project.id).filter(Project.org_id == org_id).all()]
    companies = 0
    ai_analyses_this_month = 0

    if project_ids:
        companies = db.query(func.count(Company.id)).filter(Company.project_id.in_(project_ids)).scalar() or 0

        now = datetime.utcnow()
        month_prefix = f"{now.year}-{now.month:02d}"
        ai_companies = db.query(Company).filter(
            Company.project_id.in_(project_ids),
            Company.ai_summary.isnot(None),
        ).all()
        ai_analyses_this_month = sum(
            1 for c in ai_companies
            if c.ai_summary and isinstance(c.ai_summary, dict)
            and str(c.ai_summary.get("generated_at", ""))[:7] == month_prefix
        )

    now = datetime.utcnow()
    current_month = f"{now.year}-{now.month:02d}"
    org = db.query(Organization).filter(Organization.id == org_id).first()
    master_db_imports_this_month = 0
    if org and getattr(org, "master_db_import_month", None) == current_month:
        master_db_imports_this_month = getattr(org, "master_db_import_count", None) or 0

    return {
        "members": members,
        "projects": projects,
        "companies": companies,
        "ai_analyses_this_month": ai_analyses_this_month,
        "master_db_imports_this_month": master_db_imports_this_month,
    }


@router.get("/current")
def get_current_plan(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    org = db.query(Organization).filter(Organization.id == current_user.org_id).first()
    plan = None
    if org and org.plan_id:
        plan = db.query(Plan).filter(Plan.id == org.plan_id).first()
    usage = get_org_usage(current_user.org_id, db)
    return {
        "plan": plan_to_dict(plan) if plan else None,
        "usage": usage,
    }


@router.get("/organizations")
def list_organizations(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    orgs = db.query(Organization).order_by(Organization.id).all()
    return {
        "organizations": [
            {
                "id": o.id,
                "name": o.name,
                "plan_id": o.plan_id,
                "created_at": o.created_at.isoformat() if o.created_at else None,
            }
            for o in orgs
        ]
    }


@router.get("")
def list_plans(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plans = db.query(Plan).order_by(Plan.is_active.desc(), Plan.price_monthly.nullsfirst(), Plan.id).all()
    return {"plans": [plan_to_dict(p) for p in plans]}


@router.post("")
def create_plan(
    body: PlanBody,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    plan = Plan(**body.model_dump())
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return {"plan": plan_to_dict(plan)}


@router.put("/{plan_id}")
def update_plan(
    plan_id: int,
    body: PlanBody,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="プランが見つかりません")
    for key, value in body.model_dump().items():
        setattr(plan, key, value)
    db.commit()
    db.refresh(plan)
    return {"plan": plan_to_dict(plan)}


@router.delete("/{plan_id}")
def delete_plan(
    plan_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="プランが見つかりません")
    orgs_using = db.query(Organization).filter(Organization.plan_id == plan_id).count()
    if orgs_using > 0:
        raise HTTPException(
            status_code=400,
            detail=f"このプランは{orgs_using}件の組織に割り当てられています。先に割り当てを解除してください。"
        )
    db.delete(plan)
    db.commit()
    return {"success": True}


@router.post("/{plan_id}/assign")
def assign_plan(
    plan_id: int,
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    org_id = data.get("org_id", current_user.org_id)
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="プランが見つかりません")
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="組織が見つかりません")
    org.plan_id = plan_id
    db.commit()
    return {"success": True, "org_id": org_id, "plan_id": plan_id}


@router.delete("/{plan_id}/assign/{org_id}")
def unassign_plan(
    plan_id: int,
    org_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="組織が見つかりません")
    org.plan_id = None
    db.commit()
    return {"success": True}
