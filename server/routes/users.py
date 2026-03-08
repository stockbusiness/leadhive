import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from server.database import get_db
from server.models import User, OrgInvitation
from server.auth import get_current_user, require_admin, require_phase0_unlock, hash_password

router = APIRouter(prefix="/api/users", tags=["users"])


class InviteRequest(BaseModel):
    email: str
    role: str = "member"


class RoleUpdateRequest(BaseModel):
    role: str


def _user_to_dict(u: User) -> dict:
    return {
        "id": u.id,
        "email": u.email,
        "display_name": u.display_name or "",
        "role": u.role,
        "org_id": u.org_id,
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }


@router.get("")
def list_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    users = db.query(User).filter(User.org_id == current_user.org_id).all()
    invitations = db.query(OrgInvitation).filter(
        OrgInvitation.org_id == current_user.org_id,
        OrgInvitation.accepted_at.is_(None),
        OrgInvitation.expires_at > datetime.utcnow(),
    ).all()
    return {
        "users": [_user_to_dict(u) for u in users],
        "pending_invitations": [
            {
                "id": inv.id,
                "email": inv.email,
                "role": inv.role,
                "expires_at": inv.expires_at.isoformat(),
                "created_at": inv.created_at.isoformat() if inv.created_at else None,
            }
            for inv in invitations
        ],
    }


@router.post("/invite")
def invite_user(
    body: InviteRequest,
    current_user: User = Depends(require_phase0_unlock),
    db: Session = Depends(get_db),
):
    from server.models import AppSetting, Organization
    from server.services.mailer import get_smtp_settings, send_email
    from server.routes.plans import check_plan_limit

    existing = db.query(User).filter(User.email == body.email).first()
    if existing and existing.org_id == current_user.org_id:
        raise HTTPException(status_code=400, detail="このユーザーは既に組織に参加しています")

    check_plan_limit(current_user.org_id, "members", db)

    existing_invite = db.query(OrgInvitation).filter(
        OrgInvitation.org_id == current_user.org_id,
        OrgInvitation.email == body.email,
        OrgInvitation.accepted_at.is_(None),
        OrgInvitation.expires_at > datetime.utcnow(),
    ).first()
    if existing_invite:
        db.delete(existing_invite)
        db.flush()

    token = str(uuid.uuid4())
    expires_at = datetime.utcnow() + timedelta(days=7)
    invitation = OrgInvitation(
        org_id=current_user.org_id,
        email=body.email,
        token=token,
        role=body.role,
        invited_by=current_user.id,
        expires_at=expires_at,
    )
    db.add(invitation)
    db.commit()

    org = db.query(Organization).filter(Organization.id == current_user.org_id).first()
    org_name = org.name if org else "ESCMS"

    smtp_cfg = get_smtp_settings(db, current_user.org_id)
    invite_url = f"/accept-invite/{token}"
    html_body = f"""
    <p>{current_user.display_name or current_user.email} さんから <strong>{org_name}</strong> への招待が届きました。</p>
    <p>以下のリンクから7日以内に参加してください。</p>
    <p><a href="{invite_url}" style="background:#2563eb;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">招待を承認する</a></p>
    <p style="color:#888;font-size:12px;">このメールに心当たりがない場合は無視してください。</p>
    """
    text_body = f"{org_name} への招待: {invite_url}"

    smtp_ok = bool(smtp_cfg.get("smtp_host"))
    if smtp_ok:
        send_email(body.email, f"{org_name} への招待", html_body, smtp_cfg, text_body)

    return {
        "message": "招待を送信しました" if smtp_ok else "招待リンクを生成しました（SMTPが未設定のためメール送信をスキップ）",
        "invite_url": invite_url,
        "token": token,
        "smtp_configured": smtp_ok,
    }


@router.delete("/invitations/{invitation_id}")
def cancel_invitation(
    invitation_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    inv = db.query(OrgInvitation).filter(
        OrgInvitation.id == invitation_id,
        OrgInvitation.org_id == current_user.org_id,
    ).first()
    if not inv:
        raise HTTPException(status_code=404, detail="招待が見つかりません")
    db.delete(inv)
    db.commit()
    return {"message": "招待をキャンセルしました"}


@router.put("/{user_id}/role")
def update_role(
    user_id: int,
    body: RoleUpdateRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if body.role not in ("admin", "member"):
        raise HTTPException(status_code=400, detail="ロールは admin または member を指定してください")
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="自分自身のロールは変更できません")
    user = db.query(User).filter(User.id == user_id, User.org_id == current_user.org_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="ユーザーが見つかりません")
    user.role = body.role
    db.commit()
    return {"message": "ロールを変更しました", "user": _user_to_dict(user)}


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="自分自身は削除できません")
    user = db.query(User).filter(User.id == user_id, User.org_id == current_user.org_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="ユーザーが見つかりません")
    db.delete(user)
    db.commit()
    return {"message": "ユーザーを削除しました"}
