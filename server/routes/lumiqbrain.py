"""
lumiqbrain 外部連携 API
============================
lumiqbrain プラットフォームが LeadHive のデータを参照するための外部APIエンドポイント。
APIキー認証（X-API-Key ヘッダー または Bearer トークン）で保護される。

エンドポイント:
  GET /api/lumiqbrain/company   - 企業1件取得（domain または corporate_number 指定）
  GET /api/lumiqbrain/companies - 企業一覧取得（ページング・フィルタ対応）
"""

import secrets
from fastapi import APIRouter, Depends, HTTPException, Security, Query
from fastapi.security import APIKeyHeader
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime

from server.database import get_db
from server.models import CompanyMaster, SystemSettings, User
from server.routes.auth import get_current_user

router = APIRouter(prefix="/api/lumiqbrain", tags=["lumiqbrain"])

_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def _get_api_key(db: Session) -> str:
    row = db.query(SystemSettings).filter(SystemSettings.key == "lumiqbrain_api_key").first()
    return row.value if row and row.value else ""


def require_lumiqbrain_key(
    x_api_key: Optional[str] = Security(_api_key_header),
    db: Session = Depends(get_db),
):
    stored = _get_api_key(db)
    if not stored:
        raise HTTPException(status_code=503, detail="lumiqbrain APIキーが設定されていません")
    if not x_api_key or x_api_key != stored:
        raise HTTPException(status_code=401, detail="APIキーが無効です")
    return True


def _company_master_to_lumiqbrain(c: CompanyMaster) -> dict:
    """CompanyMaster を lumiqbrain 共通構造に変換する。"""
    digital_maturity = getattr(c, "digital_maturity_score", 0) or 0
    score_updated = getattr(c, "score_updated_at", None)

    return {
        "actor": {
            "id": c.id,
            "type": "company",
            "company_name": c.company_name,
            "domain": c.domain,
            "corporate_number": c.corporate_number,
            "prefecture": c.prefecture,
            "city": c.city,
            "category_main": c.category_main,
            "category_sub": c.category_sub,
            "website_url": c.website_url,
        },
        "quality": {
            "score_total": c.score_total or 0,
            "score_rank": c.score_rank or "D",
            "digital_maturity_score": digital_maturity,
            "robots_disallow": bool(c.robots_disallow),
            "score_updated_at": score_updated.isoformat() if score_updated else None,
        },
        "signal": {
            "ec_flag": bool(c.ec_flag),
            "ec_score": c.ec_score or 0,
            "shopify_flag": bool(c.shopify_flag),
            "amazon_flag": bool(c.amazon_flag),
            "rakuten_flag": bool(c.rakuten_flag),
            "cms_type": c.cms_type,
            "sns_count": c.sns_count or 0,
            "has_recruitment": bool(c.has_recruitment),
            "consulting_flag": bool(c.consulting_flag),
            "operation_flag": bool(c.operation_flag),
            "production_flag": bool(c.production_flag),
        },
        "contact": {
            "phone": c.phone,
            "email": c.email,
            "contact_url": c.contact_url,
            "sns_instagram_url": getattr(c, "sns_instagram_url", None),
            "sns_x_url": getattr(c, "sns_x_url", None),
            "sns_facebook_url": getattr(c, "sns_facebook_url", None),
            "sns_youtube_url": getattr(c, "sns_youtube_url", None),
        },
        "meta": {
            "source": getattr(c, "source", None),
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "updated_at": c.updated_at.isoformat() if c.updated_at else None,
        },
    }


@router.get("/company")
def get_company(
    domain: Optional[str] = Query(None, description="ドメイン名で企業を検索"),
    corporate_number: Optional[str] = Query(None, description="法人番号で企業を検索"),
    _auth: bool = Depends(require_lumiqbrain_key),
    db: Session = Depends(get_db),
):
    """
    企業1件を lumiqbrain 形式で取得する。
    domain または corporate_number のいずれかが必須。
    """
    if not domain and not corporate_number:
        raise HTTPException(status_code=400, detail="domain または corporate_number を指定してください")

    query = db.query(CompanyMaster)
    if domain:
        query = query.filter(CompanyMaster.domain == domain)
    elif corporate_number:
        query = query.filter(CompanyMaster.corporate_number == corporate_number)

    company = query.first()
    if not company:
        raise HTTPException(status_code=404, detail="企業が見つかりません")

    return {"company": _company_master_to_lumiqbrain(company)}


@router.get("/companies")
def list_companies(
    page: int = Query(1, ge=1, description="ページ番号"),
    per_page: int = Query(50, ge=1, le=200, description="1ページあたりの件数"),
    score_rank: Optional[str] = Query(None, description="ランクフィルタ（A/B/C/D）"),
    min_score: Optional[int] = Query(None, ge=0, le=100, description="最低スコア"),
    min_digital_maturity: Optional[int] = Query(None, ge=0, le=100, description="最低デジタル成熟度"),
    ec_flag: Optional[bool] = Query(None, description="ECサイトフィルタ"),
    prefecture: Optional[str] = Query(None, description="都道府県フィルタ"),
    category_main: Optional[str] = Query(None, description="業種フィルタ"),
    _auth: bool = Depends(require_lumiqbrain_key),
    db: Session = Depends(get_db),
):
    """
    企業一覧を lumiqbrain 形式でページング取得する。
    """
    query = db.query(CompanyMaster).filter(
        CompanyMaster.company_name != None,
        CompanyMaster.company_name != "",
    )

    if score_rank:
        query = query.filter(CompanyMaster.score_rank == score_rank.upper())
    if min_score is not None:
        query = query.filter(CompanyMaster.score_total >= min_score)
    if min_digital_maturity is not None:
        query = query.filter(CompanyMaster.digital_maturity_score >= min_digital_maturity)
    if ec_flag is not None:
        query = query.filter(CompanyMaster.ec_flag == ec_flag)
    if prefecture:
        query = query.filter(CompanyMaster.prefecture == prefecture)
    if category_main:
        query = query.filter(CompanyMaster.category_main == category_main)

    total = query.count()
    offset = (page - 1) * per_page
    companies = query.order_by(CompanyMaster.score_total.desc()).offset(offset).limit(per_page).all()

    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": (total + per_page - 1) // per_page,
        "companies": [_company_master_to_lumiqbrain(c) for c in companies],
    }


@router.get("/admin/settings")
def admin_get_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """管理者専用: lumiqbrain APIキーの設定状態を返す。"""
    if not getattr(current_user, "is_system_admin", False):
        raise HTTPException(status_code=403, detail="システム管理者のみアクセス可能です")
    row = db.query(SystemSettings).filter(SystemSettings.key == "lumiqbrain_api_key").first()
    is_set = bool(row and row.value)
    masked = ("*" * 24 + row.value[-8:]) if (row and row.value and len(row.value) > 8) else (row.value if row else "")
    return {"lumiqbrain_api_key": {"is_set": is_set, "masked": masked}}


@router.post("/admin/generate-key")
def admin_generate_key(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """管理者専用: lumiqbrain 用 APIキーを生成して保存する。"""
    if not getattr(current_user, "is_system_admin", False):
        raise HTTPException(status_code=403, detail="システム管理者のみアクセス可能です")
    new_key = "lbr_" + secrets.token_hex(24)
    row = db.query(SystemSettings).filter(SystemSettings.key == "lumiqbrain_api_key").first()
    if row:
        row.value = new_key
    else:
        db.add(SystemSettings(key="lumiqbrain_api_key", value=new_key))
    db.commit()
    return {"api_key": new_key, "message": "APIキーを生成しました。安全な場所に保管してください（この画面でのみ全文表示されます）"}


@router.delete("/admin/revoke-key")
def admin_revoke_key(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """管理者専用: lumiqbrain 用 APIキーを無効化する。"""
    if not getattr(current_user, "is_system_admin", False):
        raise HTTPException(status_code=403, detail="システム管理者のみアクセス可能です")
    row = db.query(SystemSettings).filter(SystemSettings.key == "lumiqbrain_api_key").first()
    if row:
        row.value = ""
        db.commit()
    return {"message": "APIキーを無効化しました"}


@router.get("/stats")
def get_stats(
    _auth: bool = Depends(require_lumiqbrain_key),
    db: Session = Depends(get_db),
):
    """
    lumiqbrain 用の集計サマリーを返す。
    """
    from sqlalchemy import func

    total = db.query(func.count(CompanyMaster.id)).scalar() or 0
    with_url = db.query(func.count(CompanyMaster.id)).filter(
        CompanyMaster.website_url != None, CompanyMaster.website_url != ""
    ).scalar() or 0
    ec_count = db.query(func.count(CompanyMaster.id)).filter(CompanyMaster.ec_flag == True).scalar() or 0
    rank_counts = {}
    for rank in ["A", "B", "C", "D"]:
        rank_counts[rank] = db.query(func.count(CompanyMaster.id)).filter(
            CompanyMaster.score_rank == rank
        ).scalar() or 0

    avg_maturity = db.query(func.avg(CompanyMaster.digital_maturity_score)).scalar()

    return {
        "total_companies": total,
        "companies_with_url": with_url,
        "ec_companies": ec_count,
        "rank_distribution": rank_counts,
        "avg_digital_maturity_score": round(float(avg_maturity), 1) if avg_maturity else 0,
        "generated_at": datetime.utcnow().isoformat(),
    }
