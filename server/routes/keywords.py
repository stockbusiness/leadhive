from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from server.database import get_db
from server.models import SearchKeyword

router = APIRouter(prefix="/api/keywords", tags=["keywords"])


@router.get("")
def list_keywords(db: Session = Depends(get_db)):
    keywords = db.query(SearchKeyword).order_by(SearchKeyword.created_at.desc()).all()
    return {
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


@router.post("")
def create_keyword(data: dict, db: Session = Depends(get_db)):
    keyword = SearchKeyword(
        keyword=data["keyword"],
        category=data.get("category", ""),
        region=data.get("region", ""),
        exclude_keywords=data.get("exclude_keywords", ""),
        is_active=data.get("is_active", True),
    )
    db.add(keyword)
    db.commit()
    db.refresh(keyword)
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
def update_keyword(keyword_id: int, data: dict, db: Session = Depends(get_db)):
    keyword = db.query(SearchKeyword).filter(SearchKeyword.id == keyword_id).first()
    if not keyword:
        return {"error": "キーワードが見つかりません"}

    for key, value in data.items():
        if hasattr(keyword, key) and key not in ("id", "created_at"):
            setattr(keyword, key, value)

    db.commit()
    db.refresh(keyword)
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


@router.delete("/{keyword_id}")
def delete_keyword(keyword_id: int, db: Session = Depends(get_db)):
    keyword = db.query(SearchKeyword).filter(SearchKeyword.id == keyword_id).first()
    if not keyword:
        return {"error": "キーワードが見つかりません"}
    db.delete(keyword)
    db.commit()
    return {"message": "削除しました"}
