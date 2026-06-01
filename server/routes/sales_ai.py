import logging
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, case
from sqlalchemy.orm import Session
from server.database import get_db
from server.models import SalesMessage, AuditLog, OptOutList, Company, CompanyMaster, User, AppSetting, Project
from server.auth import get_current_user

router = APIRouter(prefix="/api/sales-ai", tags=["sales-ai"])
logger = logging.getLogger(__name__)


def _msg_to_dict(m: SalesMessage, company_name: str = None) -> dict:
    return {
        "id": m.id,
        "org_id": m.org_id,
        "company_id": m.company_id,
        "company_name": company_name,
        "project_id": m.project_id,
        "template_type": m.template_type,
        "subject": m.subject,
        "body": m.body,
        "ai_prompt_id": m.ai_prompt_id,
        "status": m.status,
        "reviewed_by": m.reviewed_by,
        "reviewed_at": m.reviewed_at.isoformat() if m.reviewed_at else None,
        "sent_at": m.sent_at.isoformat() if m.sent_at else None,
        "sent_by": m.sent_by,
        "open_count": m.open_count or 0,
        "opened_at": m.opened_at.isoformat() if m.opened_at else None,
        "created_at": m.created_at.isoformat() if m.created_at else None,
        "updated_at": m.updated_at.isoformat() if m.updated_at else None,
    }


def _get_company_dict(company_id: int, db: Session) -> dict:
    c = db.query(Company).filter(Company.id == company_id).first()
    if c:
        return {
            "id": c.id,
            "company_name": c.company_name,
            "prefecture": c.prefecture,
            "city": c.city,
            "category_main": c.category_main,
            "cms_type": c.cms_type,
            "ec_score": c.ec_score,
            "ec_flag": c.ec_flag,
            "shopify_flag": c.shopify_flag,
            "sns_count": c.sns_count,
            "score_total": c.score_total,
            "score_rank": c.score_rank,
            "email": c.email,
        }
    return {}


def _is_opted_out(email: str, domain: str, db: Session) -> bool:
    if email:
        row = db.query(OptOutList).filter(OptOutList.email == email).first()
        if row:
            return True
    if domain:
        row = db.query(OptOutList).filter(OptOutList.domain == domain).first()
        if row:
            return True
    return False


class GenerateRequest(BaseModel):
    company_id: int
    template_type: str
    project_id: Optional[int] = None


class GenerateBatchRequest(BaseModel):
    company_ids: list[int]
    template_type: str
    project_id: Optional[int] = None


class UpdateMessageRequest(BaseModel):
    subject: Optional[str] = None
    body: Optional[str] = None


class SendMessageRequest(BaseModel):
    send_method: str = "email"
    note: Optional[str] = None
    profile_id: Optional[int] = None


class OptOutRequest(BaseModel):
    email: Optional[str] = None
    domain: Optional[str] = None
    company_id: Optional[int] = None
    reason: Optional[str] = None


@router.post("/generate")
def generate_single(
    req: GenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from server.services.ai_writer import generate_sales_message

    company_dict = _get_company_dict(req.company_id, db)
    if not company_dict:
        raise HTTPException(status_code=404, detail="企業が見つかりません")

    domain = ""
    c = db.query(Company).filter(Company.id == req.company_id).first()
    if c:
        domain = c.domain or ""

    if _is_opted_out(company_dict.get("email", ""), domain, db):
        raise HTTPException(status_code=400, detail="この企業/メールアドレスは配信停止リストに登録されています")

    try:
        result = generate_sales_message(company_dict, req.template_type)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"generate_single error: {e}")
        raise HTTPException(status_code=500, detail=f"AI生成エラー: {str(e)}")

    msg = SalesMessage(
        org_id=current_user.org_id,
        company_id=req.company_id,
        project_id=req.project_id,
        template_type=req.template_type,
        subject=result["subject"],
        body=result["body"],
        ai_prompt_id=result["ai_prompt_id"],
        status="draft",
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    return _msg_to_dict(msg, company_dict.get("company_name"))


@router.post("/generate-batch")
def generate_batch(
    req: GenerateBatchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from server.services.ai_writer import generate_sales_message

    if len(req.company_ids) > 50:
        raise HTTPException(status_code=400, detail="一括生成は最大50件です")

    results = []
    errors = []

    for company_id in req.company_ids:
        company_dict = _get_company_dict(company_id, db)
        if not company_dict:
            errors.append({"company_id": company_id, "error": "企業が見つかりません"})
            continue

        c = db.query(Company).filter(Company.id == company_id).first()
        domain = c.domain or "" if c else ""

        if _is_opted_out(company_dict.get("email", ""), domain, db):
            errors.append({"company_id": company_id, "error": "配信停止リストに登録済み"})
            continue

        try:
            result = generate_sales_message(company_dict, req.template_type)
        except RuntimeError as e:
            errors.append({"company_id": company_id, "error": str(e)})
            continue
        except Exception as e:
            logger.error(f"batch generate error for company {company_id}: {e}")
            errors.append({"company_id": company_id, "error": f"AI生成エラー: {str(e)}"})
            continue

        msg = SalesMessage(
            org_id=current_user.org_id,
            company_id=company_id,
            project_id=req.project_id,
            template_type=req.template_type,
            subject=result["subject"],
            body=result["body"],
            ai_prompt_id=result["ai_prompt_id"],
            status="draft",
        )
        db.add(msg)
        db.flush()
        results.append(_msg_to_dict(msg, company_dict.get("company_name")))

    db.commit()

    return {
        "generated": results,
        "errors": errors,
        "total_requested": len(req.company_ids),
        "total_generated": len(results),
    }


@router.get("/messages")
def list_messages(
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(SalesMessage).filter(SalesMessage.org_id == current_user.org_id)
    if status:
        q = q.filter(SalesMessage.status == status)
    messages = q.order_by(SalesMessage.created_at.desc()).all()

    company_names: dict[int, str] = {}
    for m in messages:
        if m.company_id not in company_names:
            c = db.query(Company).filter(Company.id == m.company_id).first()
            if c:
                company_names[m.company_id] = c.company_name or ""

    return {
        "messages": [_msg_to_dict(m, company_names.get(m.company_id)) for m in messages]
    }


@router.put("/messages/{message_id}")
def update_message(
    message_id: int,
    req: UpdateMessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    msg = db.query(SalesMessage).filter(
        SalesMessage.id == message_id,
        SalesMessage.org_id == current_user.org_id
    ).first()
    if not msg:
        raise HTTPException(status_code=404, detail="メッセージが見つかりません")
    if msg.status == "sent":
        raise HTTPException(status_code=400, detail="送信済みのメッセージは編集できません")

    if req.subject is not None:
        msg.subject = req.subject
    if req.body is not None:
        msg.body = req.body
    msg.status = "reviewed"
    msg.reviewed_by = current_user.id
    msg.reviewed_at = datetime.utcnow()
    db.commit()
    db.refresh(msg)

    c = db.query(Company).filter(Company.id == msg.company_id).first()
    return _msg_to_dict(msg, c.company_name if c else None)


@router.get("/messages/{message_id}/send-preview")
def get_send_preview(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    msg = db.query(SalesMessage).filter(
        SalesMessage.id == message_id,
        SalesMessage.org_id == current_user.org_id
    ).first()
    if not msg:
        raise HTTPException(status_code=404, detail="メッセージが見つかりません")

    c = db.query(Company).filter(Company.id == msg.company_id).first()
    email = (c.email or "") if c else ""
    contact_url = (c.contact_url or "") if c else ""
    domain = (c.domain or "") if c else ""

    opted_out = False
    if email or domain:
        opted_out = _is_opted_out(email, domain, db)

    from server.services.mailer import get_smtp_settings
    smtp = get_smtp_settings(db, current_user.org_id)
    smtp_ok = bool(smtp.get("smtp_host") and smtp.get("smtp_from_email"))

    return {
        "company_name": c.company_name if c else None,
        "email": email,
        "contact_url": contact_url,
        "opted_out": opted_out,
        "smtp_configured": smtp_ok,
        "can_send_email": bool(email and smtp_ok and not opted_out),
    }


@router.post("/messages/{message_id}/send")
def send_message(
    message_id: int,
    req: SendMessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    msg = db.query(SalesMessage).filter(
        SalesMessage.id == message_id,
        SalesMessage.org_id == current_user.org_id
    ).first()
    if not msg:
        raise HTTPException(status_code=404, detail="メッセージが見つかりません")
    if msg.status == "sent":
        raise HTTPException(status_code=400, detail="既に送信済みです")

    c = db.query(Company).filter(Company.id == msg.company_id).first()
    email = (c.email or "") if c else ""
    domain = (c.domain or "") if c else ""

    if email or domain:
        if _is_opted_out(email, domain, db):
            raise HTTPException(status_code=400, detail="この企業/メールアドレスは配信停止リストに登録されています")

    send_result = "sent"
    send_note = req.note or ""
    actually_sent = False

    if req.send_method == "email" and email:
        from server.routes.plans import check_smtp_allowed
        check_smtp_allowed(current_user.org_id, db)

        from server.services.mailer import get_smtp_settings, send_email
        smtp = get_smtp_settings(db, current_user.org_id)

        if not smtp.get("smtp_host"):
            raise HTTPException(
                status_code=400,
                detail="SMTPが設定されていません。設定画面でSMTPを設定するか、送信方法を「手動」に変更してください。"
            )

        from server.services.unsubscribe_token import build_unsubscribe_url
        unsub_url = build_unsubscribe_url(email)

        body_text = msg.body or ""
        if unsub_url:
            body_text_footer = f"\n\n---\n配信停止はこちら: {unsub_url}"
        else:
            body_text_footer = "\n\n---\n配信停止をご希望の場合は、このメールへの返信にてお知らせください。"

        paragraphs = []
        for line in body_text.split("\n"):
            if line.strip():
                paragraphs.append(f"<p style='margin: 0 0 0.8em 0;'>{line}</p>")
            else:
                paragraphs.append("<br>")
        body_html_content = "\n".join(paragraphs)

        if unsub_url:
            footer_html = (
                f'<a href="{unsub_url}" style="color: #999; text-decoration: underline;">'
                f'配信停止はこちらをクリック</a>'
            )
        else:
            footer_html = "配信停止をご希望の場合は、このメールへの返信にてお知らせください。"

        body_html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 14px; line-height: 1.8; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
{body_html_content}
<hr style="margin-top: 2.5em; border: none; border-top: 1px solid #eee;">
<p style="font-size: 11px; color: #aaa; margin-top: 1em;">
このメールは LeadHive を通じて送信されました。<br>
{footer_html}
</p>
</body></html>"""

        # ── トラッキングトークン生成 ─────────────────────────────────────
        import secrets as _secrets
        tracking_token = _secrets.token_urlsafe(32)
        msg.tracking_token = tracking_token
        tracking_pixel = (
            f'<img src="https://leadhive.work/api/track/{tracking_token}.gif" '
            f'width="1" height="1" style="display:none;" alt="" />'
        )
        body_html = body_html.replace("</body>", f"{tracking_pixel}\n</body>")

        extra_headers: dict = {}
        if unsub_url:
            extra_headers["List-Unsubscribe"] = f"<{unsub_url}>"
            extra_headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"

        success, detail = send_email(
            to=email,
            subject=msg.subject or "",
            html_body=body_html,
            text_body=body_text + body_text_footer,
            smtp_settings=smtp,
            extra_headers=extra_headers,
        )
        actually_sent = success
        send_result = "sent" if success else "failed"
        if not success:
            send_note = f"SMTP送信失敗: {detail}"
            logger.warning(f"SalesAI email send failed to {email}: {detail}")
        else:
            send_note = f"送信先: {email}" + (f" / {req.note}" if req.note else "")

    elif req.send_method == "form":
        from server.services.form_sender import send_form_auto
        from server.services.ai_analyzer import get_openai_key
        from server.models import Organization

        openai_key = get_openai_key(db, current_user.org_id)
        if not openai_key:
            raise HTTPException(
                status_code=400,
                detail="OpenAI APIキーが設定されていません。設定画面でAPIキーを設定してください。"
            )

        org = db.query(Organization).filter(Organization.id == current_user.org_id).first()

        smtp_s = {}
        try:
            from server.services.mailer import get_smtp_settings
            smtp_s = get_smtp_settings(db, current_user.org_id)
        except Exception:
            pass

        if req.profile_id:
            from server.models import FormSenderProfile
            prof = db.query(FormSenderProfile).filter(
                FormSenderProfile.id == req.profile_id,
                FormSenderProfile.org_id == current_user.org_id
            ).first()
        else:
            prof = None

        if prof:
            sender_name = prof.display_name or current_user.display_name or current_user.email or ""
            sender_email = prof.email or smtp_s.get("smtp_from_email") or current_user.email or ""
            sender_company = org.name if org else ""
            sender_phone = prof.phone or ""
            sender_title = prof.title or ""
            sender_department = prof.department or ""
            sender_website_url = prof.website_url or ""
            sender_prefecture = prof.prefecture or ""
            sender_address = prof.address or ""
        else:
            sender_name = current_user.display_name or current_user.email or ""
            sender_email = smtp_s.get("smtp_from_email") or current_user.email or ""
            sender_company = org.name if org else ""
            sender_phone = current_user.phone or (org.phone if org else "") or ""
            sender_title = current_user.title or ""
            sender_department = ""
            sender_website_url = ""
            sender_prefecture = ""
            sender_address = ""

        form_result = send_form_auto(
            company_name=c.company_name if c else "",
            website_url=c.website_url or "" if c else "",
            contact_url=c.contact_url or "" if c else "",
            message_body=msg.body or "",
            sender_name=sender_name,
            sender_email=sender_email,
            sender_company=sender_company,
            sender_phone=sender_phone or "",
            sender_title=sender_title,
            openai_key=openai_key,
            sender_department=sender_department,
            sender_website_url=sender_website_url,
            sender_prefecture=sender_prefecture,
            sender_address=sender_address,
        )

        actually_sent = form_result["success"]
        send_result = "sent" if actually_sent else "failed"
        form_url = form_result.get("form_url", "")
        send_note = form_result["message"]
        if form_url:
            send_note += f" / URL: {form_url}"
        if req.note:
            send_note += f" / {req.note}"

        if not actually_sent:
            logger.warning(f"Form auto-send failed for company {msg.company_id}: {form_result['message']}")

    else:
        actually_sent = True

    final_status = "sent" if (req.send_method not in ("email", "form") or actually_sent) else "failed"
    msg.status = final_status
    msg.sent_at = datetime.utcnow()
    msg.sent_by = current_user.id

    audit = AuditLog(
        company_id=msg.company_id,
        send_method=req.send_method,
        sent_by_user_id=current_user.id,
        message_id=msg.id,
        ai_prompt_id=msg.ai_prompt_id,
        result=send_result,
        note=send_note,
    )
    db.add(audit)
    db.commit()
    db.refresh(msg)

    result = _msg_to_dict(msg, c.company_name if c else None)
    result["send_result"] = send_result
    result["send_detail"] = send_note
    return result


@router.delete("/messages/{message_id}")
def delete_message(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    msg = db.query(SalesMessage).filter(
        SalesMessage.id == message_id,
        SalesMessage.org_id == current_user.org_id
    ).first()
    if not msg:
        raise HTTPException(status_code=404, detail="メッセージが見つかりません")
    if msg.status == "sent":
        raise HTTPException(status_code=400, detail="送信済みのメッセージは削除できません")
    db.delete(msg)
    db.commit()
    return {"ok": True}


@router.post("/opt-out")
def add_opt_out(
    req: OptOutRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not req.email and not req.domain and not req.company_id:
        raise HTTPException(status_code=400, detail="email、domain、company_idのいずれかを指定してください")

    entry = OptOutList(
        email=req.email,
        domain=req.domain,
        company_id=req.company_id,
        reason=req.reason,
        added_by=current_user.id,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return {"ok": True, "id": entry.id}


@router.get("/opt-out")
def list_opt_out(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entries = db.query(OptOutList).order_by(OptOutList.added_at.desc()).all()
    return {
        "opt_out_list": [
            {
                "id": e.id,
                "email": e.email,
                "domain": e.domain,
                "company_id": e.company_id,
                "reason": e.reason,
                "added_by": e.added_by,
                "added_at": e.added_at.isoformat() if e.added_at else None,
            }
            for e in entries
        ]
    }


@router.get("/stats")
def get_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    org_id = current_user.org_id

    status_counts = dict(
        db.query(SalesMessage.status, func.count(SalesMessage.id))
        .filter(SalesMessage.org_id == org_id)
        .group_by(SalesMessage.status)
        .all()
    )

    template_counts = dict(
        db.query(SalesMessage.template_type, func.count(SalesMessage.id))
        .filter(SalesMessage.org_id == org_id)
        .group_by(SalesMessage.template_type)
        .all()
    )

    sent_msg_ids = [
        row[0] for row in
        db.query(SalesMessage.id)
        .filter(SalesMessage.org_id == org_id)
        .all()
    ]

    method_counts: dict = {}
    result_counts: dict = {}
    if sent_msg_ids:
        method_rows = (
            db.query(AuditLog.send_method, func.count(AuditLog.id))
            .filter(AuditLog.message_id.in_(sent_msg_ids))
            .group_by(AuditLog.send_method)
            .all()
        )
        method_counts = dict(method_rows)

        result_rows = (
            db.query(AuditLog.result, func.count(AuditLog.id))
            .filter(AuditLog.message_id.in_(sent_msg_ids))
            .group_by(AuditLog.result)
            .all()
        )
        result_counts = dict(result_rows)

    today = datetime.utcnow().date()
    daily: list[dict] = []
    for i in range(13, -1, -1):
        day = today - timedelta(days=i)
        day_start = datetime.combine(day, datetime.min.time())
        day_end = day_start + timedelta(days=1)
        cnt = 0
        if sent_msg_ids:
            cnt = (
                db.query(func.count(AuditLog.id))
                .filter(
                    AuditLog.message_id.in_(sent_msg_ids),
                    AuditLog.sent_at >= day_start,
                    AuditLog.sent_at < day_end,
                )
                .scalar() or 0
            )
        daily.append({"date": day.strftime("%m/%d"), "count": cnt})

    opt_out_count = db.query(func.count(OptOutList.id)).scalar() or 0

    return {
        "status_counts": status_counts,
        "template_counts": template_counts,
        "method_counts": method_counts,
        "result_counts": result_counts,
        "daily_sends": daily,
        "opt_out_count": opt_out_count,
        "total_messages": sum(status_counts.values()),
        "total_sent": status_counts.get("sent", 0),
        "total_failed": status_counts.get("failed", 0),
        "total_draft": status_counts.get("draft", 0),
        "total_reviewed": status_counts.get("reviewed", 0),
    }


@router.get("/audit-logs")
def get_audit_logs(
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    org_id = current_user.org_id
    sent_msg_ids = [
        row[0] for row in
        db.query(SalesMessage.id).filter(SalesMessage.org_id == org_id).all()
    ]
    if not sent_msg_ids:
        return {"audit_logs": []}

    rows = (
        db.query(AuditLog, Company.company_name)
        .outerjoin(Company, Company.id == AuditLog.company_id)
        .filter(AuditLog.message_id.in_(sent_msg_ids))
        .order_by(AuditLog.sent_at.desc())
        .limit(limit)
        .all()
    )
    return {
        "audit_logs": [
            {
                "id": log.id,
                "company_name": company_name,
                "company_id": log.company_id,
                "send_method": log.send_method,
                "result": log.result,
                "note": log.note,
                "sent_at": log.sent_at.isoformat() if log.sent_at else None,
                "message_id": log.message_id,
            }
            for log, company_name in rows
        ]
    }


@router.get("/settings/api-key-status")
def check_api_key_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    import os
    from server.models import SystemSettings
    env_key = os.environ.get("ANTHROPIC_API_KEY", "")
    sys_row = db.query(SystemSettings).filter(SystemSettings.key == "anthropic_api_key").first()
    has_key = bool(env_key) or bool(sys_row and sys_row.value)
    return {"has_api_key": has_key}


# ─────────────────────────────────────────────
#  Auto-generate settings (semi-automatic scheduler)
# ─────────────────────────────────────────────
AUTO_GEN_KEYS = [
    "auto_generate_enabled",
    "auto_generate_hour",
    "auto_generate_statuses",
    "auto_generate_min_score",
    "auto_generate_max_per_run",
    "auto_generate_template_type",
    "auto_generate_project_id",
    "auto_generate_last_run_at",
    "auto_generate_last_run_count",
]

AUTO_GEN_DEFAULTS = {
    "auto_generate_enabled": "false",
    "auto_generate_hour": "8",
    "auto_generate_statuses": '["未確認","アプローチ前"]',
    "auto_generate_min_score": "0",
    "auto_generate_max_per_run": "10",
    "auto_generate_template_type": "shopify",
    "auto_generate_project_id": "",
    "auto_generate_last_run_at": "",
    "auto_generate_last_run_count": "0",
}


def _get_auto_gen_settings(org_id: int, db: Session) -> dict:
    rows = db.query(AppSetting).filter(
        AppSetting.setting_key.in_(AUTO_GEN_KEYS),
        AppSetting.org_id == org_id,
    ).all()
    result = {**AUTO_GEN_DEFAULTS}
    for row in rows:
        result[row.setting_key] = row.setting_value or AUTO_GEN_DEFAULTS.get(row.setting_key, "")
    return result


def _set_auto_gen_setting(org_id: int, key: str, value: str, db: Session):
    row = db.query(AppSetting).filter(
        AppSetting.setting_key == key,
        AppSetting.org_id == org_id,
    ).first()
    if row:
        row.setting_value = value
    else:
        db.add(AppSetting(org_id=org_id, setting_key=key, setting_value=value))


class AutoGenerateSettingsRequest(BaseModel):
    enabled: bool
    hour: int
    statuses: list
    min_score: int
    max_per_run: int
    template_type: str
    project_id: Optional[int] = None


@router.get("/auto-generate/settings")
def get_auto_generate_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role not in ("admin", "system_admin") and not current_user.is_system_admin:
        raise HTTPException(status_code=403, detail="権限がありません")
    import json
    raw = _get_auto_gen_settings(current_user.org_id, db)
    projects = db.query(Project).filter(Project.org_id == current_user.org_id, Project.is_active == True).all()
    try:
        statuses = json.loads(raw["auto_generate_statuses"])
    except Exception:
        statuses = ["未確認", "アプローチ前"]
    return {
        "enabled": raw["auto_generate_enabled"] == "true",
        "hour": int(raw["auto_generate_hour"]),
        "statuses": statuses,
        "min_score": int(raw["auto_generate_min_score"]),
        "max_per_run": int(raw["auto_generate_max_per_run"]),
        "template_type": raw["auto_generate_template_type"],
        "project_id": int(raw["auto_generate_project_id"]) if raw["auto_generate_project_id"] else None,
        "last_run_at": raw["auto_generate_last_run_at"] or None,
        "last_run_count": int(raw["auto_generate_last_run_count"]),
        "projects": [{"id": p.id, "name": p.name} for p in projects],
    }


@router.put("/auto-generate/settings")
def update_auto_generate_settings(
    req: AutoGenerateSettingsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role not in ("admin", "system_admin") and not current_user.is_system_admin:
        raise HTTPException(status_code=403, detail="権限がありません")
    import json
    if not 0 <= req.hour <= 23:
        raise HTTPException(status_code=400, detail="時刻は0〜23で指定してください")
    if not 1 <= req.max_per_run <= 50:
        raise HTTPException(status_code=400, detail="最大生成件数は1〜50で指定してください")
    _set_auto_gen_setting(current_user.org_id, "auto_generate_enabled", "true" if req.enabled else "false", db)
    _set_auto_gen_setting(current_user.org_id, "auto_generate_hour", str(req.hour), db)
    _set_auto_gen_setting(current_user.org_id, "auto_generate_statuses", json.dumps(req.statuses, ensure_ascii=False), db)
    _set_auto_gen_setting(current_user.org_id, "auto_generate_min_score", str(req.min_score), db)
    _set_auto_gen_setting(current_user.org_id, "auto_generate_max_per_run", str(req.max_per_run), db)
    _set_auto_gen_setting(current_user.org_id, "auto_generate_template_type", req.template_type, db)
    _set_auto_gen_setting(current_user.org_id, "auto_generate_project_id", str(req.project_id) if req.project_id else "", db)
    db.commit()
    return {"ok": True}


@router.post("/auto-generate/run-now")
def run_auto_generate_now(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role not in ("admin", "system_admin") and not current_user.is_system_admin:
        raise HTTPException(status_code=403, detail="権限がありません")
    import threading
    from server.services.scheduler import _run_auto_generate_for_org
    threading.Thread(
        target=_run_auto_generate_for_org,
        args=(current_user.org_id,),
        daemon=True,
    ).start()
    return {"ok": True, "message": "バックグラウンドで生成を開始しました"}
