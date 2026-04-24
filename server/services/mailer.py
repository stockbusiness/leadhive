import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
import logging

logger = logging.getLogger(__name__)


def get_smtp_settings(db, org_id: int) -> dict:
    from server.models import AppSetting
    from server.services.encryption import decrypt_value
    keys = ["smtp_host", "smtp_port", "smtp_user", "smtp_password", "smtp_from_email", "smtp_from_name", "smtp_use_tls"]
    settings = db.query(AppSetting).filter(
        AppSetting.setting_key.in_(keys),
        AppSetting.org_id == org_id,
    ).all()
    result = {s.setting_key: decrypt_value(s.setting_value or "") for s in settings}
    return result


def get_system_smtp_settings(db) -> dict:
    from server.models import SystemSettings
    from server.services.encryption import decrypt_value
    keys = ["smtp_host", "smtp_port", "smtp_user", "smtp_password", "smtp_from_email", "smtp_from_name"]
    rows = db.query(SystemSettings).filter(SystemSettings.key.in_(keys)).all()
    raw = {r.key: decrypt_value(r.value or "") for r in rows}
    return {
        "smtp_host": raw.get("smtp_host", ""),
        "smtp_port": raw.get("smtp_port", "587"),
        "smtp_user": raw.get("smtp_user", ""),
        "smtp_password": raw.get("smtp_password", ""),
        "smtp_from_email": raw.get("smtp_from_email", ""),
        "smtp_from_name": raw.get("smtp_from_name", "LeadHive"),
        "smtp_use_tls": "true",
    }


def send_email(
    to: str,
    subject: str,
    html_body: str,
    smtp_settings: dict,
    text_body: Optional[str] = None,
    extra_headers: Optional[dict] = None,
) -> tuple[bool, str]:
    host = smtp_settings.get("smtp_host", "")
    port = int(smtp_settings.get("smtp_port", "587") or "587")
    user = smtp_settings.get("smtp_user", "")
    password = smtp_settings.get("smtp_password", "")
    from_email = smtp_settings.get("smtp_from_email", "") or user
    from_name = smtp_settings.get("smtp_from_name", "LeadHive")
    use_tls = smtp_settings.get("smtp_use_tls", "true")
    use_tls = str(use_tls).lower() not in ("false", "0", "no")

    if not host:
        return False, "SMTPホストが設定されていません"
    if not from_email:
        return False, "送信元メールアドレスが設定されていません"

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{from_name} <{from_email}>"
    msg["To"] = to

    if extra_headers:
        for key, value in extra_headers.items():
            msg[key] = value

    if text_body:
        msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        if use_tls:
            context = ssl.create_default_context()
            with smtplib.SMTP(host, port, timeout=10) as server:
                server.ehlo()
                server.starttls(context=context)
                if user and password:
                    server.login(user, password)
                server.sendmail(from_email, [to], msg.as_string())
        else:
            with smtplib.SMTP_SSL(host, port, timeout=10) as server:
                if user and password:
                    server.login(user, password)
                server.sendmail(from_email, [to], msg.as_string())
        return True, "送信成功"
    except smtplib.SMTPAuthenticationError:
        return False, "SMTP認証エラー: ユーザー名またはパスワードを確認してください"
    except smtplib.SMTPConnectError:
        return False, f"SMTPサーバーへの接続に失敗しました: {host}:{port}"
    except Exception as e:
        return False, f"送信エラー: {str(e)}"


def get_sendgrid_settings(db, org_id: int) -> dict:
    from server.models import AppSetting
    from server.services.encryption import decrypt_value
    keys = ["sendgrid_api_key", "sendgrid_from_email", "sendgrid_from_name"]
    rows = db.query(AppSetting).filter(
        AppSetting.setting_key.in_(keys),
        AppSetting.org_id == org_id,
    ).all()
    result = {r.setting_key: decrypt_value(r.setting_value or "") for r in rows}
    return {
        "api_key": result.get("sendgrid_api_key", ""),
        "from_email": result.get("sendgrid_from_email", ""),
        "from_name": result.get("sendgrid_from_name", "LeadHive"),
    }


def get_system_sendgrid_settings(db) -> dict:
    import os
    from server.models import SystemSettings
    from server.services.encryption import decrypt_value
    keys = ["sendgrid_api_key", "sendgrid_from_email", "sendgrid_from_name"]
    rows = db.query(SystemSettings).filter(SystemSettings.key.in_(keys)).all()
    raw = {r.key: decrypt_value(r.value or "") for r in rows}
    # DB設定がなければ環境変数をフォールバックとして使用
    api_key = raw.get("sendgrid_api_key") or os.environ.get("SENDGRID_API_KEY", "")
    from_email = raw.get("sendgrid_from_email") or os.environ.get("SENDGRID_FROM_EMAIL", "noreply@leadhive.work")
    from_name = raw.get("sendgrid_from_name") or os.environ.get("SENDGRID_FROM_NAME", "LeadHive")
    return {
        "api_key": api_key,
        "from_email": from_email,
        "from_name": from_name,
    }


def send_via_sendgrid(
    to: str,
    subject: str,
    html_body: str,
    api_key: str,
    from_email: str,
    from_name: str = "LeadHive",
    text_body: Optional[str] = None,
) -> tuple[bool, str]:
    if not api_key:
        return False, "SendGrid APIキーが設定されていません"
    if not from_email:
        return False, "送信元メールアドレスが設定されていません"

    import httpx

    payload = {
        "personalizations": [{"to": [{"email": to}]}],
        "from": {"email": from_email, "name": from_name},
        "subject": subject,
        "content": [],
    }
    if text_body:
        payload["content"].append({"type": "text/plain", "value": text_body})
    payload["content"].append({"type": "text/html", "value": html_body})

    try:
        resp = httpx.post(
            "https://api.sendgrid.com/v3/mail/send",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=15,
        )
        if resp.status_code in (200, 202):
            return True, "SendGrid で送信しました"
        body = resp.text[:300]
        return False, f"SendGrid エラー ({resp.status_code}): {body}"
    except httpx.TimeoutException:
        return False, "SendGrid への接続がタイムアウトしました"
    except Exception as e:
        return False, f"SendGrid 送信エラー: {str(e)}"


def send_with_fallback(
    db,
    to: str,
    subject: str,
    html_body: str,
    text_body: Optional[str] = None,
    org_id: int = None,
) -> tuple[bool, str]:
    """
    メール送信の優先フォールバックチェーン:
      1. テナントSMTP (org_id指定時)
      2. テナントSendGrid (org_id指定時)
      3. システムSMTP (SystemSettings or 環境変数)
      4. システムSendGrid (SystemSettings or 環境変数)
    """
    errors = []

    if org_id:
        smtp_cfg = get_smtp_settings(db, org_id)
        if smtp_cfg.get("smtp_host"):
            ok, msg = send_email(to, subject, html_body, smtp_cfg, text_body)
            logger.info(f"[mail] tenant SMTP ok={ok} msg={msg}")
            if ok:
                return True, msg
            errors.append(f"tenant SMTP: {msg}")

        sg_cfg = get_sendgrid_settings(db, org_id)
        if sg_cfg.get("api_key"):
            ok, msg = send_via_sendgrid(
                to=to, subject=subject, html_body=html_body,
                api_key=sg_cfg["api_key"],
                from_email=sg_cfg["from_email"], from_name=sg_cfg["from_name"],
                text_body=text_body,
            )
            logger.info(f"[mail] tenant SendGrid ok={ok} msg={msg}")
            if ok:
                return True, msg
            errors.append(f"tenant SendGrid: {msg}")

    sys_smtp = get_system_smtp_settings(db)
    if sys_smtp.get("smtp_host"):
        ok, msg = send_email(to, subject, html_body, sys_smtp, text_body)
        logger.info(f"[mail] system SMTP ok={ok} msg={msg}")
        if ok:
            return True, msg
        errors.append(f"system SMTP: {msg}")

    sys_sg = get_system_sendgrid_settings(db)
    if sys_sg.get("api_key"):
        ok, msg = send_via_sendgrid(
            to=to, subject=subject, html_body=html_body,
            api_key=sys_sg["api_key"],
            from_email=sys_sg["from_email"], from_name=sys_sg["from_name"],
            text_body=text_body,
        )
        logger.info(f"[mail] system SendGrid ok={ok} msg={msg}")
        if ok:
            return True, msg
        errors.append(f"system SendGrid: {msg}")

    logger.error(f"[mail] ALL methods failed to={to}: {errors}")
    return False, "; ".join(errors) if errors else "メール設定がありません"
