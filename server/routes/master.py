from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from server.database import get_db
from server.models import CompanyMaster, Company, User, Organization, Plan
from server.auth import get_current_user, require_phase0_unlock

router = APIRouter(prefix="/api/master", tags=["master"])


def _master_to_dict(m: CompanyMaster, already_in_project: bool = False) -> dict:
    return {
        "id": m.id,
        "domain": m.domain,
        "corporate_number": getattr(m, "corporate_number", None),
        "company_name": m.company_name,
        "website_url": m.website_url,
        "contact_url": m.contact_url,
        "phone": m.phone,
        "email": m.email,
        "prefecture": m.prefecture,
        "city": m.city,
        "category_main": m.category_main,
        "category_sub": m.category_sub,
        "shopify_flag": m.shopify_flag,
        "ec_flag": m.ec_flag,
        "amazon_flag": m.amazon_flag,
        "rakuten_flag": m.rakuten_flag,
        "consulting_flag": m.consulting_flag,
        "operation_flag": m.operation_flag,
        "production_flag": m.production_flag,
        "score_total": m.score_total,
        "score_rank": m.score_rank,
        "cms_type": getattr(m, "cms_type", None),
        "sns_links": getattr(m, "sns_links", None),
        "has_recruitment": getattr(m, "has_recruitment", False),
        "escms_target_flag": getattr(m, "escms_target_flag", False),
        "robots_disallow": getattr(m, "robots_disallow", False),
        "source": m.source,
        "last_scraped_at": m.last_scraped_at.isoformat() if m.last_scraped_at else None,
        "created_at": m.created_at.isoformat() if m.created_at else None,
        "already_in_project": already_in_project,
    }


def _check_master_db_access(current_user: User, db: Session):
    """プランチェック: マスターDB検索・インポートへのアクセス権があるか確認する"""
    org = db.query(Organization).filter(Organization.id == current_user.org_id).first()
    if not org or not org.plan_id:
        return
    plan = db.query(Plan).filter(Plan.id == org.plan_id).first()
    if not plan:
        return
    limit = getattr(plan, "max_master_db_imports", None)
    if limit is not None and limit == 0:
        raise HTTPException(
            status_code=402,
            detail=f"マスターDBの利用にはスターター以上のプランが必要です。現在のプラン「{plan.name}」ではご利用いただけません。"
        )


@router.get("/stats")
def get_master_stats(
    current_user: User = Depends(require_phase0_unlock),
    db: Session = Depends(get_db),
):
    total = db.query(func.count(CompanyMaster.id)).scalar() or 0
    by_category = dict(
        db.query(CompanyMaster.category_main, func.count(CompanyMaster.id))
        .filter(CompanyMaster.category_main.isnot(None))
        .group_by(CompanyMaster.category_main)
        .all()
    )
    by_source = dict(
        db.query(CompanyMaster.source, func.count(CompanyMaster.id))
        .filter(CompanyMaster.source.isnot(None))
        .group_by(CompanyMaster.source)
        .all()
    )
    return {"total": total, "by_category": by_category, "by_source": by_source}


@router.get("/search")
def search_master(
    q: Optional[str] = None,
    category: Optional[str] = None,
    prefecture: Optional[str] = None,
    min_score: Optional[int] = None,
    project_id: Optional[int] = None,
    cms_type: Optional[str] = None,
    has_email: Optional[bool] = None,
    escms_target: Optional[bool] = None,
    has_recruitment: Optional[bool] = None,
    limit: int = 50,
    current_user: User = Depends(require_phase0_unlock),
    db: Session = Depends(get_db),
):
    _check_master_db_access(current_user, db)

    query = db.query(CompanyMaster)

    if q and q.strip():
        term = f"%{q.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(CompanyMaster.company_name).like(term),
                CompanyMaster.domain.like(term),
                func.lower(CompanyMaster.category_main).like(term),
                func.lower(CompanyMaster.prefecture).like(term),
                CompanyMaster.search_text.like(term),
            )
        )

    if category and category != "all":
        query = query.filter(CompanyMaster.category_main == category)

    if prefecture and prefecture != "all":
        query = query.filter(CompanyMaster.prefecture == prefecture)

    if min_score is not None:
        query = query.filter(CompanyMaster.score_total >= min_score)

    if cms_type and cms_type != "all":
        if cms_type == "none":
            query = query.filter(
                (CompanyMaster.cms_type.is_(None)) | (CompanyMaster.cms_type == "")
            )
        else:
            query = query.filter(CompanyMaster.cms_type == cms_type)

    if has_email is True:
        query = query.filter(
            CompanyMaster.email.isnot(None),
            CompanyMaster.email != "",
        )
    elif has_email is False:
        query = query.filter(
            (CompanyMaster.email.is_(None)) | (CompanyMaster.email == "")
        )

    if escms_target is True:
        query = query.filter(CompanyMaster.escms_target_flag == True)

    if has_recruitment is True:
        query = query.filter(CompanyMaster.has_recruitment == True)

    total_count = query.count()
    results = query.order_by(CompanyMaster.score_total.desc()).limit(limit).all()

    project_domains = set()
    if project_id:
        rows = db.query(Company.domain).filter(Company.project_id == project_id).all()
        project_domains = {r.domain for r in rows}

    items = [_master_to_dict(m, already_in_project=(m.domain in project_domains)) for m in results]
    return {"items": items, "total": total_count}


@router.post("/import")
def import_from_master(
    data: dict,
    current_user: User = Depends(require_phase0_unlock),
    db: Session = Depends(get_db),
):
    from server.routes.plans import check_plan_limit
    check_plan_limit(current_user.org_id, "master_db_imports", db)

    domain_list = data.get("domain_list", [])
    project_id = data.get("project_id")

    if not domain_list:
        return {"error": "インポートするドメインを指定してください"}

    existing_domains = set()
    if project_id:
        rows = db.query(Company.domain).filter(Company.project_id == project_id).all()
        existing_domains = {r.domain for r in rows}

    success = 0
    duplicate = 0
    error = 0
    imported = []

    for domain in domain_list:
        if domain in existing_domains:
            duplicate += 1
            continue

        master = db.query(CompanyMaster).filter(CompanyMaster.domain == domain).first()
        if not master:
            error += 1
            continue

        try:
            company = Company(
                project_id=project_id,
                domain=master.domain,
                company_name=master.company_name,
                website_url=master.website_url,
                contact_url=master.contact_url,
                phone=master.phone,
                email=master.email,
                prefecture=master.prefecture,
                city=master.city,
                category_main=master.category_main,
                category_sub=master.category_sub,
                shopify_flag=master.shopify_flag or False,
                ec_flag=master.ec_flag or False,
                amazon_flag=master.amazon_flag or False,
                rakuten_flag=master.rakuten_flag or False,
                consulting_flag=master.consulting_flag or False,
                operation_flag=master.operation_flag or False,
                production_flag=master.production_flag or False,
                score_total=master.score_total or 0,
                score_rank=master.score_rank or "D",
                status="未確認",
            )
            db.add(company)
            db.commit()
            db.refresh(company)
            existing_domains.add(domain)
            success += 1
            imported.append({"domain": domain, "company_id": company.id})
        except Exception:
            db.rollback()
            error += 1

    if success > 0:
        now = datetime.utcnow()
        current_month = f"{now.year}-{now.month:02d}"
        org = db.query(Organization).filter(Organization.id == current_user.org_id).first()
        if org:
            if getattr(org, "master_db_import_month", None) != current_month:
                org.master_db_import_count = success
                org.master_db_import_month = current_month
            else:
                org.master_db_import_count = (getattr(org, "master_db_import_count", None) or 0) + success
            db.commit()

    return {
        "success": success,
        "duplicate": duplicate,
        "error": error,
        "imported": imported,
    }
