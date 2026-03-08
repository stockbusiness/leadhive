import os
import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from server.database import get_db
from server.models import Organization, User, OrgInvitation, PasswordResetToken, EmailVerificationToken
from server.auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    org_name: str
    email: str
    password: str
    display_name: str = ""
    phone: str = ""
    corporate_number: str = ""


class LoginRequest(BaseModel):
    email: str
    password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class ProfileUpdateRequest(BaseModel):
    display_name: str = None
    email: str = None
    current_password: str = None
    new_password: str = None


class AcceptInviteRequest(BaseModel):
    display_name: str = ""
    password: str


class ResendVerificationRequest(BaseModel):
    email: str


def _user_response(user: User, org: Organization) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "role": user.role,
        "org_id": user.org_id,
        "org_name": org.name if org else "",
        "display_name": user.display_name or "",
        "onboarding_completed": org.onboarding_completed if org else False,
        "is_system_admin": bool(user.is_system_admin),
        "is_founder": bool(user.is_founder),
        "registration_number": user.registration_number,
    }


def _get_base_url(request: Request) -> str:
    host = request.headers.get("x-forwarded-host") or request.headers.get("host", "")
    proto = request.headers.get("x-forwarded-proto", "https")
    if host:
        return f"{proto}://{host}"
    return os.environ.get("APP_BASE_URL", "https://leadhive.work")


def _create_verification_token(user_id: int, db: Session) -> str:
    db.query(EmailVerificationToken).filter(
        EmailVerificationToken.user_id == user_id,
        EmailVerificationToken.used_at.is_(None),
    ).delete()
    db.flush()
    token_str = str(uuid.uuid4())
    ev_token = EmailVerificationToken(
        user_id=user_id,
        token=token_str,
        expires_at=datetime.utcnow() + timedelta(hours=24),
    )
    db.add(ev_token)
    db.flush()
    return token_str


DEFAULT_VERIFICATION_HTML = """<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
  <div style="background:#1e3a5f;border-radius:12px;padding:24px;margin-bottom:24px;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:22px;">LeadHive</h1>
    <p style="color:#93c5fd;margin:6px 0 0;font-size:13px;">営業先リスト自動化ツール</p>
  </div>
  <h2 style="color:#1e293b;font-size:18px;margin-bottom:8px;">メールアドレスの確認</h2>
  <p style="color:#475569;font-size:14px;line-height:1.6;">
    LeadHiveへのご登録ありがとうございます。<br>
    以下のボタンをクリックしてメールアドレスを確認してください。
  </p>
  <div style="text-align:center;margin:28px 0;">
    <a href="{{verify_url}}"
       style="background:#2563eb;color:#fff;padding:14px 32px;border-radius:8px;
              text-decoration:none;font-size:15px;font-weight:600;display:inline-block;">
      メールアドレスを確認する
    </a>
  </div>
  <p style="color:#94a3b8;font-size:12px;text-align:center;">
    このリンクは24時間有効です。<br>
    このメールに心当たりがない場合は無視してください。
  </p>
</div>"""

DEFAULT_VERIFICATION_TEXT = "LeadHiveへのご登録ありがとうございます。\n以下のURLからメールアドレスを確認してください。\n{{verify_url}}\n（24時間有効）"
DEFAULT_VERIFICATION_SUBJECT = "【LeadHive】メールアドレスの確認"


def _get_tpl(db: Session, key: str, default: str) -> str:
    from server.models import SystemSettings
    row = db.query(SystemSettings).filter(SystemSettings.key == key).first()
    return row.value if row and row.value else default


def _render_tpl(template: str, vars: dict) -> str:
    result = template
    for k, v in vars.items():
        result = result.replace("{{" + k + "}}", v)
    return result


def _send_verification_email(user_email: str, token_str: str, base_url: str, db: Session) -> bool:
    from server.services.mailer import get_system_smtp_settings, send_email
    smtp_cfg = get_system_smtp_settings(db)
    if not smtp_cfg.get("smtp_host"):
        return False
    verify_url = f"{base_url}/verify-email?token={token_str}"
    tpl_vars = {"verify_url": verify_url, "user_email": user_email, "site_name": "LeadHive"}
    subject = _render_tpl(_get_tpl(db, "email_tpl_verification_subject", DEFAULT_VERIFICATION_SUBJECT), tpl_vars)
    html_body = _render_tpl(_get_tpl(db, "email_tpl_verification_html", DEFAULT_VERIFICATION_HTML), tpl_vars)
    text_body = _render_tpl(_get_tpl(db, "email_tpl_verification_text", DEFAULT_VERIFICATION_TEXT), tpl_vars)
    ok, _ = send_email(user_email, subject, html_body, smtp_cfg, text_body)
    return ok


@router.post("/register")
def register(request: Request, body: RegisterRequest, db: Session = Depends(get_db)):
    from sqlalchemy import func as sqlfunc
    from server.models import Plan

    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=400, detail="このメールアドレスは既に登録されています")

    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="パスワードは8文字以上で入力してください")

    org = Organization(
        name=body.org_name,
        phone=body.phone or None,
        corporate_number=body.corporate_number or None,
        corporate_verified=False,
    )
    db.add(org)
    db.flush()

    reg_number = (db.query(sqlfunc.count(User.id)).scalar() or 0) + 1
    is_founder = reg_number <= 50

    founder_plan = db.query(Plan).filter(Plan.name == "Founder").first() if is_founder else None
    if founder_plan:
        org.plan_id = founder_plan.id
    else:
        free_plan = db.query(Plan).filter(Plan.name == "フリー").first()
        if free_plan:
            org.plan_id = free_plan.id

    user = User(
        org_id=org.id,
        email=body.email,
        password_hash=hash_password(body.password),
        role="admin",
        display_name=body.display_name or None,
        registration_number=reg_number,
        is_founder=is_founder,
        email_verified=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token_str = _create_verification_token(user.id, db)
    db.commit()

    base_url = _get_base_url(request)
    email_sent = _send_verification_email(body.email, token_str, base_url, db)

    return {
        "requires_verification": True,
        "email": body.email,
        "email_sent": email_sent,
        "verify_url": f"/verify-email?token={token_str}" if not email_sent else None,
    }


@router.get("/verify-email/{token}")
def verify_email(token: str, db: Session = Depends(get_db)):
    ev_token = db.query(EmailVerificationToken).filter(
        EmailVerificationToken.token == token,
        EmailVerificationToken.used_at.is_(None),
        EmailVerificationToken.expires_at > datetime.utcnow(),
    ).first()
    if not ev_token:
        raise HTTPException(status_code=400, detail="確認リンクが無効または期限切れです")

    user = db.query(User).filter(User.id == ev_token.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="ユーザーが見つかりません")

    user.email_verified = True
    ev_token.used_at = datetime.utcnow()
    db.commit()
    db.refresh(user)

    org = db.query(Organization).filter(Organization.id == user.org_id).first()
    jwt = create_access_token({"sub": str(user.id)})
    return {
        "access_token": jwt,
        "token_type": "bearer",
        "user": _user_response(user, org),
    }


@router.post("/resend-verification")
def resend_verification(request: Request, body: ResendVerificationRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user:
        return {"message": "確認メールを送信しました（アドレスが登録されている場合）"}
    if user.email_verified:
        return {"message": "既にメールアドレスは確認済みです"}

    token_str = _create_verification_token(user.id, db)
    db.commit()

    base_url = _get_base_url(request)
    email_sent = _send_verification_email(body.email, token_str, base_url, db)
    return {
        "message": "確認メールを送信しました（アドレスが登録されている場合）",
        "email_sent": email_sent,
        "verify_url": f"/verify-email?token={token_str}" if not email_sent else None,
    }


@router.post("/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="メールアドレスまたはパスワードが正しくありません")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="アカウントが停止されています。管理者にお問い合わせください。")
    if not user.email_verified:
        raise HTTPException(
            status_code=403,
            detail="メールアドレスの確認が完了していません。登録時に送信した確認メールをご確認ください。",
            headers={"X-Verification-Required": "true"},
        )

    user.last_login_at = datetime.utcnow()
    db.commit()

    org = db.query(Organization).filter(Organization.id == user.org_id).first()
    token = create_access_token({"sub": str(user.id)})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": _user_response(user, org),
    }


@router.get("/me")
def me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    org = db.query(Organization).filter(Organization.id == current_user.org_id).first()
    return _user_response(current_user, org)


@router.put("/profile")
def update_profile(
    body: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.display_name is not None:
        current_user.display_name = body.display_name

    if body.email and body.email != current_user.email:
        existing = db.query(User).filter(User.email == body.email, User.id != current_user.id).first()
        if existing:
            raise HTTPException(status_code=400, detail="このメールアドレスは既に使用されています")
        current_user.email = body.email

    if body.new_password:
        if not body.current_password:
            raise HTTPException(status_code=400, detail="現在のパスワードを入力してください")
        if not verify_password(body.current_password, current_user.password_hash):
            raise HTTPException(status_code=400, detail="現在のパスワードが正しくありません")
        if len(body.new_password) < 8:
            raise HTTPException(status_code=400, detail="新しいパスワードは8文字以上で入力してください")
        current_user.password_hash = hash_password(body.new_password)

    db.commit()
    db.refresh(current_user)
    org = db.query(Organization).filter(Organization.id == current_user.org_id).first()
    return {"message": "プロフィールを更新しました", "user": _user_response(current_user, org)}


@router.post("/forgot-password")
def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user:
        return {"message": "パスワードリセットメールを送信しました（アドレスが登録されている場合）"}

    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used_at.is_(None),
    ).delete()
    db.flush()

    token_str = str(uuid.uuid4())
    reset_token = PasswordResetToken(
        user_id=user.id,
        token=token_str,
        expires_at=datetime.utcnow() + timedelta(hours=1),
    )
    db.add(reset_token)
    db.commit()

    from server.services.mailer import get_smtp_settings, send_email
    smtp_cfg = get_smtp_settings(db, user.org_id)
    reset_url = f"/reset-password?token={token_str}"
    html_body = f"""
    <p>パスワードリセットのリクエストを受け付けました。</p>
    <p>以下のリンクから1時間以内にパスワードを再設定してください。</p>
    <p><a href="{reset_url}" style="background:#2563eb;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">パスワードをリセットする</a></p>
    <p style="color:#888;font-size:12px;">このメールに心当たりがない場合は無視してください。</p>
    """
    if smtp_cfg.get("smtp_host"):
        send_email(user.email, "パスワードリセット - LeadHive", html_body, smtp_cfg)

    return {
        "message": "パスワードリセットメールを送信しました（アドレスが登録されている場合）",
        "reset_url": reset_url,
    }


@router.post("/reset-password")
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    reset_token = db.query(PasswordResetToken).filter(
        PasswordResetToken.token == body.token,
        PasswordResetToken.used_at.is_(None),
        PasswordResetToken.expires_at > datetime.utcnow(),
    ).first()
    if not reset_token:
        raise HTTPException(status_code=400, detail="リセットリンクが無効または期限切れです")

    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="パスワードは8文字以上で入力してください")

    user = db.query(User).filter(User.id == reset_token.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="ユーザーが見つかりません")

    user.password_hash = hash_password(body.new_password)
    reset_token.used_at = datetime.utcnow()
    db.commit()

    return {"message": "パスワードをリセットしました。ログインしてください"}


@router.get("/invite/{token}")
def get_invitation(token: str, db: Session = Depends(get_db)):
    inv = db.query(OrgInvitation).filter(
        OrgInvitation.token == token,
        OrgInvitation.accepted_at.is_(None),
        OrgInvitation.expires_at > datetime.utcnow(),
    ).first()
    if not inv:
        raise HTTPException(status_code=400, detail="招待リンクが無効または期限切れです")
    org = db.query(Organization).filter(Organization.id == inv.org_id).first()
    return {
        "email": inv.email,
        "org_name": org.name if org else "",
        "role": inv.role,
        "expires_at": inv.expires_at.isoformat(),
    }


@router.post("/invite/{token}/accept")
def accept_invitation(token: str, body: AcceptInviteRequest, db: Session = Depends(get_db)):
    inv = db.query(OrgInvitation).filter(
        OrgInvitation.token == token,
        OrgInvitation.accepted_at.is_(None),
        OrgInvitation.expires_at > datetime.utcnow(),
    ).first()
    if not inv:
        raise HTTPException(status_code=400, detail="招待リンクが無効または期限切れです")

    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="パスワードは8文字以上で入力してください")

    existing = db.query(User).filter(User.email == inv.email).first()
    if existing:
        existing.org_id = inv.org_id
        existing.role = inv.role
        if body.display_name:
            existing.display_name = body.display_name
        user = existing
    else:
        user = User(
            org_id=inv.org_id,
            email=inv.email,
            password_hash=hash_password(body.password),
            role=inv.role,
            display_name=body.display_name or None,
            email_verified=True,
        )
        db.add(user)

    inv.accepted_at = datetime.utcnow()
    db.commit()
    db.refresh(user)

    org = db.query(Organization).filter(Organization.id == user.org_id).first()
    token_str = create_access_token({"sub": str(user.id)})
    return {
        "access_token": token_str,
        "token_type": "bearer",
        "user": _user_response(user, org),
    }
