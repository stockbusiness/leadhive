import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from server.database import get_db
from server.auth import require_admin

router = APIRouter(tags=["contact"])
logger = logging.getLogger(__name__)

INQUIRY_TYPES = {
    "document": "資料請求",
    "question": "サービスへのご質問",
    "other": "その他",
}

CONTACT_SETTING_KEYS = [
    "contact_notify_to",
    "contact_notify_subject_prefix",
    "contact_autoreply_enabled",
    "contact_autoreply_subject",
    "contact_autoreply_intro",
    "contact_response_days",
]

DEFAULTS = {
    "contact_notify_to": "info@leadhive.work",
    "contact_notify_subject_prefix": "【LeadHive】",
    "contact_autoreply_enabled": "true",
    "contact_autoreply_subject": "【LeadHive】お問い合わせを受け付けました",
    "contact_autoreply_intro": (
        "この度はLeadHiveにお問い合わせいただきありがとうございます。\n"
        "以下の内容でお問い合わせを受け付けました。\n"
        "担当者より{response_days}以内にご連絡いたします。"
    ),
    "contact_response_days": "2〜3営業日",
}


def _get_setting(db, key: str) -> str:
    from server.models import SystemSettings
    from server.services.encryption import decrypt_value
    row = db.query(SystemSettings).filter(SystemSettings.key == key).first()
    if row and row.value:
        return decrypt_value(row.value)
    return DEFAULTS.get(key, "")


def _set_setting(db, key: str, value: str):
    from server.models import SystemSettings
    row = db.query(SystemSettings).filter(SystemSettings.key == key).first()
    if row:
        row.value = value
    else:
        db.add(SystemSettings(key=key, value=value))


def _get_all_contact_settings(db) -> dict:
    return {k: _get_setting(db, k) for k in CONTACT_SETTING_KEYS}


def _notify_html(body, settings: dict) -> str:
    type_label = INQUIRY_TYPES.get(body.inquiry_type, body.inquiry_type)
    return f"""
<!DOCTYPE html>
<html lang="ja">
<body style="font-family: sans-serif; background: #f8fafc; padding: 24px;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden;">
    <div style="background: #2563eb; padding: 20px 24px;">
      <h2 style="color: #fff; margin: 0; font-size: 18px;">{settings['contact_notify_subject_prefix']}新しいお問い合わせが届きました</h2>
    </div>
    <div style="padding: 24px;">
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px 0; color: #64748b; width: 140px; font-weight: 600;">お問い合わせ種別</td>
          <td style="padding: 10px 0; color: #1e293b;">{type_label}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px 0; color: #64748b; font-weight: 600;">会社名</td>
          <td style="padding: 10px 0; color: #1e293b;">{body.company_name}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px 0; color: #64748b; font-weight: 600;">氏名</td>
          <td style="padding: 10px 0; color: #1e293b;">{body.name}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px 0; color: #64748b; font-weight: 600;">メールアドレス</td>
          <td style="padding: 10px 0; color: #1e293b;"><a href="mailto:{body.email}" style="color: #2563eb;">{body.email}</a></td>
        </tr>
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px 0; color: #64748b; font-weight: 600;">電話番号</td>
          <td style="padding: 10px 0; color: #1e293b;">{body.phone or "—"}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; color: #64748b; font-weight: 600; vertical-align: top;">お問い合わせ内容</td>
          <td style="padding: 10px 0; color: #1e293b; white-space: pre-line;">{body.message}</td>
        </tr>
      </table>
    </div>
  </div>
</body>
</html>
"""


def _autoreply_html(body, settings: dict) -> str:
    response_days = settings.get("contact_response_days") or "2〜3営業日"
    intro_raw = settings.get("contact_autoreply_intro") or DEFAULTS["contact_autoreply_intro"]
    intro = intro_raw.replace("{response_days}", response_days)
    intro_html = intro.replace("\n", "<br>")

    return f"""
<!DOCTYPE html>
<html lang="ja">
<body style="font-family: sans-serif; background: #f8fafc; padding: 24px;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden;">
    <div style="background: #2563eb; padding: 20px 24px;">
      <h2 style="color: #fff; margin: 0; font-size: 18px;">お問い合わせを受け付けました</h2>
    </div>
    <div style="padding: 24px;">
      <p style="font-size: 15px; color: #1e293b; margin-top: 0;">{body.name} 様</p>
      <p style="font-size: 14px; color: #475569; line-height: 1.7;">{intro_html}</p>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 14px;">
        <p style="margin: 0 0 8px; color: #64748b;"><strong>種別：</strong>{INQUIRY_TYPES.get(body.inquiry_type, body.inquiry_type)}</p>
        <p style="margin: 0 0 8px; color: #64748b;"><strong>会社名：</strong>{body.company_name}</p>
        <p style="margin: 0 0 8px; color: #64748b;"><strong>氏名：</strong>{body.name}</p>
        <p style="margin: 0; color: #64748b;"><strong>メール：</strong>{body.email}</p>
      </div>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
      <p style="font-size: 12px; color: #94a3b8; margin: 0;">
        COOLWORKS株式会社 / LeadHive<br>
        〒651-0084 兵庫県神戸市中央区磯辺通１丁目１番１８号 カサベラ国際プラザビル７０７号室<br>
        <a href="mailto:info@leadhive.work" style="color: #2563eb;">info@leadhive.work</a>
      </p>
    </div>
  </div>
</body>
</html>
"""


class ContactBody(BaseModel):
    inquiry_type: str
    company_name: str
    name: str
    email: str
    phone: Optional[str] = ""
    message: str


@router.post("/api/contact")
async def submit_contact(body: ContactBody, db: Session = Depends(get_db)):
    if body.inquiry_type not in INQUIRY_TYPES:
        raise HTTPException(status_code=400, detail="無効なお問い合わせ種別です")
    if not body.company_name.strip():
        raise HTTPException(status_code=400, detail="会社名を入力してください")
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="氏名を入力してください")
    if not body.email.strip() or "@" not in body.email:
        raise HTTPException(status_code=400, detail="有効なメールアドレスを入力してください")
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="お問い合わせ内容を入力してください")

    settings = _get_all_contact_settings(db)
    type_label = INQUIRY_TYPES[body.inquiry_type]

    try:
        from server.services.mailer import get_system_smtp_settings, send_email
        smtp = get_system_smtp_settings(db)

        if smtp.get("smtp_host"):
            notify_to = settings.get("contact_notify_to") or "info@leadhive.work"
            prefix = settings.get("contact_notify_subject_prefix") or "【LeadHive】"
            notify_subject = f"{prefix}{type_label}：{body.company_name} {body.name}様"
            send_email(
                notify_to, notify_subject, _notify_html(body, settings), smtp,
                text_body=f"{type_label}\n{body.company_name} {body.name}\n{body.email}\n\n{body.message}",
            )

            autoreply_enabled = settings.get("contact_autoreply_enabled", "true").lower() not in ("false", "0", "no")
            if autoreply_enabled:
                reply_subject = settings.get("contact_autoreply_subject") or "【LeadHive】お問い合わせを受け付けました"
                response_days = settings.get("contact_response_days") or "2〜3営業日"
                send_email(
                    body.email, reply_subject, _autoreply_html(body, settings), smtp,
                    text_body=(
                        f"{body.name} 様\n\nお問い合わせありがとうございます。"
                        f"担当者より{response_days}以内にご連絡いたします。\n\nLeadHive / COOLWORKS株式会社"
                    ),
                )
        else:
            logger.warning("Contact form: SMTP not configured, skipping email for %s", body.email)
    except Exception as e:
        logger.error("Contact form email error: %s", e)

    return {"message": "お問い合わせを受け付けました"}


class ContactSettingsBody(BaseModel):
    contact_notify_to: Optional[str] = None
    contact_notify_subject_prefix: Optional[str] = None
    contact_autoreply_enabled: Optional[str] = None
    contact_autoreply_subject: Optional[str] = None
    contact_autoreply_intro: Optional[str] = None
    contact_response_days: Optional[str] = None


@router.get("/api/admin/contact-settings")
def get_contact_settings(
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    return _get_all_contact_settings(db)


@router.put("/api/admin/contact-settings")
def save_contact_settings(
    body: ContactSettingsBody,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    for key in CONTACT_SETTING_KEYS:
        val = getattr(body, key, None)
        if val is not None:
            _set_setting(db, key, val)
    db.commit()
    return {"message": "保存しました"}
