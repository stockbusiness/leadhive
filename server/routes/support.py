import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.orm import Session
from server.database import get_db
from server.auth import get_current_user, require_admin
from server.models import SupportTicket, SupportTicketMessage, User

router = APIRouter(tags=["support"])
logger = logging.getLogger(__name__)

CATEGORIES = {
    "technical": "技術的な問題",
    "billing": "請求・プランについて",
    "general": "一般的なご質問",
    "other": "その他",
}

PRIORITIES = {
    "low": "低",
    "normal": "通常",
    "urgent": "緊急",
}

STATUSES = {
    "open": "受付中",
    "in_progress": "対応中",
    "resolved": "解決済み",
    "closed": "クローズ",
}


def _generate_ticket_number(db: Session) -> str:
    last = db.query(SupportTicket).order_by(SupportTicket.id.desc()).first()
    next_id = (last.id + 1) if last else 1
    return f"TK-{next_id:05d}"


def _ticket_to_dict(ticket: SupportTicket, user: Optional[User] = None) -> dict:
    return {
        "id": ticket.id,
        "ticket_number": ticket.ticket_number,
        "subject": ticket.subject,
        "category": ticket.category,
        "category_label": CATEGORIES.get(ticket.category, ticket.category),
        "priority": ticket.priority,
        "priority_label": PRIORITIES.get(ticket.priority, ticket.priority),
        "status": ticket.status,
        "status_label": STATUSES.get(ticket.status, ticket.status),
        "org_id": ticket.org_id,
        "user_id": ticket.user_id,
        "user_email": user.email if user else None,
        "user_name": user.display_name if user else None,
        "created_at": ticket.created_at.isoformat() if ticket.created_at else None,
        "updated_at": ticket.updated_at.isoformat() if ticket.updated_at else None,
        "resolved_at": ticket.resolved_at.isoformat() if ticket.resolved_at else None,
    }


def _message_to_dict(msg: SupportTicketMessage, user: Optional[User] = None) -> dict:
    return {
        "id": msg.id,
        "ticket_id": msg.ticket_id,
        "user_id": msg.user_id,
        "is_staff": msg.is_staff,
        "body": msg.body,
        "sender_name": (
            "サポートチーム" if msg.is_staff
            else (user.display_name or user.email if user else "ユーザー")
        ),
        "sender_email": user.email if user else None,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
    }


class CreateTicketBody(BaseModel):
    subject: str
    category: str = "general"
    priority: str = "normal"
    message: str


class AddMessageBody(BaseModel):
    body: str


class UpdateStatusBody(BaseModel):
    status: str


@router.get("/api/support/tickets")
def list_my_tickets(
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(SupportTicket).filter(SupportTicket.org_id == current_user.org_id)
    if status:
        query = query.filter(SupportTicket.status == status)
    tickets = query.order_by(SupportTicket.created_at.desc()).all()
    result = []
    for t in tickets:
        user = db.query(User).filter(User.id == t.user_id).first()
        msg_count = db.query(SupportTicketMessage).filter(SupportTicketMessage.ticket_id == t.id).count()
        d = _ticket_to_dict(t, user)
        d["message_count"] = msg_count
        result.append(d)
    return result


@router.post("/api/support/tickets")
def create_ticket(
    body: CreateTicketBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not body.subject.strip():
        raise HTTPException(status_code=400, detail="件名を入力してください")
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="内容を入力してください")
    if body.category not in CATEGORIES:
        raise HTTPException(status_code=400, detail="無効なカテゴリです")
    if body.priority not in PRIORITIES:
        raise HTTPException(status_code=400, detail="無効な優先度です")

    ticket_number = _generate_ticket_number(db)
    ticket = SupportTicket(
        ticket_number=ticket_number,
        org_id=current_user.org_id,
        user_id=current_user.id,
        subject=body.subject.strip(),
        category=body.category,
        priority=body.priority,
        status="open",
    )
    db.add(ticket)
    db.flush()

    msg = SupportTicketMessage(
        ticket_id=ticket.id,
        user_id=current_user.id,
        is_staff=False,
        body=body.message.strip(),
    )
    db.add(msg)
    db.commit()
    db.refresh(ticket)

    try:
        _send_ticket_notification(ticket, body.message.strip(), current_user, db)
    except Exception as e:
        logger.error("Ticket notification error: %s", e)

    return _ticket_to_dict(ticket, current_user)


@router.get("/api/support/tickets/{ticket_id}")
def get_ticket(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = db.query(SupportTicket).filter(
        SupportTicket.id == ticket_id,
        SupportTicket.org_id == current_user.org_id,
    ).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="チケットが見つかりません")

    creator = db.query(User).filter(User.id == ticket.user_id).first()
    messages = db.query(SupportTicketMessage).filter(
        SupportTicketMessage.ticket_id == ticket_id
    ).order_by(SupportTicketMessage.created_at.asc()).all()

    msg_list = []
    for m in messages:
        u = db.query(User).filter(User.id == m.user_id).first() if m.user_id else None
        msg_list.append(_message_to_dict(m, u))

    d = _ticket_to_dict(ticket, creator)
    d["messages"] = msg_list
    return d


@router.post("/api/support/tickets/{ticket_id}/messages")
def add_message(
    ticket_id: int,
    body: AddMessageBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = db.query(SupportTicket).filter(
        SupportTicket.id == ticket_id,
        SupportTicket.org_id == current_user.org_id,
    ).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="チケットが見つかりません")
    if ticket.status in ("closed",):
        raise HTTPException(status_code=400, detail="クローズされたチケットには返信できません")
    if not body.body.strip():
        raise HTTPException(status_code=400, detail="メッセージを入力してください")

    msg = SupportTicketMessage(
        ticket_id=ticket_id,
        user_id=current_user.id,
        is_staff=False,
        body=body.body.strip(),
    )
    db.add(msg)
    if ticket.status == "resolved":
        ticket.status = "open"
    ticket.updated_at = datetime.now()
    db.commit()
    db.refresh(msg)
    return _message_to_dict(msg, current_user)


@router.put("/api/support/tickets/{ticket_id}/close")
def close_ticket(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = db.query(SupportTicket).filter(
        SupportTicket.id == ticket_id,
        SupportTicket.org_id == current_user.org_id,
    ).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="チケットが見つかりません")
    ticket.status = "closed"
    ticket.resolved_at = datetime.now()
    ticket.updated_at = datetime.now()
    db.commit()
    return {"message": "チケットをクローズしました"}


@router.get("/api/admin/support/tickets")
def admin_list_tickets(
    status: Optional[str] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = db.query(SupportTicket)
    if status:
        query = query.filter(SupportTicket.status == status)
    tickets = query.order_by(SupportTicket.updated_at.desc()).all()
    result = []
    for t in tickets:
        user = db.query(User).filter(User.id == t.user_id).first()
        msg_count = db.query(SupportTicketMessage).filter(SupportTicketMessage.ticket_id == t.id).count()
        d = _ticket_to_dict(t, user)
        d["message_count"] = msg_count
        result.append(d)
    return result


@router.get("/api/admin/support/tickets/{ticket_id}")
def admin_get_ticket(
    ticket_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="チケットが見つかりません")

    creator = db.query(User).filter(User.id == ticket.user_id).first()
    messages = db.query(SupportTicketMessage).filter(
        SupportTicketMessage.ticket_id == ticket_id
    ).order_by(SupportTicketMessage.created_at.asc()).all()

    msg_list = []
    for m in messages:
        u = db.query(User).filter(User.id == m.user_id).first() if m.user_id else None
        msg_list.append(_message_to_dict(m, u))

    d = _ticket_to_dict(ticket, creator)
    d["messages"] = msg_list
    return d


@router.post("/api/admin/support/tickets/{ticket_id}/messages")
def admin_add_message(
    ticket_id: int,
    body: AddMessageBody,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="チケットが見つかりません")
    if not body.body.strip():
        raise HTTPException(status_code=400, detail="メッセージを入力してください")

    msg = SupportTicketMessage(
        ticket_id=ticket_id,
        user_id=current_user.id,
        is_staff=True,
        body=body.body.strip(),
    )
    db.add(msg)
    if ticket.status == "open":
        ticket.status = "in_progress"
    ticket.updated_at = datetime.now()
    db.commit()
    db.refresh(msg)

    try:
        _send_staff_reply_notification(ticket, body.body.strip(), current_user, db)
    except Exception as e:
        logger.error("Staff reply notification error: %s", e)

    return _message_to_dict(msg, current_user)


@router.put("/api/admin/support/tickets/{ticket_id}/status")
def admin_update_status(
    ticket_id: int,
    body: UpdateStatusBody,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if body.status not in STATUSES:
        raise HTTPException(status_code=400, detail="無効なステータスです")
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="チケットが見つかりません")
    ticket.status = body.status
    if body.status in ("resolved", "closed"):
        ticket.resolved_at = datetime.now()
    ticket.updated_at = datetime.now()
    db.commit()
    return {"message": "ステータスを更新しました"}


def _send_ticket_notification(ticket: SupportTicket, message: str, user: User, db: Session):
    from server.services.mailer import get_system_smtp_settings, send_email
    from server.models import SystemSettings
    from server.services.encryption import decrypt_value

    smtp = get_system_smtp_settings(db)
    if not smtp.get("smtp_host"):
        return

    row = db.query(SystemSettings).filter(SystemSettings.key == "contact_notify_to").first()
    notify_to = decrypt_value(row.value) if row and row.value else "info@leadhive.work"

    html = f"""
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="background:#2563eb;padding:16px 20px;">
        <h2 style="color:#fff;margin:0;font-size:16px;">【LeadHive】新しいサポートチケット: {ticket.ticket_number}</h2>
      </div>
      <div style="padding:20px;font-size:14px;color:#334155;">
        <p><strong>件名：</strong>{ticket.subject}</p>
        <p><strong>送信者：</strong>{user.email}</p>
        <p><strong>カテゴリ：</strong>{CATEGORIES.get(ticket.category, ticket.category)}</p>
        <p><strong>優先度：</strong>{PRIORITIES.get(ticket.priority, ticket.priority)}</p>
        <p><strong>内容：</strong></p>
        <p style="white-space:pre-line;background:#f8fafc;padding:12px;border-radius:8px;">{message}</p>
      </div>
    </div>
    """
    send_email(notify_to, f"【LeadHive】新規チケット {ticket.ticket_number}: {ticket.subject}", html, smtp)


def _send_staff_reply_notification(ticket: SupportTicket, message: str, staff: User, db: Session):
    from server.services.mailer import get_system_smtp_settings, send_email
    from server.models import SystemSettings
    from server.services.encryption import decrypt_value

    smtp = get_system_smtp_settings(db)
    if not smtp.get("smtp_host"):
        return

    creator = db.query(User).filter(User.id == ticket.user_id).first()
    if not creator:
        return

    html = f"""
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="background:#2563eb;padding:16px 20px;">
        <h2 style="color:#fff;margin:0;font-size:16px;">サポートより返信が届きました</h2>
      </div>
      <div style="padding:20px;font-size:14px;color:#334155;">
        <p>チケット番号 <strong>{ticket.ticket_number}</strong>「{ticket.subject}」に返信がありました。</p>
        <p style="white-space:pre-line;background:#f8fafc;padding:12px;border-radius:8px;">{message}</p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;">
        <p style="font-size:12px;color:#94a3b8;">COOLWORKS株式会社 / LeadHive サポートチーム<br>info@leadhive.work</p>
      </div>
    </div>
    """
    send_email(creator.email, f"【LeadHive】チケット {ticket.ticket_number} に返信があります", html, smtp)
