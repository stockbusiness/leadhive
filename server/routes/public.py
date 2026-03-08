import requests
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from server.database import get_db
from server.models import User, SystemSettings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/public", tags=["public"])

GBIZ_BASE_URL = "https://info.gbiz.go.jp/hojin/v1/hojin"


@router.get("/stats")
def public_stats(db: Session = Depends(get_db)):
    registered_users = db.query(func.count(User.id)).scalar() or 0
    return {
        "registered_users": registered_users,
        "founder_slots_remaining": max(0, 50 - registered_users),
        "founder_slots_total": 50,
    }


@router.get("/corporate/{number}")
def lookup_corporate(number: str, db: Session = Depends(get_db)):
    if not number.isdigit() or len(number) != 13:
        raise HTTPException(status_code=400, detail="法人番号は13桁の数字で入力してください")

    token_row = db.query(SystemSettings).filter(SystemSettings.key == "gbizinfo_api_token").first()
    token = token_row.value if token_row and token_row.value else None

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
