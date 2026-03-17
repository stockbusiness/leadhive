import logging
import imaplib
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from server.database import get_db
from server.auth import require_admin
from server.models import ImapSetting
from server.services.encryption import encrypt_value, decrypt_value

router = APIRouter(tags=["admin_imap"])
logger = logging.getLogger(__name__)


def _get_or_create(db: Session, org_id: int) -> ImapSetting:
    row = db.query(ImapSetting).filter(ImapSetting.org_id == org_id).first()
    if not row:
        row = ImapSetting(org_id=org_id)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def _serialize(row: ImapSetting) -> dict:
    return {
        "enabled": row.enabled,
        "host": row.host or "",
        "port": row.port,
        "secure": row.secure,
        "username": row.username or "",
        "password": "••••••••" if row.password_enc else "",
        "folder": row.folder,
        "pollIntervalMinutes": row.poll_interval_minutes,
        "lastPolledAt": row.last_polled_at.isoformat() if row.last_polled_at else None,
    }


class ImapBody(BaseModel):
    enabled: Optional[bool] = None
    host: Optional[str] = None
    port: Optional[int] = None
    secure: Optional[bool] = None
    username: Optional[str] = None
    password: Optional[str] = None
    folder: Optional[str] = None
    pollIntervalMinutes: Optional[int] = None


@router.get("/api/admin/imap-settings")
def get_imap_settings(
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    row = _get_or_create(db, current_user.org_id)
    return _serialize(row)


@router.put("/api/admin/imap-settings")
def save_imap_settings(
    body: ImapBody,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    row = _get_or_create(db, current_user.org_id)
    if body.enabled is not None:
        row.enabled = body.enabled
    if body.host is not None:
        row.host = body.host.strip()
    if body.port is not None:
        row.port = body.port
    if body.secure is not None:
        row.secure = body.secure
    if body.username is not None:
        row.username = body.username.strip()
    if body.password is not None and body.password not in ("", "••••••••"):
        row.password_enc = encrypt_value(body.password)
    if body.folder is not None:
        row.folder = body.folder.strip() or "INBOX"
    if body.pollIntervalMinutes is not None:
        row.poll_interval_minutes = max(1, min(60, body.pollIntervalMinutes))
    db.commit()
    return _serialize(row)


@router.post("/api/admin/imap-settings/test")
def test_imap_connection(
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    row = _get_or_create(db, current_user.org_id)
    if not row.host:
        raise HTTPException(status_code=400, detail="IMAPホストが設定されていません")
    if not row.username:
        raise HTTPException(status_code=400, detail="ユーザー名が設定されていません")
    if not row.password_enc:
        raise HTTPException(status_code=400, detail="パスワードが設定されていません")

    password = decrypt_value(row.password_enc)
    try:
        if row.secure:
            conn = imaplib.IMAP4_SSL(row.host, row.port)
        else:
            conn = imaplib.IMAP4(row.host, row.port)
        conn.login(row.username, password)
        status, data = conn.select(row.folder)
        msg_count = int(data[0]) if status == "OK" else 0
        conn.logout()
        return {
            "success": True,
            "message": f"接続成功。フォルダ「{row.folder}」のメール数: {msg_count}",
        }
    except imaplib.IMAP4.error as e:
        raise HTTPException(status_code=400, detail=f"IMAP接続エラー: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"接続テストに失敗しました: {e}")
