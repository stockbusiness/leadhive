import os
import uuid
import logging
import json
import io
import base64
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.responses import StreamingResponse

logger = logging.getLogger(__name__)

from sqlalchemy.orm import Session
from pydantic import BaseModel
from server.database import get_db
from server.models import Organization, User, OrgInvitation, PasswordResetToken, EmailVerificationToken
from server.auth import hash_password, verify_password, create_access_token, get_current_user
from server.services.rate_limiter import limiter

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    org_name: str
    email: str
    password: str
    display_name: str = ""
    phone: str = ""
    corporate_number: str = ""
    terms_accepted: bool = False


class LoginRequest(BaseModel):
    email: str
    password: str
    totp_code: Optional[str] = None


class TotpSetupConfirmRequest(BaseModel):
    totp_code: str
    secret: str


class TotpDisableRequest(BaseModel):
    password: str


class DeleteAccountRequest(BaseModel):
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
        "totp_enabled": bool(user.totp_enabled),
        "terms_accepted_at": user.terms_accepted_at.isoformat() if user.terms_accepted_at else None,
        "feature_ec_discovery": bool(org.feature_ec_discovery) if org else False,
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
@limiter.limit("5/minute")
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
        terms_accepted_at=datetime.utcnow() if body.terms_accepted else None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token_str = _create_verification_token(user.id, db)
    db.commit()

    try:
        from server.services.commitrev import send_lead_created
        send_lead_created(db=db, user_id=user.id, email=body.email, org_name=body.org_name)
    except Exception as _cr_err:
        logger.warning("CommitRev lead_created error: %s", _cr_err)

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

    try:
        from server.services.commitrev import send_lead_created
        send_lead_created(db, user_id=user.id, email=user.email, org_name=org.name if org else "")
    except Exception as _cr_err:
        logger.warning("CommitRev lead_created error: %s", _cr_err)

    try:
        _send_welcome_email(user.email, user.display_name or user.email, db, user.org_id)
    except Exception as _we_err:
        logger.warning("Welcome email error: %s", _we_err)

    jwt = create_access_token({"sub": str(user.id), "tv": user.token_version or 1})
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


def _log_security_event(db: Session, event_type: str, user_id=None, org_id=None, ip_address=None, user_agent=None, details=None):
    try:
        from server.models import SecurityEvent
        ev = SecurityEvent(
            event_type=event_type,
            user_id=user_id,
            org_id=org_id,
            ip_address=ip_address,
            user_agent=user_agent,
            details=details or {},
        )
        db.add(ev)
        db.commit()
    except Exception:
        pass


MAX_FAILED_LOGINS = 5
LOCKOUT_MINUTES = 30


@router.post("/login")
@limiter.limit("10/minute")
def login(body: LoginRequest, request: Request, db: Session = Depends(get_db)):
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown")
    ua = request.headers.get("user-agent", "")

    user = db.query(User).filter(User.email == body.email).first()

    if user:
        if user.locked_until and user.locked_until > datetime.utcnow():
            remaining = int((user.locked_until - datetime.utcnow()).total_seconds() / 60) + 1
            _log_security_event(db, "login_blocked", user_id=user.id, org_id=user.org_id,
                                ip_address=ip, user_agent=ua,
                                details={"email": body.email, "reason": "account_locked"})
            raise HTTPException(status_code=403, detail=f"アカウントがロックされています。約{remaining}分後に再試行してください。")

        if not verify_password(body.password, user.password_hash):
            count = (user.failed_login_count or 0) + 1
            user.failed_login_count = count
            if count >= MAX_FAILED_LOGINS:
                user.locked_until = datetime.utcnow() + timedelta(minutes=LOCKOUT_MINUTES)
                db.commit()
                _log_security_event(db, "account_locked", user_id=user.id, org_id=user.org_id,
                                    ip_address=ip, user_agent=ua,
                                    details={"email": body.email, "failed_count": count})
                raise HTTPException(status_code=403, detail=f"ログイン失敗が{MAX_FAILED_LOGINS}回に達したため、アカウントを{LOCKOUT_MINUTES}分間ロックしました。")
            db.commit()
            _log_security_event(db, "login_failed", user_id=user.id, org_id=user.org_id,
                                ip_address=ip, user_agent=ua,
                                details={"email": body.email, "failed_count": count})
            raise HTTPException(status_code=401, detail=f"メールアドレスまたはパスワードが正しくありません（残り{MAX_FAILED_LOGINS - count}回）")
    else:
        _log_security_event(db, "login_failed", ip_address=ip, user_agent=ua,
                            details={"email": body.email, "reason": "user_not_found"})
        raise HTTPException(status_code=401, detail="メールアドレスまたはパスワードが正しくありません")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="アカウントが停止されています。管理者にお問い合わせください。")
    if not user.email_verified:
        raise HTTPException(
            status_code=403,
            detail="メールアドレスの確認が完了していません。登録時に送信した確認メールをご確認ください。",
            headers={"X-Verification-Required": "true"},
        )

    if user.totp_enabled and user.totp_secret:
        if not body.totp_code:
            return {"requires_totp": True, "email": body.email}
        import pyotp
        totp = pyotp.TOTP(user.totp_secret)
        if not totp.verify(body.totp_code, valid_window=1):
            _log_security_event(db, "totp_failed", user_id=user.id, org_id=user.org_id,
                                ip_address=ip, user_agent=ua, details={"email": body.email})
            raise HTTPException(status_code=401, detail="2段階認証コードが正しくありません")

    user.failed_login_count = 0
    user.locked_until = None
    user.last_login_at = datetime.utcnow()
    db.commit()

    _log_security_event(db, "login_success", user_id=user.id, org_id=user.org_id,
                        ip_address=ip, user_agent=ua,
                        details={"email": body.email})

    org = db.query(Organization).filter(Organization.id == user.org_id).first()
    token = create_access_token({"sub": str(user.id), "tv": user.token_version or 1})
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
        current_user.token_version = (current_user.token_version or 1) + 1
        _log_security_event(db, "password_changed", user_id=current_user.id, org_id=current_user.org_id,
                            details={"email": current_user.email})

    db.commit()
    db.refresh(current_user)
    org = db.query(Organization).filter(Organization.id == current_user.org_id).first()
    new_token = create_access_token({"sub": str(current_user.id), "tv": current_user.token_version or 1})
    return {"message": "プロフィールを更新しました", "user": _user_response(current_user, org), "access_token": new_token}


@router.post("/forgot-password")
@limiter.limit("3/minute")
def forgot_password(request: Request, body: ForgotPasswordRequest, db: Session = Depends(get_db)):
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

    from server.services.mailer import (
        get_smtp_settings, send_email,
        get_sendgrid_settings, send_via_sendgrid,
        get_system_smtp_settings, get_system_sendgrid_settings,
    )

    # 絶対URLを構築
    site_url = os.environ.get("SITE_URL", "https://leadhive.work").rstrip("/")
    reset_url = f"{site_url}/reset-password?token={token_str}"

    html_body = f"""
    <p>パスワードリセットのリクエストを受け付けました。</p>
    <p>以下のリンクから1時間以内にパスワードを再設定してください。</p>
    <p><a href="{reset_url}" style="background:#2563eb;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">パスワードをリセットする</a></p>
    <p style="color:#888;font-size:12px;">このメールに心当たりがない場合は無視してください。</p>
    """

    import logging as _logging
    _logger = _logging.getLogger("leadhive.password_reset")

    sent = False
    send_errors = []

    # 1. テナントのSMTP
    smtp_cfg = get_smtp_settings(db, user.org_id)
    if smtp_cfg.get("smtp_host"):
        _logger.info(f"[reset] trying tenant SMTP: host={smtp_cfg.get('smtp_host')} user_email={user.email}")
        ok, msg = send_email(user.email, "パスワードリセット - LeadHive", html_body, smtp_cfg)
        _logger.info(f"[reset] tenant SMTP result: ok={ok} msg={msg}")
        if ok:
            sent = True
        else:
            send_errors.append(f"tenant SMTP: {msg}")

    # 2. テナントのSendGrid
    if not sent:
        sg_cfg = get_sendgrid_settings(db, user.org_id)
        if sg_cfg.get("api_key"):
            _logger.info(f"[reset] trying tenant SendGrid")
            ok, msg = send_via_sendgrid(
                to=user.email, subject="パスワードリセット - LeadHive",
                html_body=html_body, api_key=sg_cfg["api_key"],
                from_email=sg_cfg["from_email"], from_name=sg_cfg["from_name"],
            )
            _logger.info(f"[reset] tenant SendGrid result: ok={ok} msg={msg}")
            if ok:
                sent = True
            else:
                send_errors.append(f"tenant SendGrid: {msg}")

    # 3. システムSMTP（フォールバック）
    if not sent:
        sys_smtp = get_system_smtp_settings(db)
        if sys_smtp.get("smtp_host"):
            _logger.info(f"[reset] trying system SMTP: host={sys_smtp.get('smtp_host')}")
            ok, msg = send_email(user.email, "パスワードリセット - LeadHive", html_body, sys_smtp)
            _logger.info(f"[reset] system SMTP result: ok={ok} msg={msg}")
            if ok:
                sent = True
            else:
                send_errors.append(f"system SMTP: {msg}")

    # 4. システムSendGrid（フォールバック）
    if not sent:
        sys_sg = get_system_sendgrid_settings(db)
        if sys_sg.get("api_key"):
            _logger.info(f"[reset] trying system SendGrid")
            ok, msg = send_via_sendgrid(
                to=user.email, subject="パスワードリセット - LeadHive",
                html_body=html_body, api_key=sys_sg["api_key"],
                from_email=sys_sg["from_email"], from_name=sys_sg["from_name"],
            )
            _logger.info(f"[reset] system SendGrid result: ok={ok} msg={msg}")
            if ok:
                sent = True
            else:
                send_errors.append(f"system SendGrid: {msg}")

    if not sent:
        _logger.error(f"[reset] ALL email methods failed for {user.email}: {send_errors}")
    else:
        _logger.info(f"[reset] email sent successfully to {user.email}")

    return {
        "message": "パスワードリセットメールを送信しました（アドレスが登録されている場合）",
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
    user.token_version = (user.token_version or 1) + 1
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
    token_str = create_access_token({"sub": str(user.id), "tv": user.token_version or 1})
    return {
        "access_token": token_str,
        "token_type": "bearer",
        "user": _user_response(user, org),
    }


def _send_welcome_email(email: str, name: str, db, org_id: int):
    from server.services.mailer import get_smtp_settings, send_email
    smtp_cfg = get_smtp_settings(db, org_id)
    if not smtp_cfg.get("smtp_host"):
        return
    html_body = f"""
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#2563eb">LeadHiveへようこそ！</h2>
      <p>{name} さん、ご登録ありがとうございます。</p>
      <p>LeadHiveは、BtoB営業に特化した見込み顧客リスト自動作成サービスです。</p>
      <h3 style="color:#374151">まず始めてみましょう</h3>
      <ol>
        <li><strong>プロジェクトを作成</strong> — ダッシュボードからプロジェクトを作成してください</li>
        <li><strong>キーワードを設定</strong> — 収集したい企業のキーワードを登録します</li>
        <li><strong>自動収集を開始</strong> — スケジューラーが定期的に企業情報を収集します</li>
      </ol>
      <p>ご不明な点はFAQページ、またはサポートチケットからお気軽にお問い合わせください。</p>
      <p style="margin-top:24px">
        <a href="https://leadhive.work/dashboard" style="background:#2563eb;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">
          ダッシュボードを開く
        </a>
      </p>
      <p style="color:#9ca3af;font-size:12px;margin-top:32px">LeadHive — COOLWORKS株式会社</p>
    </div>
    """
    send_email(email, "【LeadHive】ご登録ありがとうございます！", html_body, smtp_cfg)


@router.post("/logout-all")
def logout_all_devices(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_user.token_version = (current_user.token_version or 1) + 1
    db.commit()
    db.refresh(current_user)
    new_token = create_access_token({"sub": str(current_user.id), "tv": current_user.token_version})
    return {"message": "全デバイスからログアウトしました", "access_token": new_token}


@router.post("/2fa/setup")
def totp_setup(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    import pyotp
    import qrcode
    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(name=current_user.email, issuer_name="LeadHive")
    qr = qrcode.make(uri)
    buf = io.BytesIO()
    qr.save(buf, format="PNG")
    qr_b64 = base64.b64encode(buf.getvalue()).decode()
    return {"secret": secret, "uri": uri, "qr_image": f"data:image/png;base64,{qr_b64}"}


@router.post("/2fa/confirm")
def totp_confirm(
    body: TotpSetupConfirmRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    import pyotp
    totp = pyotp.TOTP(body.secret)
    if not totp.verify(body.totp_code, valid_window=1):
        raise HTTPException(status_code=400, detail="認証コードが正しくありません")
    current_user.totp_secret = body.secret
    current_user.totp_enabled = True
    current_user.token_version = (current_user.token_version or 1) + 1
    db.commit()
    db.refresh(current_user)
    new_token = create_access_token({"sub": str(current_user.id), "tv": current_user.token_version})
    org = db.query(Organization).filter(Organization.id == current_user.org_id).first()
    return {"message": "2段階認証を有効にしました", "access_token": new_token, "user": _user_response(current_user, org)}


@router.post("/2fa/disable")
def totp_disable(
    body: TotpDisableRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(body.password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="パスワードが正しくありません")
    current_user.totp_secret = None
    current_user.totp_enabled = False
    current_user.token_version = (current_user.token_version or 1) + 1
    db.commit()
    db.refresh(current_user)
    new_token = create_access_token({"sub": str(current_user.id), "tv": current_user.token_version})
    org = db.query(Organization).filter(Organization.id == current_user.org_id).first()
    return {"message": "2段階認証を無効にしました", "access_token": new_token, "user": _user_response(current_user, org)}


@router.delete("/account")
def delete_account(
    body: DeleteAccountRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(body.password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="パスワードが正しくありません")

    org = db.query(Organization).filter(Organization.id == current_user.org_id).first()

    if org and org.stripe_subscription_id:
        try:
            from server.routes.payments import get_stripe_client
            stripe = get_stripe_client(db)
            stripe.Subscription.delete(org.stripe_subscription_id)
        except Exception as e:
            logger.warning("Account deletion: failed to cancel Stripe subscription: %s", e)

    org_members = db.query(User).filter(User.org_id == current_user.org_id).count()
    if org_members <= 1 and org:
        from server.models import Company, Project
        org_project_ids = [p.id for p in db.query(Project).filter(Project.org_id == org.id).all()]
        if org_project_ids:
            db.query(Company).filter(Company.project_id.in_(org_project_ids)).delete(synchronize_session=False)
        db.query(Project).filter(Project.org_id == org.id).delete(synchronize_session=False)

    anon_email = f"deleted_{current_user.id}@deleted.invalid"
    current_user.email = anon_email
    current_user.password_hash = ""
    current_user.display_name = "削除済みユーザー"
    current_user.is_active = False
    current_user.totp_secret = None
    current_user.totp_enabled = False
    current_user.token_version = (current_user.token_version or 1) + 1
    db.commit()

    return {"message": "アカウントを削除しました"}


@router.get("/export-data")
def export_data(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from server.models import Company, Project
    org = db.query(Organization).filter(Organization.id == current_user.org_id).first()
    projects = db.query(Project).filter(Project.org_id == current_user.org_id).all()
    project_ids = [p.id for p in projects]
    companies = db.query(Company).filter(Company.project_id.in_(project_ids)).all() if project_ids else []

    data = {
        "exported_at": datetime.utcnow().isoformat(),
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "display_name": current_user.display_name,
            "role": current_user.role,
            "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
            "last_login_at": current_user.last_login_at.isoformat() if current_user.last_login_at else None,
            "terms_accepted_at": current_user.terms_accepted_at.isoformat() if current_user.terms_accepted_at else None,
        },
        "organization": {
            "id": org.id if org else None,
            "name": org.name if org else None,
            "phone": org.phone if org else None,
            "corporate_number": org.corporate_number if org else None,
            "created_at": org.created_at.isoformat() if org and org.created_at else None,
        },
        "projects": [{"id": p.id, "name": p.name, "description": p.description} for p in projects],
        "companies": [
            {
                "id": c.id, "company_name": c.company_name, "domain": c.domain,
                "website_url": c.website_url, "status": c.status,
                "contact_email": c.contact_email, "phone": c.phone,
                "prefecture": c.prefecture, "city": c.city,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c in companies
        ],
    }
    json_bytes = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
    return StreamingResponse(
        io.BytesIO(json_bytes),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=leadhive_export_{datetime.utcnow().strftime('%Y%m%d')}.json"},
    )


@router.post("/admin/users/{user_id}/force-logout")
def admin_force_logout(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.is_system_admin:
        raise HTTPException(status_code=403, detail="システム管理者権限が必要です")
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="ユーザーが見つかりません")
    target.token_version = (target.token_version or 1) + 1
    db.commit()
    return {"message": f"ユーザー {target.email} の全セッションを無効化しました"}


@router.post("/refresh")
def refresh_token(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    new_token = create_access_token({"sub": str(current_user.id), "tv": current_user.token_version or 1})
    return {"access_token": new_token, "token_type": "bearer"}
