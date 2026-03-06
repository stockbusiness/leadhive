import io
import csv
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc
from typing import Optional
from server.database import get_db
from server.models import Company
from server.services.scorer import calculate_score

router = APIRouter(prefix="/api/companies", tags=["companies"])


@router.get("")
def list_companies(
    category: Optional[str] = None,
    status: Optional[str] = None,
    score_rank: Optional[str] = None,
    has_contact: Optional[bool] = None,
    search: Optional[str] = None,
    sort_by: str = "score_total",
    sort_order: str = "desc",
    page: int = 1,
    per_page: int = 50,
    db: Session = Depends(get_db),
):
    query = db.query(Company)

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
        "companies": [company_to_dict(c) for c in companies],
    }


@router.post("")
def create_company(data: dict, db: Session = Depends(get_db)):
    existing = db.query(Company).filter(Company.website_url == data.get("website_url")).first()
    if existing:
        return {"error": "この企業URLは既に登録されています", "company": company_to_dict(existing)}

    score, rank = calculate_score(data)
    data["score_total"] = score
    data["score_rank"] = rank

    company = Company(**{k: v for k, v in data.items() if hasattr(Company, k)})
    db.add(company)
    db.commit()
    db.refresh(company)
    return {"company": company_to_dict(company)}


@router.put("/{company_id}")
def update_company(company_id: int, data: dict, db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        return {"error": "企業が見つかりません"}

    for key, value in data.items():
        if hasattr(company, key) and key not in ("id", "created_at"):
            setattr(company, key, value)

    company_dict = company_to_dict(company)
    score, rank = calculate_score(company_dict)
    company.score_total = score
    company.score_rank = rank

    db.commit()
    db.refresh(company)
    return {"company": company_to_dict(company)}


@router.delete("/{company_id}")
def delete_company(company_id: int, db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        return {"error": "企業が見つかりません"}
    db.delete(company)
    db.commit()
    return {"message": "削除しました"}


@router.get("/csv")
def export_csv(
    category: Optional[str] = None,
    status: Optional[str] = None,
    score_rank: Optional[str] = None,
    has_contact: Optional[bool] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Company)
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


def company_to_dict(c: Company) -> dict:
    return {
        "id": c.id,
        "company_name": c.company_name,
        "website_url": c.website_url,
        "domain": c.domain,
        "contact_url": c.contact_url,
        "prefecture": c.prefecture,
        "city": c.city,
        "phone": c.phone,
        "email": c.email,
        "category_main": c.category_main,
        "category_sub": c.category_sub,
        "shopify_flag": c.shopify_flag,
        "ec_flag": c.ec_flag,
        "amazon_flag": c.amazon_flag,
        "rakuten_flag": c.rakuten_flag,
        "consulting_flag": c.consulting_flag,
        "operation_flag": c.operation_flag,
        "production_flag": c.production_flag,
        "score_total": c.score_total,
        "score_rank": c.score_rank,
        "status": c.status,
        "notes": c.notes,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }
