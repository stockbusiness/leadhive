import logging
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from server.database import get_db
from server.auth import get_current_user, require_admin
from server.models import LpInquiry, Organization

router = APIRouter(tags=["lp_inquiries"])
logger = logging.getLogger(__name__)

VALID_TYPES = {"document_request", "partner_apply", "founder_apply", "contact", "email_inbound", "webhook_inbound"}
VALID_STATUSES = {"new", "contacted", "in_progress", "closed_won", "closed_lost"}


def _serialize(inq: LpInquiry) -> dict:
    return {
        "id": inq.id,
        "tenantId": inq.org_id,
        "type": inq.type,
        "companyName": inq.company_name,
        "contactName": inq.contact_name,
        "email": inq.email,
        "phone": inq.phone,
        "message": inq.message,
        "sourceLabel": inq.source_label,
        "status": inq.status,
        "repliedAt": inq.replied_at.isoformat() if inq.replied_at else None,
        "replyCount": inq.reply_count,
        "createdAt": inq.created_at.isoformat() if inq.created_at else None,
        "updatedAt": inq.updated_at.isoformat() if inq.updated_at else None,
    }


class InquiryCreateBody(BaseModel):
    company_name: Optional[str] = None
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    message: Optional[str] = None
    type: Optional[str] = "contact"
    source_label: Optional[str] = None
    org_id: Optional[int] = None


class StatusBody(BaseModel):
    status: str
    amount: Optional[int] = None


class ReplyBody(BaseModel):
    subject: str
    body: str


@router.post("/api/lp/inquiries")
def create_lp_inquiry_public(
    body: InquiryCreateBody,
    db: Session = Depends(get_db),
):
    inq_type = body.type if body.type in VALID_TYPES else "contact"
    if body.org_id:
        org_id = body.org_id
    else:
        first_org = db.query(Organization).order_by(Organization.id).first()
        org_id = first_org.id if first_org else None
    if org_id is None:
        raise HTTPException(status_code=503, detail="受付先テナントが未設定です")
    inq = LpInquiry(
        org_id=org_id,
        type=inq_type,
        company_name=body.company_name,
        contact_name=body.contact_name,
        email=body.email,
        phone=body.phone,
        message=body.message,
        source_label=body.source_label or "lp_form",
        status="new",
    )
    db.add(inq)
    db.commit()
    db.refresh(inq)
    logger.info("LP inquiry created: id=%s type=%s org=%s", inq.id, inq_type, org_id)

    if inq_type == "document_request":
        try:
            from server.services.commitrev import send_lp_lead_created
            send_lp_lead_created(
                db=db,
                inquiry_id=inq.id,
                email=inq.email,
                company_name=inq.company_name,
                org_id=org_id,
            )
        except Exception as _e:
            logger.warning("CommitRev lead_created failed: %s", _e)

    return {"id": inq.id, "message": "お問い合わせを受け付けました"}


@router.get("/api/lp/inquiries")
def list_lp_inquiries(
    type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(LpInquiry).filter(LpInquiry.org_id == current_user.org_id)
    if type:
        q = q.filter(LpInquiry.type == type)
    if status:
        q = q.filter(LpInquiry.status == status)
    items = q.order_by(LpInquiry.created_at.desc()).limit(200).all()
    return [_serialize(i) for i in items]


@router.patch("/api/lp/inquiries/{inquiry_id}/status")
def update_inquiry_status(
    inquiry_id: int,
    body: StatusBody,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    if body.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"無効なステータスです: {body.status}")
    inq = db.query(LpInquiry).filter(
        LpInquiry.id == inquiry_id,
        LpInquiry.org_id == current_user.org_id,
    ).first()
    if not inq:
        raise HTTPException(status_code=404, detail="問い合わせが見つかりません")

    prev_status = inq.status
    inq.status = body.status
    db.commit()
    logger.info("Inquiry %s status: %s -> %s", inq.id, prev_status, inq.status)

    if inq.status == "closed_won" and inq.type == "document_request" and prev_status != "closed_won":
        try:
            from server.services.commitrev import send_lp_contract_signed
            send_lp_contract_signed(
                db=db,
                inquiry_id=inq.id,
                email=inq.email,
                company_name=inq.company_name,
                org_id=inq.org_id,
                amount=body.amount,
            )
        except Exception as _e:
            logger.warning("CommitRev contract_signed failed: %s", _e)

    return _serialize(inq)


@router.post("/api/lp/inquiries/{inquiry_id}/reply")
def reply_to_inquiry(
    inquiry_id: int,
    body: ReplyBody,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    inq = db.query(LpInquiry).filter(
        LpInquiry.id == inquiry_id,
        LpInquiry.org_id == current_user.org_id,
    ).first()
    if not inq:
        raise HTTPException(status_code=404, detail="問い合わせが見つかりません")
    if not inq.email:
        raise HTTPException(status_code=400, detail="返信先メールアドレスがありません")

    from server.services.mailer import get_smtp_settings, send_email
    smtp_cfg = get_smtp_settings(db, current_user.org_id)
    if not smtp_cfg.get("smtp_host"):
        raise HTTPException(status_code=400, detail="SMTP設定が未完了です。設定 → メール送信設定を確認してください")

    html_body = body.body.replace("\n", "<br>")
    ok, msg = send_email(
        to=inq.email,
        subject=body.subject,
        html_body=f"<div style='font-family:sans-serif;line-height:1.7;'>{html_body}</div>",
        smtp_settings=smtp_cfg,
        text_body=body.body,
    )
    if not ok:
        raise HTTPException(status_code=500, detail=f"メール送信に失敗しました: {msg}")

    inq.replied_at = datetime.utcnow()
    inq.reply_count = (inq.reply_count or 0) + 1
    if inq.status == "new":
        inq.status = "contacted"
    db.commit()
    return {"message": "返信メールを送信しました", "inquiry": _serialize(inq)}
