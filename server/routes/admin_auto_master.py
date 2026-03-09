import uuid
import threading
import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from server.database import get_db, SessionLocal
from server.routes.auth import get_current_user
from server.models import User, SystemSettings, CompanyMaster
from server.services.collector import job_update
from server.services.gbiz_collector import PREFECTURES

router = APIRouter(prefix="/api/admin/auto-master", tags=["admin-auto-master"])
logger = logging.getLogger(__name__)

SETTINGS_KEYS = [
    "auto_master_enabled",
    "auto_master_pref_idx",
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
    "auto_master_pref_idx": "0",
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

AUTO_MASTER_KEYWORDS = ["株式会社", "合同会社", "有限会社", "医療法人", "社会福祉法人"]


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
    row = db.query(SystemSettings).filter(SystemSettings.key == key).first()
    if row:
        row.value = value
    else:
        db.add(SystemSettings(key=key, value=value))
    db.commit()


@router.get("/status")
def get_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_system_admin(current_user)
    settings = _get_all(db)
    pref_idx = int(settings.get("auto_master_pref_idx", "0"))
    if pref_idx >= len(PREFECTURES):
        pref_idx = 0

    master_count = db.query(CompanyMaster).count()

    keyword_idx = int(settings.get("auto_master_keyword_idx", "0")) % len(AUTO_MASTER_KEYWORDS)
    page_idx = max(1, int(settings.get("auto_master_page_idx", "1")))

    import os
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
        "pref_idx": pref_idx,
        "current_prefecture": PREFECTURES[pref_idx],
        "prefectures": PREFECTURES,
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
        "scheduler_timezone",
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


@router.post("/reset-progress")
def reset_progress(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_system_admin(current_user)
    _set_key(db, "auto_master_pref_idx", "0")
    _set_key(db, "auto_master_keyword_idx", "0")
    _set_key(db, "auto_master_page_idx", "1")
    return {"ok": True}


@router.post("/clear-master-data")
def clear_master_data(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_system_admin(current_user)
    deleted = db.query(CompanyMaster).filter(CompanyMaster.source == "auto_master").delete()
    db.commit()
    _set_key(db, "auto_master_pref_idx", "0")
    _set_key(db, "auto_master_keyword_idx", "0")
    _set_key(db, "auto_master_page_idx", "1")
    _set_key(db, "auto_master_last_count", "0")
    _set_key(db, "auto_master_total_collected", "0")
    _set_key(db, "auto_master_last_run", "")
    return {"deleted": deleted, "ok": True}


@router.post("/run-now")
def run_now(
    current_user: User = Depends(get_current_user),
):
    _require_system_admin(current_user)
    job_id = str(uuid.uuid4())
    job_update(job_id, type="progress", current=0, total=0,
               message="マスターDB自動収集を開始しています...", status="running",
               job_type="auto_master")

    def run():
        from server.services.scheduler import _run_auto_master_collect
        _run_auto_master_collect(job_id=job_id)

    threading.Thread(target=run, daemon=True).start()
    return {"job_id": job_id}


@router.get("/job-logs")
def get_job_logs(
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_system_admin(current_user)
    from server.models import JobLog
    rows = (
        db.query(JobLog)
        .order_by(JobLog.started_at.desc())
        .limit(limit)
        .all()
    )
    return {
        "logs": [
            {
                "id": r.id,
                "job_id": r.job_id,
                "job_type": r.job_type,
                "status": r.status,
                "message": r.message,
                "current": r.current,
                "total": r.total,
                "source_count": r.source_count,
                "saved_count": r.saved_count,
                "error_count": r.error_count,
                "started_at": r.started_at.isoformat() if r.started_at else None,
                "finished_at": r.finished_at.isoformat() if r.finished_at else None,
            }
            for r in rows
        ]
    }
