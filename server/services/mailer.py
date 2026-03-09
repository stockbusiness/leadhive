import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional


def get_smtp_settings(db, org_id: int) -> dict:
    from server.models import AppSetting
    keys = ["smtp_host", "smtp_port", "smtp_user", "smtp_password", "smtp_from_email", "smtp_from_name", "smtp_use_tls"]
    settings = db.query(AppSetting).filter(
        AppSetting.setting_key.in_(keys),
        AppSetting.org_id == org_id,
    ).all()
    result = {s.setting_key: s.setting_value for s in settings}
    return result


def get_system_smtp_settings(db) -> dict:
    from server.models import SystemSettings
    keys = ["smtp_host", "smtp_port", "smtp_user", "smtp_password", "smtp_from_email", "smtp_from_name"]
    rows = db.query(SystemSettings).filter(SystemSettings.key.in_(keys)).all()
    raw = {r.key: r.value for r in rows}
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
