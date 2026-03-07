from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from server.database import get_db
from server.models import RejectedUrl, User
from server.auth import get_current_user

router = APIRouter(prefix="/api/rejected", tags=["rejected"])


@router.get("")
def list_rejected(
    project_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(RejectedUrl)
    if project_id:
        q = q.filter(RejectedUrl.project_id == project_id)
    items = q.order_by(RejectedUrl.created_at.desc()).all()
    return {
        "rejected": [
            {
                "id": r.id,
                "domain": r.domain,
                "url": r.url,
                "reason": r.reason,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in items
        ]
    }


@router.post("")
def add_rejected(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    domain = data.get("domain", "").strip()
    if not domain:
        raise HTTPException(status_code=400, detail="ドメインを入力してください")

    existing = db.query(RejectedUrl).filter(RejectedUrl.domain == domain).first()
    if existing:
        raise HTTPException(status_code=409, detail="このドメインは既に登録されています")

    item = RejectedUrl(
        domain=domain,
        url=data.get("url", ""),
        reason=data.get("reason", "手動追加"),
        project_id=data.get("project_id"),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return {
        "rejected": {
            "id": item.id,
            "domain": item.domain,
            "url": item.url,
            "reason": item.reason,
            "created_at": item.created_at.isoformat() if item.created_at else None,
        }
    }


@router.delete("/{item_id}")
def delete_rejected(
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = db.query(RejectedUrl).filter(RejectedUrl.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="見つかりません")
    db.delete(item)
    db.commit()
    return {"message": "削除しました"}
