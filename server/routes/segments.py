from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from server.database import get_db
from server.models import Segment, User
from server.auth import get_current_user, require_phase0_unlock

router = APIRouter(prefix="/api/segments", tags=["segments"])


def _segment_to_dict(s: Segment, creator_email: str = None) -> dict:
    return {
        "id": s.id,
        "org_id": s.org_id,
        "created_by": s.created_by,
        "creator_email": creator_email,
        "name": s.name,
        "description": s.description,
        "filters": s.filters,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }


@router.get("")
def list_segments(
    current_user: User = Depends(require_phase0_unlock),
    db: Session = Depends(get_db),
):
    segments = (
        db.query(Segment)
        .filter(Segment.org_id == current_user.org_id)
        .order_by(Segment.created_at.desc())
        .all()
    )
    creator_emails: dict[int, str] = {}
    for s in segments:
        if s.created_by and s.created_by not in creator_emails:
            u = db.query(User).filter(User.id == s.created_by).first()
            if u:
                creator_emails[s.created_by] = u.display_name or u.email

    return {
        "segments": [
            _segment_to_dict(s, creator_emails.get(s.created_by))
            for s in segments
        ]
    }


@router.post("")
def create_segment(
    data: dict,
    current_user: User = Depends(require_phase0_unlock),
    db: Session = Depends(get_db),
):
    name = (data.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="セグメント名を入力してください")

    filters = data.get("filters")
    if not isinstance(filters, dict):
        raise HTTPException(status_code=400, detail="filtersが不正です")

    count = db.query(Segment).filter(Segment.org_id == current_user.org_id).count()
    if count >= 50:
        raise HTTPException(status_code=400, detail="セグメントの上限（50件）に達しています")

    seg = Segment(
        org_id=current_user.org_id,
        created_by=current_user.id,
        name=name,
        description=(data.get("description") or "").strip() or None,
        filters=filters,
    )
    db.add(seg)
    db.commit()
    db.refresh(seg)
    return {"segment": _segment_to_dict(seg, current_user.display_name or current_user.email)}


@router.put("/{segment_id}")
def update_segment(
    segment_id: int,
    data: dict,
    current_user: User = Depends(require_phase0_unlock),
    db: Session = Depends(get_db),
):
    seg = db.query(Segment).filter(
        Segment.id == segment_id,
        Segment.org_id == current_user.org_id,
    ).first()
    if not seg:
        raise HTTPException(status_code=404, detail="セグメントが見つかりません")

    if "name" in data:
        name = (data["name"] or "").strip()
        if not name:
            raise HTTPException(status_code=400, detail="セグメント名を入力してください")
        seg.name = name

    if "description" in data:
        seg.description = (data["description"] or "").strip() or None

    if "filters" in data and isinstance(data["filters"], dict):
        seg.filters = data["filters"]

    db.commit()
    db.refresh(seg)
    return {"segment": _segment_to_dict(seg)}


@router.delete("/{segment_id}")
def delete_segment(
    segment_id: int,
    current_user: User = Depends(require_phase0_unlock),
    db: Session = Depends(get_db),
):
    seg = db.query(Segment).filter(
        Segment.id == segment_id,
        Segment.org_id == current_user.org_id,
    ).first()
    if not seg:
        raise HTTPException(status_code=404, detail="セグメントが見つかりません")
    db.delete(seg)
    db.commit()
    return {"ok": True}
