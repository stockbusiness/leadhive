from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from server.database import get_db
from server.auth import get_current_user
from server.models import User, FormSenderProfile

router = APIRouter(prefix="/api/form-profiles", tags=["form-profiles"])


def _serialize(p: FormSenderProfile) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "company_name": p.company_name or "",
        "display_name": p.display_name or "",
        "title": p.title or "",
        "department": p.department or "",
        "phone": p.phone or "",
        "email": p.email or "",
        "website_url": p.website_url or "",
        "prefecture": p.prefecture or "",
        "address": p.address or "",
        "is_default": bool(p.is_default),
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


class ProfileBody(BaseModel):
    name: str
    company_name: Optional[str] = ""
    display_name: Optional[str] = ""
    title: Optional[str] = ""
    department: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""
    website_url: Optional[str] = ""
    prefecture: Optional[str] = ""
    address: Optional[str] = ""
    is_default: Optional[bool] = False


@router.get("")
def list_profiles(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profiles = db.query(FormSenderProfile).filter(
        FormSenderProfile.org_id == current_user.org_id
    ).order_by(FormSenderProfile.is_default.desc(), FormSenderProfile.created_at).all()
    return {"profiles": [_serialize(p) for p in profiles]}


@router.post("")
def create_profile(
    body: ProfileBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="プロフィール名を入力してください")

    if body.is_default:
        db.query(FormSenderProfile).filter(
            FormSenderProfile.org_id == current_user.org_id
        ).update({"is_default": False})

    profile = FormSenderProfile(
        org_id=current_user.org_id,
        name=name,
        company_name=body.company_name or None,
        display_name=body.display_name or None,
        title=body.title or None,
        department=body.department or None,
        phone=body.phone or None,
        email=body.email or None,
        website_url=body.website_url or None,
        prefecture=body.prefecture or None,
        address=body.address or None,
        is_default=bool(body.is_default),
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return {"profile": _serialize(profile)}


@router.put("/{profile_id}")
def update_profile(
    profile_id: int,
    body: ProfileBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.query(FormSenderProfile).filter(
        FormSenderProfile.id == profile_id,
        FormSenderProfile.org_id == current_user.org_id,
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="プロフィールが見つかりません")

    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="プロフィール名を入力してください")

    if body.is_default:
        db.query(FormSenderProfile).filter(
            FormSenderProfile.org_id == current_user.org_id,
            FormSenderProfile.id != profile_id,
        ).update({"is_default": False})

    profile.name = name
    profile.company_name = body.company_name or None
    profile.display_name = body.display_name or None
    profile.title = body.title or None
    profile.department = body.department or None
    profile.phone = body.phone or None
    profile.email = body.email or None
    profile.website_url = body.website_url or None
    profile.prefecture = body.prefecture or None
    profile.address = body.address or None
    profile.is_default = bool(body.is_default)
    db.commit()
    db.refresh(profile)
    return {"profile": _serialize(profile)}


@router.delete("/{profile_id}")
def delete_profile(
    profile_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.query(FormSenderProfile).filter(
        FormSenderProfile.id == profile_id,
        FormSenderProfile.org_id == current_user.org_id,
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="プロフィールが見つかりません")
    db.delete(profile)
    db.commit()
    return {"ok": True}


@router.post("/{profile_id}/set-default")
def set_default(
    profile_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.query(FormSenderProfile).filter(
        FormSenderProfile.id == profile_id,
        FormSenderProfile.org_id == current_user.org_id,
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="プロフィールが見つかりません")
    db.query(FormSenderProfile).filter(
        FormSenderProfile.org_id == current_user.org_id
    ).update({"is_default": False})
    profile.is_default = True
    db.commit()
    return {"ok": True}
