import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr
from typing import Optional
from sqlalchemy.orm import Session
from server.database import get_db

router = APIRouter(tags=["contact"])
logger = logging.getLogger(__name__)

NOTIFICATION_TO = "info@leadhive.work"

INQUIRY_TYPES = {
    "document": "資料請求",
    "question": "サービスへのご質問",
    "other": "その他",
}


class ContactBody(BaseModel):
    inquiry_type: str
    company_name: str
    name: str
    email: str
    phone: Optional[str] = ""
    message: str


def _notify_html(body: ContactBody) -> str:
    type_label = INQUIRY_TYPES.get(body.inquiry_type, body.inquiry_type)
    return f"""
<!DOCTYPE html>
<html lang="ja">
<body style="font-family: sans-serif; background: #f8fafc; padding: 24px;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden;">
    <div style="background: #2563eb; padding: 20px 24px;">
      <h2 style="color: #fff; margin: 0; font-size: 18px;">【LeadHive】新しいお問い合わせが届きました</h2>
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


def _autoreply_html(body: ContactBody) -> str:
    type_label = INQUIRY_TYPES.get(body.inquiry_type, body.inquiry_type)
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
      <p style="font-size: 14px; color: #475569; line-height: 1.7;">
        この度はLeadHiveにお問い合わせいただきありがとうございます。<br>
        以下の内容でお問い合わせを受け付けました。<br>
        担当者より2〜3営業日以内にご連絡いたします。
      </p>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 14px;">
        <p style="margin: 0 0 8px; color: #64748b;"><strong>種別：</strong>{type_label}</p>
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

    type_label = INQUIRY_TYPES[body.inquiry_type]

    try:
        from server.services.mailer import get_system_smtp_settings, send_email
        smtp = get_system_smtp_settings(db)

        if smtp.get("smtp_host"):
            notify_subject = f"【LeadHive】{type_label}：{body.company_name} {body.name}様"
            send_email(NOTIFICATION_TO, notify_subject, _notify_html(body), smtp,
                       text_body=f"{type_label}\n{body.company_name} {body.name}\n{body.email}\n\n{body.message}")

            reply_subject = "【LeadHive】お問い合わせを受け付けました"
            send_email(body.email, reply_subject, _autoreply_html(body), smtp,
                       text_body=f"{body.name} 様\n\nお問い合わせありがとうございます。担当者より2〜3営業日以内にご連絡いたします。\n\nLeadHive / COOLWORKS株式会社")
        else:
            logger.warning("Contact form submission: SMTP not configured, skipping email for %s", body.email)
    except Exception as e:
        logger.error("Contact form email error: %s", e)

    return {"message": "お問い合わせを受け付けました"}
