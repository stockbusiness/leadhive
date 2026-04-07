import json
import time
import logging
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from server.database import get_db, SessionLocal
from server.models import EmailCampaign, EmailLog, Company, User, AppSetting
from server.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/email-campaigns", tags=["email-campaigns"])

MAX_SEND_PER_CAMPAIGN = 500
SEND_INTERVAL = 0.2


def _resolve_template(text: str, company: Company) -> str:
    replacements = {
        "{{会社名}}": company.company_name or "",
        "{{URL}}": company.website_url or "",
        "{{担当者名}}": company.contact_name or "",
        "{{都道府県}}": company.prefecture or "",
        "{{市区町村}}": company.city or "",
        "{{ステータス}}": company.status or "",
        "{{電話番号}}": company.phone or "",
    }
    for key, val in replacements.items():
        text = text.replace(key, val)
    return text


def _get_email_provider(db: Session, org_id: int):
    from server.services.mailer import (
        get_sendgrid_settings, get_smtp_settings,
        send_via_sendgrid, send_email,
        get_system_sendgrid_settings, get_system_smtp_settings,
    )
    sg = get_sendgrid_settings(db, org_id)
    if sg["api_key"]:
        return "sendgrid", sg
    smtp = get_smtp_settings(db, org_id)
    if smtp.get("smtp_host"):
        return "smtp", smtp
    sg_sys = get_system_sendgrid_settings(db)
    if sg_sys["api_key"]:
        return "sendgrid", sg_sys
    smtp_sys = get_system_smtp_settings(db)
    if smtp_sys.get("smtp_host"):
        return "smtp", smtp_sys
    return None, None


def _send_one(
    provider: str,
    cfg: dict,
    to: str,
    subject: str,
    html: str,
    text: str,
    custom_args: dict,
) -> tuple[bool, str]:
    from server.services.mailer import send_via_sendgrid, send_email
    if provider == "sendgrid":
        import httpx
        payload = {
            "personalizations": [{"to": [{"email": to}]}],
            "from": {"email": cfg["from_email"], "name": cfg.get("from_name", "LeadHive")},
            "subject": subject,
            "content": [{"type": "text/plain", "value": text or subject}, {"type": "text/html", "value": html}],
            "custom_args": {k: str(v) for k, v in custom_args.items()},
            "tracking_settings": {
                "click_tracking": {"enable": True, "enable_text": False},
                "open_tracking": {"enable": True},
            },
        }
        try:
            resp = httpx.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers={"Authorization": f"Bearer {cfg['api_key']}", "Content-Type": "application/json"},
                json=payload,
                timeout=15,
            )
            if resp.status_code in (200, 202):
                return True, ""
            return False, f"SendGrid {resp.status_code}: {resp.text[:200]}"
        except Exception as e:
            return False, str(e)
    else:
        ok, msg = send_email(to=to, subject=subject, html_body=html, smtp_settings=cfg, text_body=text)
        return ok, msg


class CampaignCreateRequest(BaseModel):
    name: Optional[str] = None
    project_id: Optional[int] = None
    company_ids: List[int]
    subject: str
    html_body: str
    text_body: Optional[str] = None
    auto_status_on_open: Optional[str] = None
    auto_status_on_click: Optional[str] = None


@router.post("/send")
async def send_campaign(
    req: CampaignCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not req.company_ids:
        raise HTTPException(status_code=400, detail="送信先企業を選択してください")
    if len(req.company_ids) > MAX_SEND_PER_CAMPAIGN:
        raise HTTPException(status_code=400, detail=f"1回の送信上限は{MAX_SEND_PER_CAMPAIGN}社です")
    if not req.subject.strip():
        raise HTTPException(status_code=400, detail="件名を入力してください")
    if not req.html_body.strip():
        raise HTTPException(status_code=400, detail="本文を入力してください")

    provider, cfg = _get_email_provider(db, current_user.org_id)
    if not provider:
        raise HTTPException(status_code=400, detail="メール送信設定（SendGrid APIキーまたはSMTP）がされていません。設定画面で設定してください。")

    companies = db.query(Company).filter(Company.id.in_(req.company_ids)).all()
    sendable = [c for c in companies if c.email]
    no_email = [c for c in companies if not c.email]

    if not sendable:
        raise HTTPException(status_code=400, detail="選択した企業にメールアドレスが登録されていません")

    campaign = EmailCampaign(
        org_id=current_user.org_id,
        project_id=req.project_id,
        created_by=current_user.id,
        name=req.name or f"キャンペーン {datetime.now().strftime('%Y/%m/%d %H:%M')}",
        subject=req.subject,
        html_body=req.html_body,
        text_body=req.text_body or "",
        status="running",
        total_count=len(sendable),
        sent_count=0,
        failed_count=0,
        auto_status_on_open=req.auto_status_on_open or None,
        auto_status_on_click=req.auto_status_on_click or None,
    )
    db.add(campaign)
    db.flush()
    campaign_id = campaign.id

    logs = []
    for c in sendable:
        log = EmailLog(
            campaign_id=campaign_id,
            company_id=c.id,
            to_email=c.email,
            status="pending",
        )
        db.add(log)
        logs.append(log)
    db.commit()

    log_ids = [log.id for log in logs]
    company_map = {c.id: c for c in sendable}

    async def _stream():
        db2 = SessionLocal()
        try:
            sent = 0
            failed = 0
            skipped = len(no_email)

            if skipped > 0:
                yield f"data: {json.dumps({'type': 'info', 'message': f'メールアドレス未登録: {skipped}社をスキップ'})}\n\n"

            for i, (log_id, company) in enumerate(zip(log_ids, sendable)):
                log_row = db2.query(EmailLog).filter(EmailLog.id == log_id).first()
                if not log_row:
                    continue

                subject_resolved = _resolve_template(req.subject, company)
                html_resolved = _resolve_template(req.html_body, company)
                text_resolved = _resolve_template(req.text_body or "", company)

                ok, err = _send_one(
                    provider=provider,
                    cfg=cfg,
                    to=company.email,
                    subject=subject_resolved,
                    html=html_resolved,
                    text=text_resolved,
                    custom_args={
                        "email_log_id": str(log_id),
                        "campaign_id": str(campaign_id),
                        "company_id": str(company.id),
                    },
                )

                now = datetime.utcnow()
                if ok:
                    log_row.status = "sent"
                    log_row.sent_at = now
                    sent += 1
                else:
                    log_row.status = "failed"
                    log_row.error_message = err
                    failed += 1

                camp = db2.query(EmailCampaign).filter(EmailCampaign.id == campaign_id).first()
                if camp:
                    camp.sent_count = sent
                    camp.failed_count = failed
                db2.commit()

                yield f"data: {json.dumps({'type': 'progress', 'current': i + 1, 'total': len(sendable), 'sent': sent, 'failed': failed, 'company': company.company_name or company.email})}\n\n"
                time.sleep(SEND_INTERVAL)

            camp = db2.query(EmailCampaign).filter(EmailCampaign.id == campaign_id).first()
            if camp:
                camp.status = "done"
                db2.commit()

            yield f"data: {json.dumps({'type': 'done', 'campaign_id': campaign_id, 'sent': sent, 'failed': failed, 'skipped': skipped})}\n\n"
        except Exception as e:
            logger.error(f"Campaign send error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
            try:
                camp = db2.query(EmailCampaign).filter(EmailCampaign.id == campaign_id).first()
                if camp:
                    camp.status = "error"
                    db2.commit()
            except Exception:
                pass
        finally:
            db2.close()

    return StreamingResponse(_stream(), media_type="text/event-stream")


@router.get("")
def list_campaigns(
    limit: int = 30,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(EmailCampaign).filter(EmailCampaign.org_id == current_user.org_id)
    total = q.count()
    campaigns = q.order_by(EmailCampaign.created_at.desc()).offset(offset).limit(limit).all()

    result = []
    for c in campaigns:
        logs = db.query(EmailLog).filter(EmailLog.campaign_id == c.id).all()
        opened = sum(1 for l in logs if l.opened_at)
        clicked = sum(1 for l in logs if l.clicked_at)
        bounced = sum(1 for l in logs if l.bounced_at)
        result.append({
            "id": c.id,
            "name": c.name,
            "subject": c.subject,
            "status": c.status,
            "total_count": c.total_count,
            "sent_count": c.sent_count,
            "failed_count": c.failed_count,
            "opened_count": opened,
            "clicked_count": clicked,
            "bounced_count": bounced,
            "open_rate": round(opened / c.sent_count * 100, 1) if c.sent_count else 0,
            "click_rate": round(clicked / c.sent_count * 100, 1) if c.sent_count else 0,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "auto_status_on_open": c.auto_status_on_open,
            "auto_status_on_click": c.auto_status_on_click,
        })
    return {"campaigns": result, "total": total}


@router.get("/{campaign_id}")
def get_campaign(
    campaign_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    c = db.query(EmailCampaign).filter(
        EmailCampaign.id == campaign_id,
        EmailCampaign.org_id == current_user.org_id,
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="キャンペーンが見つかりません")

    logs = db.query(EmailLog).filter(EmailLog.campaign_id == campaign_id).all()
    company_ids = [l.company_id for l in logs if l.company_id]
    companies = {co.id: co for co in db.query(Company).filter(Company.id.in_(company_ids)).all()} if company_ids else {}

    log_list = []
    for l in logs:
        co = companies.get(l.company_id)
        log_list.append({
            "id": l.id,
            "company_id": l.company_id,
            "company_name": co.company_name if co else None,
            "to_email": l.to_email,
            "status": l.status,
            "sent_at": l.sent_at.isoformat() if l.sent_at else None,
            "opened_at": l.opened_at.isoformat() if l.opened_at else None,
            "clicked_at": l.clicked_at.isoformat() if l.clicked_at else None,
            "bounced_at": l.bounced_at.isoformat() if l.bounced_at else None,
            "open_count": l.open_count,
            "click_count": l.click_count,
            "error_message": l.error_message,
        })

    opened = sum(1 for l in logs if l.opened_at)
    clicked = sum(1 for l in logs if l.clicked_at)
    bounced = sum(1 for l in logs if l.bounced_at)

    return {
        "id": c.id,
        "name": c.name,
        "subject": c.subject,
        "html_body": c.html_body,
        "text_body": c.text_body,
        "status": c.status,
        "total_count": c.total_count,
        "sent_count": c.sent_count,
        "failed_count": c.failed_count,
        "opened_count": opened,
        "clicked_count": clicked,
        "bounced_count": bounced,
        "open_rate": round(opened / c.sent_count * 100, 1) if c.sent_count else 0,
        "click_rate": round(clicked / c.sent_count * 100, 1) if c.sent_count else 0,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "auto_status_on_open": c.auto_status_on_open,
        "auto_status_on_click": c.auto_status_on_click,
        "logs": log_list,
    }


@router.post("/sendgrid-webhook", include_in_schema=False)
async def sendgrid_webhook(request: Request, db: Session = Depends(get_db)):
    try:
        body = await request.json()
    except Exception:
        return {"ok": True}

    if not isinstance(body, list):
        body = [body]

    for event in body:
        event_type = event.get("event", "")
        email_log_id = event.get("email_log_id") or event.get("custom_args", {}).get("email_log_id")
        campaign_id = event.get("campaign_id") or event.get("custom_args", {}).get("campaign_id")
        company_id = event.get("company_id") or event.get("custom_args", {}).get("company_id")

        if not email_log_id:
            continue

        try:
            log = db.query(EmailLog).filter(EmailLog.id == int(email_log_id)).first()
            if not log:
                continue

            now = datetime.utcnow()
            status_updated = False

            if event_type == "open":
                log.open_count = (log.open_count or 0) + 1
                if not log.opened_at:
                    log.opened_at = now
                    status_updated = True

            elif event_type == "click":
                log.click_count = (log.click_count or 0) + 1
                if not log.clicked_at:
                    log.clicked_at = now
                    status_updated = True

            elif event_type in ("bounce", "blocked", "dropped"):
                if not log.bounced_at:
                    log.bounced_at = now
                log.status = "bounced"

            elif event_type == "spamreport":
                log.status = "spam"

            db.flush()

            if status_updated and company_id and campaign_id:
                try:
                    camp = db.query(EmailCampaign).filter(EmailCampaign.id == int(campaign_id)).first()
                    if camp:
                        co = db.query(Company).filter(Company.id == int(company_id)).first()
                        if co:
                            target_status = None
                            if event_type == "open" and camp.auto_status_on_open:
                                target_status = camp.auto_status_on_open
                            elif event_type == "click" and camp.auto_status_on_click:
                                target_status = camp.auto_status_on_click

                            if target_status and co.status != target_status:
                                old_status = co.status
                                co.status = target_status
                                from server.models import StatusHistory
                                db.add(StatusHistory(
                                    company_id=co.id,
                                    old_status=old_status,
                                    new_status=target_status,
                                    note=f"メール{event_type} 自動更新（キャンペーン#{campaign_id}）",
                                ))
                except Exception as e:
                    logger.warning(f"Pipeline status update failed: {e}")

            db.commit()
        except Exception as e:
            logger.warning(f"Webhook event processing error: {e}")
            try:
                db.rollback()
            except Exception:
                pass

    return {"ok": True}
