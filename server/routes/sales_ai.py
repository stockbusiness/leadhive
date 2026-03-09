import logging
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from server.database import get_db
from server.models import SalesMessage, AuditLog, OptOutList, Company, CompanyMaster, User
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
        from server.services.mailer import get_smtp_settings, send_email
        smtp = get_smtp_settings(db, current_user.org_id)

        if not smtp.get("smtp_host"):
            raise HTTPException(
                status_code=400,
                detail="SMTPが設定されていません。設定画面でSMTPを設定するか、送信方法を「手動」に変更してください。"
            )

        body_text = msg.body or ""
        body_html = "<br>".join(
            f"<p>{line}</p>" if line.strip() else "<br>"
            for line in body_text.split("\n")
        )
        body_html = f"""
<html><body style="font-family: sans-serif; font-size: 14px; line-height: 1.7; color: #333;">
{body_html}
<hr style="margin-top: 2em; border: none; border-top: 1px solid #eee;">
<p style="font-size: 11px; color: #888;">
このメールは LeadHive を通じて送信されました。<br>
配信停止をご希望の場合は、このメールへの返信にてお知らせください。
</p>
</body></html>"""

        success, detail = send_email(
            to=email,
            subject=msg.subject or "",
            html_body=body_html,
            text_body=body_text,
            smtp_settings=smtp,
        )
        actually_sent = success
        send_result = "sent" if success else "failed"
        if not success:
            send_note = f"SMTP送信失敗: {detail}"
            logger.warning(f"SalesAI email send failed to {email}: {detail}")
        else:
            send_note = f"送信先: {email}" + (f" / {req.note}" if req.note else "")
    else:
        actually_sent = True

    final_status = "sent" if (req.send_method != "email" or actually_sent) else "failed"
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
