import json
import uuid
import os
import threading
import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from server.database import get_db, SessionLocal
from server.routes.auth import get_current_user
from server.models import User, SystemSettings, CompanyMaster
from server.services.collector import job_update

router = APIRouter(prefix="/api/admin/auto-master", tags=["admin-auto-master"])
logger = logging.getLogger(__name__)

_DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "municipalities.json")
try:
    with open(_DATA_PATH, "r", encoding="utf-8") as _f:
        MUNICIPALITIES = json.load(_f)
except Exception:
    MUNICIPALITIES = []
TOTAL_CITIES = len(MUNICIPALITIES)

AUTO_MASTER_KEYWORDS = [
    "株式会社", "合同会社", "有限会社", "医療法人", "社会福祉法人",
    "一般社団法人", "公益社団法人", "農業法人", "学校法人",
    "特定非営利活動法人", "財団法人", "特例有限会社",
]
ESTIMATED_MAX = TOTAL_CITIES * len(AUTO_MASTER_KEYWORDS) * 100

SETTINGS_KEYS = [
    "auto_master_enabled",
    "auto_master_city_idx",
    "auto_master_keyword_idx",
    "auto_master_page_idx",
    "auto_master_max_companies",
    "auto_master_max_enrich",
    "auto_master_schedule_hour",
    "auto_master_last_run",
    "auto_master_last_count",
    "auto_master_total_collected",
    "gbizinfo_api_token",
    "auto_master_enrich_enabled",
    "auto_master_enrich_max",
    "auto_master_enrich_last_run",
    "auto_master_enrich_total",
    "scheduler_timezone",
]

DEFAULTS = {
    "auto_master_enabled": "false",
    "auto_master_city_idx": "0",
    "auto_master_keyword_idx": "0",
    "auto_master_page_idx": "1",
    "auto_master_max_companies": "1000",
    "auto_master_max_enrich": "10",
    "auto_master_schedule_hour": "3",
    "auto_master_last_run": "",
    "auto_master_last_count": "0",
    "auto_master_total_collected": "0",
    "gbizinfo_api_token": "",
    "auto_master_enrich_enabled": "true",
    "auto_master_enrich_max": "100",
    "auto_master_enrich_last_run": "",
    "auto_master_enrich_total": "0",
    "scheduler_timezone": "Asia/Tokyo",
}


def _require_system_admin(current_user: User):
    if not current_user.is_system_admin:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="システム管理者のみ操作できます")


def _get_all(db: Session) -> dict:
    rows = db.query(SystemSettings).filter(SystemSettings.key.in_(SETTINGS_KEYS)).all()
    settings = dict(DEFAULTS)
    for row in rows:
        settings[row.key] = row.value or ""
    return settings


def _set_key(db: Session, key: str, value: str):
    from server.services.encryption import encrypt_value, should_encrypt
    store_value = encrypt_value(value) if should_encrypt(key) and value else value
    row = db.query(SystemSettings).filter(SystemSettings.key == key).first()
    if row:
        row.value = store_value
    else:
        db.add(SystemSettings(key=key, value=store_value))
    db.commit()


@router.get("/status")
def get_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_system_admin(current_user)
    settings = _get_all(db)

    city_idx = int(settings.get("auto_master_city_idx", "0")) % max(TOTAL_CITIES, 1)
    keyword_idx = int(settings.get("auto_master_keyword_idx", "0")) % len(AUTO_MASTER_KEYWORDS)
    page_idx = max(1, int(settings.get("auto_master_page_idx", "1")))

    current_city = MUNICIPALITIES[city_idx] if MUNICIPALITIES else {"pref_name": "-", "city_name": "-"}
    master_count = db.query(CompanyMaster).count()

    has_token = bool(
        os.environ.get("GbizAPIkey")
        or os.environ.get("GBIZINFO_API_TOKEN")
        or os.environ.get("GBIZ_API_TOKEN")
        or settings.get("gbizinfo_api_token")
    )

    no_url_count = db.query(CompanyMaster).filter(
        (CompanyMaster.website_url == None) | (CompanyMaster.website_url == "")
    ).count()

    return {
        "enabled": settings.get("auto_master_enabled") == "true",
        "city_idx": city_idx,
        "total_cities": TOTAL_CITIES,
        "current_city": current_city["city_name"],
        "current_prefecture": current_city["pref_name"],
        "keyword_idx": keyword_idx,
        "current_keyword": AUTO_MASTER_KEYWORDS[keyword_idx],
        "keywords": AUTO_MASTER_KEYWORDS,
        "page_idx": page_idx,
        "max_companies": int(settings.get("auto_master_max_companies", "1000")),
        "max_enrich": int(settings.get("auto_master_max_enrich", "10")),
        "schedule_hour": int(settings.get("auto_master_schedule_hour", "3")),
        "last_run": settings.get("auto_master_last_run", ""),
        "last_count": int(settings.get("auto_master_last_count", "0")),
        "total_collected": int(settings.get("auto_master_total_collected", "0")),
        "master_db_count": master_count,
        "has_gbiz_token": has_token,
        "enrich_enabled": settings.get("auto_master_enrich_enabled", "true") != "false",
        "enrich_max": int(settings.get("auto_master_enrich_max", "100")),
        "enrich_last_run": settings.get("auto_master_enrich_last_run", ""),
        "enrich_total": int(settings.get("auto_master_enrich_total", "0")),
        "no_url_count": no_url_count,
        "scheduler_timezone": settings.get("scheduler_timezone", "Asia/Tokyo"),
        "estimated_max": ESTIMATED_MAX,
        "total_combinations": TOTAL_CITIES * len(AUTO_MASTER_KEYWORDS),
    }


@router.post("/settings")
def update_settings(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_system_admin(current_user)
    allowed = {
        "auto_master_enabled", "auto_master_max_companies", "auto_master_max_enrich",
        "auto_master_schedule_hour", "auto_master_enrich_enabled", "auto_master_enrich_max",
        "scheduler_timezone", "gbizinfo_api_token",
    }
    for key, val in data.items():
        if key in allowed:
            _set_key(db, key, str(val))
    return {"ok": True}


@router.get("/server-time")
def get_server_time(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_system_admin(current_user)
    from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
    from datetime import datetime as _dt
    settings = _get_all(db)
    tz_name = settings.get("scheduler_timezone", "Asia/Tokyo")
    try:
        tz = ZoneInfo(tz_name)
        now_tz = _dt.now(tz)
    except (ZoneInfoNotFoundError, Exception):
        tz_name = "UTC"
        now_tz = _dt.utcnow()
    return {
        "timezone": tz_name,
        "server_time": now_tz.strftime("%Y-%m-%d %H:%M:%S"),
        "utc_offset": now_tz.strftime("%z"),
    }


@router.get("/job-logs")
def get_job_logs(
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_system_admin(current_user)
    from server.models import SystemLog
    logs = (
        db.query(SystemLog)
        .filter(SystemLog.event_type.in_(["auto_master_collect", "auto_master_enrich"]))
        .order_by(SystemLog.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": log.id,
            "event_type": log.event_type,
            "message": log.message,
            "details": log.details,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log in logs
    ]


@router.post("/reset-progress")
def reset_progress(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_system_admin(current_user)
    _set_key(db, "auto_master_city_idx", "0")
    _set_key(db, "auto_master_keyword_idx", "0")
    _set_key(db, "auto_master_page_idx", "1")
    return {"ok": True, "message": "進捗をリセットしました"}


@router.post("/clear-master-data")
def clear_master_data(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_system_admin(current_user)
    count = db.query(CompanyMaster).count()
    db.query(CompanyMaster).delete()
    db.commit()
    _set_key(db, "auto_master_city_idx", "0")
    _set_key(db, "auto_master_keyword_idx", "0")
    _set_key(db, "auto_master_page_idx", "1")
    _set_key(db, "auto_master_last_count", "0")
    _set_key(db, "auto_master_total_collected", "0")
    _set_key(db, "auto_master_last_run", "")
    return {"ok": True, "message": f"{count}件のマスターデータを削除しました"}


@router.post("/run-now")
def run_now(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_system_admin(current_user)
    from server.services.scheduler import _run_auto_master_collect
    job_id = str(uuid.uuid4())
    job_update(job_id, type="progress", current=0, total=100, message="収集を開始しています...", status="running")
    t = threading.Thread(target=_run_auto_master_collect, args=(job_id,), daemon=True)
    t.start()
    return {"job_id": job_id, "message": "収集を開始しました"}


@router.get("/job-status/{job_id}")
def get_job_status(
    job_id: str,
    current_user: User = Depends(get_current_user),
):
    _require_system_admin(current_user)
    from server.services.collector import get_job_status as _get_status
    return _get_status(job_id)


@router.post("/run-enrich")
def run_enrich(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_system_admin(current_user)
    from server.services.scheduler import _run_auto_master_enrich
    job_id = str(uuid.uuid4())
    job_update(job_id, type="progress", current=0, total=100, message="URL補完を開始しています...", status="running")
    t = threading.Thread(target=_run_auto_master_enrich, args=(job_id,), daemon=True)
    t.start()
    return {"job_id": job_id, "message": "URL補完を開始しました"}
