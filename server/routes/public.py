import requests
import logging
import time
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import HTMLResponse, JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from server.database import get_db
from server.models import User, SystemSettings, OptOutList

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/public", tags=["public"])

GBIZ_BASE_URL = "https://info.gbiz.go.jp/hojin/v1/hojin"

_stats_cache: dict = {"data": None, "at": 0.0}
_STATS_TTL = 60.0  # 60秒キャッシュ


@router.get("/stats")
def public_stats(db: Session = Depends(get_db)):
    now = time.time()
    if _stats_cache["data"] and now - _stats_cache["at"] < _STATS_TTL:
        return JSONResponse(content=_stats_cache["data"], headers={"Cache-Control": "public, max-age=60"})
    registered_users = db.query(func.count(User.id)).scalar() or 0
    founder_count = db.query(func.count(User.id)).filter(User.is_founder == True).scalar() or 0
    data = {
        "registered_users": registered_users,
        "founder_slots_remaining": max(0, 50 - founder_count),
        "founder_slots_total": 50,
    }
    _stats_cache["data"] = data
    _stats_cache["at"] = now
    return JSONResponse(content=data, headers={"Cache-Control": "public, max-age=60"})


@router.get("/corporate/{number}")
def lookup_corporate(number: str, db: Session = Depends(get_db)):
    if not number.isdigit() or len(number) != 13:
        raise HTTPException(status_code=400, detail="法人番号は13桁の数字で入力してください")

    from server.services.encryption import decrypt_value
    token_row = db.query(SystemSettings).filter(SystemSettings.key == "gbizinfo_api_token").first()
    token = decrypt_value(token_row.value) if token_row and token_row.value else None

    if not token:
        return {"error": "lookup_unavailable", "message": "法人番号は保存されますが自動取得は現在利用できません"}

    try:
        headers = {
            "X-hojinInfo-api-token": token,
            "Accept": "application/json",
        }
        resp = requests.get(f"{GBIZ_BASE_URL}/{number}", headers=headers, timeout=10)
        if resp.status_code == 404:
            return {"error": "not_found", "message": "該当する法人情報が見つかりませんでした"}
        resp.raise_for_status()
        data = resp.json()
        info = data.get("hojin-infos", [])
        if not info:
            return {"error": "not_found", "message": "該当する法人情報が見つかりませんでした"}
        item = info[0]
        return {
            "corporate_number": number,
            "name": item.get("name", ""),
            "address": item.get("location", ""),
            "business_summary": item.get("business_summary", "") or "",
        }
    except requests.RequestException as e:
        logger.warning(f"gBizINFO lookup failed for {number}: {e}")
        raise HTTPException(status_code=502, detail="法人情報の取得に失敗しました")


@router.post("/webhook/{source_key}")
async def receive_inbound_webhook(
    source_key: str,
    request: Request,
    db: Session = Depends(get_db),
):
    from server.models import InboundWebhookSource, LpInquiry
    row = db.query(InboundWebhookSource).filter(
        InboundWebhookSource.source_key == source_key,
        InboundWebhookSource.enabled == True,
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Webhookソースが見つかりません")

    try:
        payload = await request.json()
    except Exception:
        payload = {}

    def _extract(key: str | None) -> str | None:
        if not key or not payload:
            return None
        return str(payload.get(key, "") or "") or None

    company_name = _extract(row.company_field)
    contact_name = _extract(row.name_field)
    email = _extract(row.email_field)
    phone = _extract(row.phone_field)
    message_body = _extract(row.message_field)

    if not message_body and payload:
        skip = {row.name_field, row.email_field, row.company_field, row.phone_field, row.message_field}
        extras = "\n".join(f"{k}: {v}" for k, v in payload.items() if k not in skip)
        message_body = extras or None

    inq = LpInquiry(
        org_id=row.org_id,
        type="webhook_inbound",
        company_name=company_name,
        contact_name=contact_name,
        email=email,
        phone=phone,
        message=message_body,
        source_label=row.name,
        status="new",
    )
    db.add(inq)
    row.total_received = (row.total_received or 0) + 1
    row.last_received_at = datetime.utcnow()
    db.commit()
    logger.info("Inbound webhook received: source=%s org=%s", row.name, row.org_id)
    return {"ok": True, "inquiry_id": inq.id}


@router.get("/partner")
def public_partner_info(db: Session = Depends(get_db)):
    from server.services.encryption import decrypt_value
    row = db.query(SystemSettings).filter(SystemSettings.key == "commitrev_partner_apply_url").first()
    apply_url = decrypt_value(row.value) if row and row.value else ""
    return {
        "apply_url": apply_url,
        "enabled": bool(apply_url),
    }


@router.get("/unsubscribe")
def handle_unsubscribe(
    email: str = Query(...),
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    from server.services.unsubscribe_token import verify_token
    if not verify_token(email, token):
        raise HTTPException(status_code=400, detail="無効なリンクです。配信停止処理できませんでした。")

    existing = db.query(OptOutList).filter(
        (OptOutList.email == email.lower().strip()) |
        (OptOutList.domain == email.lower().strip().split("@")[-1])
    ).first()

    if not existing:
        entry = OptOutList(
            email=email.lower().strip(),
            reason="メール内配信停止リンクよりお手続き",
            added_at=datetime.utcnow(),
        )
        db.add(entry)
        db.commit()
        logger.info(f"Unsubscribe processed for email: {email}")

    return {
        "success": True,
        "email": email,
        "already_unsubscribed": existing is not None,
        "message": "配信停止が完了しました。今後このアドレスへのメール送信は停止されます。",
    }
