import io
import csv
import re
from collections import defaultdict
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc
from typing import Optional, List
from server.database import get_db
from server.models import Company, StatusHistory, MemoTemplate, ActivityLog, CompanyTag, User
from server.services.scorer import calculate_score
from server.services.scraper import scrape_company_info
from server.services.categorizer import categorize_company, detect_flags
from server.schemas import company_to_dict
from server.services.cache import cache_invalidate
from server.auth import get_current_user


def _normalize_domain(domain: str) -> str:
    if not domain:
        return ""
    d = domain.lower().strip()
    d = re.sub(r'^(https?://)', '', d)
    d = d.split('/')[0]
    d = re.sub(r'^(www\.)', '', d)
    return d

router = APIRouter(prefix="/api/companies", tags=["companies"])


def _owned_projects(current_user: User, db: Session):
    from server.models import Project
    return [p.id for p in db.query(Project.id).filter(Project.org_id == current_user.org_id).all()]


@router.get("")
def list_companies(
    category: Optional[str] = None,
    status: Optional[str] = None,
    score_rank: Optional[str] = None,
    has_contact: Optional[bool] = None,
    search: Optional[str] = None,
    tag: Optional[str] = None,
    sort_by: str = "score_total",
    sort_order: str = "desc",
    page: int = 1,
    per_page: int = 50,
    project_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Company)
    if project_id:
        query = query.filter(Company.project_id == project_id)
    else:
        project_ids = _owned_projects(current_user, db)
        query = query.filter(Company.project_id.in_(project_ids))

    if category:
        query = query.filter(Company.category_main == category)
    if status:
        query = query.filter(Company.status == status)
    if score_rank:
        query = query.filter(Company.score_rank == score_rank)
    if has_contact is not None:
        if has_contact:
            query = query.filter(Company.contact_url.isnot(None), Company.contact_url != "")
        else:
            query = query.filter((Company.contact_url.is_(None)) | (Company.contact_url == ""))
    if search:
        query = query.filter(
            Company.company_name.ilike(f"%{search}%")
            | Company.website_url.ilike(f"%{search}%")
            | Company.domain.ilike(f"%{search}%")
        )
    if tag:
        tagged_ids = db.query(CompanyTag.company_id).filter(CompanyTag.tag_name == tag).subquery()
        query = query.filter(Company.id.in_(tagged_ids))

    sort_col = getattr(Company, sort_by, Company.score_total)
    if sort_order == "asc":
        query = query.order_by(asc(sort_col))
    else:
        query = query.order_by(desc(sort_col))

    total = query.count()
    companies = query.offset((page - 1) * per_page).limit(per_page).all()

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "companies": [company_to_dict(c, db) for c in companies],
    }


@router.post("")
def create_company(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = db.query(Company).filter(Company.website_url == data.get("website_url")).first()
    if existing:
        return {"error": "この企業URLは既に登録されています", "company": company_to_dict(existing, db)}

    score, rank = calculate_score(data)
    data["score_total"] = score
    data["score_rank"] = rank

    company = Company(**{k: v for k, v in data.items() if hasattr(Company, k)})
    db.add(company)
    db.commit()
    db.refresh(company)
    cache_invalidate("dashboard")
    return {"company": company_to_dict(company, db)}


@router.get("/duplicates")
def find_duplicates(
    project_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Company)
    if project_id:
        q = q.filter(Company.project_id == project_id)
    else:
        project_ids = _owned_projects(current_user, db)
        q = q.filter(Company.project_id.in_(project_ids))
    companies = q.all()
    domain_groups = defaultdict(list)
    for c in companies:
        normalized = _normalize_domain(c.domain or c.website_url or "")
        if normalized:
            domain_groups[normalized].append(c)

    duplicate_groups = []
    for norm_domain, group in domain_groups.items():
        if len(group) >= 2:
            duplicate_groups.append({
                "normalized_domain": norm_domain,
                "companies": [company_to_dict(c, db) for c in group],
            })

    return {"duplicate_groups": duplicate_groups, "total_groups": len(duplicate_groups)}


@router.post("/merge")
def merge_companies(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    main_id = data.get("main_id")
    merge_ids = data.get("merge_ids", [])
    if not main_id or not merge_ids:
        return {"error": "main_id と merge_ids は必須です"}

    main_company = db.query(Company).filter(Company.id == main_id).first()
    if not main_company:
        return {"error": "メイン企業が見つかりません"}

    merge_companies_list = db.query(Company).filter(Company.id.in_(merge_ids)).all()
    if not merge_companies_list:
        return {"error": "マージ対象の企業が見つかりません"}

    for mc in merge_companies_list:
        if not main_company.phone and mc.phone:
            main_company.phone = mc.phone
        if not main_company.email and mc.email:
            main_company.email = mc.email
        if not main_company.contact_url and mc.contact_url:
            main_company.contact_url = mc.contact_url
        if not main_company.prefecture and mc.prefecture:
            main_company.prefecture = mc.prefecture
        if not main_company.city and mc.city:
            main_company.city = mc.city
        if not main_company.category_main and mc.category_main:
            main_company.category_main = mc.category_main
        if mc.shopify_flag:
            main_company.shopify_flag = True
        if mc.ec_flag:
            main_company.ec_flag = True
        if mc.notes and mc.notes.strip():
            existing_notes = main_company.notes or ""
            if existing_notes:
                main_company.notes = existing_notes + "\n---\n" + mc.notes
            else:
                main_company.notes = mc.notes

        tags = db.query(CompanyTag).filter(CompanyTag.company_id == mc.id).all()
        for tag in tags:
            existing = db.query(CompanyTag).filter(
                CompanyTag.company_id == main_id,
                CompanyTag.tag_name == tag.tag_name,
            ).first()
            if not existing:
                new_tag = CompanyTag(company_id=main_id, tag_name=tag.tag_name)
                db.add(new_tag)

        db.query(CompanyTag).filter(CompanyTag.company_id == mc.id).delete()
        db.query(StatusHistory).filter(StatusHistory.company_id == mc.id).delete()
        db.query(ActivityLog).filter(ActivityLog.company_id == mc.id).delete()
        db.delete(mc)

    company_dict = company_to_dict(main_company, db)
    score, rank = calculate_score(company_dict)
    main_company.score_total = score
    main_company.score_rank = rank

    db.commit()
    db.refresh(main_company)
    cache_invalidate("dashboard")
    return {"company": company_to_dict(main_company, db), "merged_count": len(merge_companies_list)}


@router.get("/tags/all")
def get_all_tags(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tags = db.query(CompanyTag.tag_name).distinct().order_by(CompanyTag.tag_name).all()
    return {"tags": [t[0] for t in tags]}


@router.put("/{company_id}")
def update_company(
    company_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        return {"error": "企業が見つかりません"}

    old_status = company.status

    for key, value in data.items():
        if hasattr(company, key) and key not in ("id", "created_at"):
            setattr(company, key, value)

    new_status = company.status
    if old_status != new_status:
        history = StatusHistory(
            company_id=company.id,
            old_status=old_status,
            new_status=new_status,
        )
        db.add(history)

    company_dict = company_to_dict(company, db)
    score, rank = calculate_score(company_dict)
    company.score_total = score
    company.score_rank = rank

    db.commit()
    db.refresh(company)
    cache_invalidate("dashboard")
    return {"company": company_to_dict(company, db)}


@router.delete("/{company_id}")
def delete_company(
    company_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        return {"error": "企業が見つかりません"}
    db.delete(company)
    db.commit()
    cache_invalidate("dashboard")
    return {"message": "削除しました"}


@router.put("/bulk-status")
def bulk_update_status(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    company_ids = data.get("company_ids", [])
    new_status = data.get("new_status", "")
    if not company_ids or not new_status:
        return {"error": "company_ids と new_status は必須です"}

    companies = db.query(Company).filter(Company.id.in_(company_ids)).all()
    updated = 0
    for company in companies:
        old_status = company.status
        if old_status != new_status:
            company.status = new_status
            history = StatusHistory(
                company_id=company.id,
                old_status=old_status,
                new_status=new_status,
            )
            db.add(history)
            updated += 1

    db.commit()
    cache_invalidate("dashboard")
    return {"updated": updated, "total": len(company_ids)}


@router.get("/{company_id}/history")
def get_status_history(
    company_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    history = (
        db.query(StatusHistory)
        .filter(StatusHistory.company_id == company_id)
        .order_by(desc(StatusHistory.changed_at))
        .all()
    )
    return {
        "history": [
            {
                "id": h.id,
                "old_status": h.old_status,
                "new_status": h.new_status,
                "changed_at": h.changed_at.isoformat() if h.changed_at else None,
            }
            for h in history
        ]
    }


@router.get("/{company_id}/activities")
def get_activities(
    company_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    activities = (
        db.query(ActivityLog)
        .filter(ActivityLog.company_id == company_id)
        .order_by(desc(ActivityLog.created_at))
        .all()
    )
    return {
        "activities": [
            {
                "id": a.id,
                "company_id": a.company_id,
                "action_type": a.action_type,
                "description": a.description,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in activities
        ]
    }


@router.post("/{company_id}/activities")
def create_activity(
    company_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        return {"error": "企業が見つかりません"}

    activity = ActivityLog(
        company_id=company_id,
        action_type=data.get("action_type", "その他"),
        description=data.get("description", ""),
    )
    db.add(activity)
    db.commit()
    db.refresh(activity)
    return {
        "activity": {
            "id": activity.id,
            "company_id": activity.company_id,
            "action_type": activity.action_type,
            "description": activity.description,
            "created_at": activity.created_at.isoformat() if activity.created_at else None,
        }
    }


@router.get("/csv")
def export_csv(
    category: Optional[str] = None,
    status: Optional[str] = None,
    score_rank: Optional[str] = None,
    has_contact: Optional[bool] = None,
    project_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Company)
    if project_id:
        query = query.filter(Company.project_id == project_id)
    else:
        project_ids = _owned_projects(current_user, db)
        query = query.filter(Company.project_id.in_(project_ids))
    if category:
        query = query.filter(Company.category_main == category)
    if status:
        query = query.filter(Company.status == status)
    if score_rank:
        query = query.filter(Company.score_rank == score_rank)
    if has_contact:
        query = query.filter(Company.contact_url.isnot(None), Company.contact_url != "")

    companies = query.order_by(desc(Company.score_total)).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "会社名", "URL", "問い合わせURL", "所在地", "電話番号",
        "メール", "カテゴリ", "Shopify対応", "EC特化判定",
        "スコア", "ランク", "ステータス", "メモ",
    ])

    for c in companies:
        location = f"{c.prefecture or ''}{c.city or ''}"
        writer.writerow([
            c.company_name or "",
            c.website_url or "",
            c.contact_url or "",
            location,
            c.phone or "",
            c.email or "",
            c.category_main or "",
            "○" if c.shopify_flag else "",
            "○" if c.ec_flag else "",
            c.score_total,
            c.score_rank or "",
            c.status or "",
            c.notes or "",
        ])

    csv_content = output.getvalue()
    output.close()

    return Response(
        content=csv_content.encode("utf-8-sig"),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=companies_export.csv"},
    )


@router.get("/{company_id}/tags")
def get_company_tags(
    company_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tags = db.query(CompanyTag).filter(CompanyTag.company_id == company_id).all()
    return {"tags": [{"id": t.id, "tag_name": t.tag_name, "created_at": t.created_at.isoformat() if t.created_at else None} for t in tags]}


@router.post("/{company_id}/tags")
def add_company_tag(
    company_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        return {"error": "企業が見つかりません"}

    tag_name = data.get("tag_name", "").strip()
    if not tag_name:
        return {"error": "タグ名は必須です"}

    existing = db.query(CompanyTag).filter(
        CompanyTag.company_id == company_id,
        CompanyTag.tag_name == tag_name
    ).first()
    if existing:
        return {"error": "このタグは既に追加されています"}

    tag = CompanyTag(company_id=company_id, tag_name=tag_name)
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return {"tag": {"id": tag.id, "tag_name": tag.tag_name, "created_at": tag.created_at.isoformat() if tag.created_at else None}}


@router.delete("/{company_id}/tags/{tag_name}")
def delete_company_tag(
    company_id: int,
    tag_name: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tag = db.query(CompanyTag).filter(
        CompanyTag.company_id == company_id,
        CompanyTag.tag_name == tag_name
    ).first()
    if not tag:
        return {"error": "タグが見つかりません"}
    db.delete(tag)
    db.commit()
    return {"message": "タグを削除しました"}


@router.post("/{company_id}/rescrape")
def rescrape_company(
    company_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        return {"error": "企業が見つかりません"}

    url = company.website_url
    if not url:
        return {"error": "WebサイトURLが設定されていません"}

    scraped = scrape_company_info(url)
    if scraped.get("error"):
        return {"error": f"スクレイピングに失敗しました: {scraped['error']}"}

    full_text = scraped.get("full_text", "")
    category_main, category_sub = categorize_company(full_text)
    flags = detect_flags(full_text)

    saved_adjustment = company.score_adjustment or 0

    if scraped.get("company_name"):
        company.company_name = scraped["company_name"]
    if scraped.get("domain"):
        company.domain = scraped["domain"]
    if scraped.get("contact_url"):
        company.contact_url = scraped["contact_url"]
    if scraped.get("phone"):
        company.phone = scraped["phone"]
    if scraped.get("email"):
        company.email = scraped["email"]
    if scraped.get("prefecture"):
        company.prefecture = scraped["prefecture"]
    if scraped.get("city"):
        company.city = scraped["city"]

    company.category_main = category_main
    company.category_sub = category_sub
    for flag_key, flag_val in flags.items():
        setattr(company, flag_key, flag_val)

    company.score_adjustment = saved_adjustment
    company_dict = company_to_dict(company, db)
    score, rank = calculate_score(company_dict)
    company.score_total = score
    company.score_rank = rank

    db.commit()
    db.refresh(company)
    return {"company": company_to_dict(company, db)}


@router.post("/move-project")
def move_project(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    company_ids = data.get("company_ids", [])
    target_project_id = data.get("target_project_id")
    if not company_ids or not target_project_id:
        return {"error": "企業IDと移動先プロジェクトIDを指定してください"}

    existing_domains = set(
        c.domain for c in db.query(Company.domain).filter(Company.project_id == target_project_id).all()
    )

    moved = 0
    skipped = 0
    for cid in company_ids:
        company = db.query(Company).filter(Company.id == cid).first()
        if not company:
            continue
        if company.domain in existing_domains:
            skipped += 1
            continue
        company.project_id = target_project_id
        existing_domains.add(company.domain)
        moved += 1

    db.commit()
    return {"moved": moved, "skipped": skipped}
