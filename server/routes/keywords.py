from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from server.database import get_db
from server.models import SearchKeyword, CollectionLog, User
from server.auth import get_current_user
from server.services.cache import cache_get, cache_set, cache_invalidate

router = APIRouter(prefix="/api/keywords", tags=["keywords"])


@router.get("")
def list_keywords(
    project_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cache_key = f"keywords_list_{project_id}" if project_id else "keywords_list"
    cached = cache_get(cache_key, ttl=30)
    if cached:
        return cached
    q = db.query(SearchKeyword)
    if project_id:
        q = q.filter(SearchKeyword.project_id == project_id)
    keywords = q.order_by(SearchKeyword.created_at.desc()).all()
    result = {
        "keywords": [
            {
                "id": k.id,
                "keyword": k.keyword,
                "category": k.category,
                "region": k.region,
                "exclude_keywords": k.exclude_keywords,
                "is_active": k.is_active,
                "created_at": k.created_at.isoformat() if k.created_at else None,
            }
            for k in keywords
        ]
    }
    cache_set(cache_key, result)
    return result


@router.post("")
def create_keyword(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    keyword = SearchKeyword(
        keyword=data["keyword"],
        category=data.get("category", ""),
        region=data.get("region", ""),
        exclude_keywords=data.get("exclude_keywords", ""),
        is_active=data.get("is_active", True),
        project_id=data.get("project_id"),
    )
    db.add(keyword)
    db.commit()
    db.refresh(keyword)
    cache_invalidate("keywords")
    return {
        "keyword": {
            "id": keyword.id,
            "keyword": keyword.keyword,
            "category": keyword.category,
            "region": keyword.region,
            "exclude_keywords": keyword.exclude_keywords,
            "is_active": keyword.is_active,
            "created_at": keyword.created_at.isoformat() if keyword.created_at else None,
        }
    }


@router.put("/{keyword_id}")
def update_keyword(
    keyword_id: int,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    keyword = db.query(SearchKeyword).filter(SearchKeyword.id == keyword_id).first()
    if not keyword:
        return {"error": "キーワードが見つかりません"}

    for key, value in data.items():
        if hasattr(keyword, key) and key not in ("id", "created_at"):
            setattr(keyword, key, value)

    db.commit()
    db.refresh(keyword)
    cache_invalidate("keywords")
    return {
        "keyword": {
            "id": keyword.id,
            "keyword": keyword.keyword,
            "category": keyword.category,
            "region": keyword.region,
            "exclude_keywords": keyword.exclude_keywords,
            "is_active": keyword.is_active,
            "created_at": keyword.created_at.isoformat() if keyword.created_at else None,
        }
    }


@router.get("/analytics")
def get_keyword_analytics(
    project_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(
        CollectionLog.keyword_id,
        CollectionLog.keyword_text,
        func.count(CollectionLog.id).label("total_runs"),
        func.sum(CollectionLog.total_found).label("total_found"),
        func.sum(CollectionLog.success_count).label("success_count"),
        func.sum(CollectionLog.duplicate_count).label("duplicate_count"),
        func.sum(CollectionLog.rejected_count).label("rejected_count"),
        func.sum(CollectionLog.error_count).label("error_count"),
        func.max(CollectionLog.created_at).label("last_run_at"),
    ).filter(CollectionLog.project_id == project_id) if project_id else db.query(
        CollectionLog.keyword_id,
        CollectionLog.keyword_text,
        func.count(CollectionLog.id).label("total_runs"),
        func.sum(CollectionLog.total_found).label("total_found"),
        func.sum(CollectionLog.success_count).label("success_count"),
        func.sum(CollectionLog.duplicate_count).label("duplicate_count"),
        func.sum(CollectionLog.rejected_count).label("rejected_count"),
        func.sum(CollectionLog.error_count).label("error_count"),
        func.max(CollectionLog.created_at).label("last_run_at"),
    ).filter(
        CollectionLog.project_id.in_(
            db.query(SearchKeyword.project_id).filter(
                SearchKeyword.project_id.isnot(None)
            )
        )
    )

    rows = q.group_by(CollectionLog.keyword_id, CollectionLog.keyword_text).all()

    analytics = []
    total_success = 0
    total_api_calls = 0
    total_runs_all = 0

    for row in rows:
        tf = row.total_found or 0
        sc = row.success_count or 0
        dc = row.duplicate_count or 0
        rc = row.rejected_count or 0
        ec = row.error_count or 0
        runs = row.total_runs or 0
        success_rate = round((sc / tf * 100) if tf > 0 else 0.0, 1)
        duplicate_rate = round((dc / tf * 100) if tf > 0 else 0.0, 1)
        rejected_rate = round((rc / tf * 100) if tf > 0 else 0.0, 1)
        total_success += sc
        total_api_calls += tf
        total_runs_all += runs
        analytics.append({
            "keyword_id": row.keyword_id,
            "keyword_text": row.keyword_text or "（不明）",
            "total_runs": runs,
            "total_found": tf,
            "success_count": sc,
            "duplicate_count": dc,
            "rejected_count": rc,
            "error_count": ec,
            "last_run_at": row.last_run_at.isoformat() if row.last_run_at else None,
            "success_rate": success_rate,
            "duplicate_rate": duplicate_rate,
            "rejected_rate": rejected_rate,
        })

    analytics.sort(key=lambda x: x["success_count"], reverse=True)
    avg_success_rate = round(
        sum(a["success_rate"] for a in analytics) / len(analytics) if analytics else 0.0, 1
    )

    return {
        "analytics": analytics,
        "summary": {
            "total_companies_collected": total_success,
            "total_api_calls": total_api_calls,
            "avg_success_rate": avg_success_rate,
            "total_runs": total_runs_all,
            "keyword_count": len(analytics),
        },
    }


@router.delete("/{keyword_id}")
def delete_keyword(
    keyword_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    keyword = db.query(SearchKeyword).filter(SearchKeyword.id == keyword_id).first()
    if not keyword:
        return {"error": "キーワードが見つかりません"}
    db.delete(keyword)
    db.commit()
    cache_invalidate("keywords")
    return {"message": "削除しました"}
