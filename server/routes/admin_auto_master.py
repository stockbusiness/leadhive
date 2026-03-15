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
    "auto_master_max_pages_per_combo",
    "auto_master_schedule_hour",
    "auto_master_last_run",
    "auto_master_last_run_date",
    "auto_master_last_count",
    "auto_master_total_collected",
    "gbizinfo_api_token",
    "auto_master_enrich_enabled",
    "auto_master_enrich_max",
    "auto_master_enrich_schedule_hour",
    "auto_master_enrich_last_run",
    "auto_master_enrich_last_run_date",
    "auto_master_enrich_total",
    "auto_master_enrich_progress",
    "scheduler_timezone",
    "serper_api_key",
]

DEFAULTS = {
    "auto_master_enabled": "false",
    "auto_master_city_idx": "0",
    "auto_master_keyword_idx": "0",
    "auto_master_page_idx": "1",
    "auto_master_max_companies": "1000",
    "auto_master_max_enrich": "10",
    "auto_master_max_pages_per_combo": "10",
    "auto_master_schedule_hour": "3",
    "auto_master_last_run": "",
    "auto_master_last_run_date": "",
    "auto_master_last_count": "0",
    "auto_master_total_collected": "0",
    "gbizinfo_api_token": "",
    "auto_master_enrich_enabled": "true",
    "auto_master_enrich_max": "100",
    "auto_master_enrich_schedule_hour": "5",
    "auto_master_enrich_last_run": "",
    "auto_master_enrich_last_run_date": "",
    "auto_master_enrich_total": "0",
    "auto_master_enrich_progress": "",
    "scheduler_timezone": "Asia/Tokyo",
    "serper_api_key": "",
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
    max_pages_per_combo = max(1, min(100, int(settings.get("auto_master_max_pages_per_combo", "10"))))

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
        "enrich_schedule_hour": int(settings.get("auto_master_enrich_schedule_hour", "5")),
        "enrich_last_run": settings.get("auto_master_enrich_last_run", ""),
        "enrich_total": int(settings.get("auto_master_enrich_total", "0")),
        "enrich_progress": settings.get("auto_master_enrich_progress", ""),
        "has_serper_key": bool(os.environ.get("SERPER_API_KEY") or settings.get("serper_api_key")),
        "no_url_count": no_url_count,
        "scheduler_timezone": settings.get("scheduler_timezone", "Asia/Tokyo"),
        "max_pages_per_combo": max_pages_per_combo,
        "estimated_max": TOTAL_CITIES * len(AUTO_MASTER_KEYWORDS) * max_pages_per_combo * 100,
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
        "auto_master_max_pages_per_combo", "auto_master_schedule_hour",
        "auto_master_enrich_enabled", "auto_master_enrich_max", "auto_master_enrich_schedule_hour",
        "scheduler_timezone", "gbizinfo_api_token", "serper_api_key",
    }

    old_enrich_hour = None
    old_master_hour = None
    settings = _get_all(db)

    if "auto_master_enrich_schedule_hour" in data:
        old_enrich_hour = settings.get("auto_master_enrich_schedule_hour", "5")
    if "auto_master_schedule_hour" in data:
        old_master_hour = settings.get("auto_master_schedule_hour", "3")

    for key, val in data.items():
        if key in allowed:
            _set_key(db, key, str(val))

    if old_enrich_hour is not None and str(data.get("auto_master_enrich_schedule_hour")) != str(old_enrich_hour):
        _set_key(db, "auto_master_enrich_last_run_date", "")
        logger.info(f"AutoMasterEnrich: スケジュール変更 ({old_enrich_hour}→{data['auto_master_enrich_schedule_hour']}) → 本日の実行記録をリセット")

    if old_master_hour is not None and str(data.get("auto_master_schedule_hour")) != str(old_master_hour):
        _set_key(db, "auto_master_last_run_date", "")
        logger.info(f"AutoMaster: スケジュール変更 ({old_master_hour}→{data['auto_master_schedule_hour']}) → 本日の実行記録をリセット")

    return {"ok": True}


@router.post("/reset-today")
def reset_today_run(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_system_admin(current_user)
    _set_key(db, "auto_master_enrich_last_run_date", "")
    _set_key(db, "auto_master_last_run_date", "")
    logger.info(f"AutoMaster: 本日の実行記録を手動リセット (by user={current_user.id})")
    return {"ok": True, "message": "本日の実行記録をリセットしました。次のスケジュール時刻に自動実行されます。"}


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
    try:
        logs = (
            db.query(SystemLog)
            .filter(SystemLog.action.in_(["auto_master_collect", "auto_master_enrich"]))
            .order_by(SystemLog.created_at.desc())
            .limit(limit)
            .all()
        )
        return {
            "logs": [
                {
                    "id": log.id,
                    "event_type": log.action,
                    "message": log.detail,
                    "details": log.detail,
                    "created_at": log.created_at.isoformat() if log.created_at else None,
                }
                for log in logs
            ]
        }
    except Exception as e:
        logger.warning(f"job-logs query error: {e}")
        return {"logs": []}


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


@router.post("/clear-enrich-progress")
def clear_enrich_progress(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_system_admin(current_user)
    _set_key(db, "auto_master_enrich_progress", "")
    return {"ok": True, "message": "URL補完の進捗フラグをクリアしました"}


@router.post("/abort-enrich")
def abort_enrich(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_system_admin(current_user)
    _set_key(db, "auto_master_enrich_abort", "1")
    _set_key(db, "auto_master_enrich_progress", "")
    return {"ok": True, "message": "中止フラグをセットしました。次のループで停止します"}


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
    return {"ok": True, "deleted": count, "message": f"{count}件のマスターデータを削除しました"}


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
    import logging as _logging
    _logger = _logging.getLogger(__name__)

    def _safe_enrich():
        try:
            _run_auto_master_enrich(force=True)
        except Exception as e:
            _logger.error(f"AutoMasterEnrich crashed in thread: {e}", exc_info=True)

    job_id = str(uuid.uuid4())
    job_update(job_id, type="progress", current=0, total=100, message="URL補完を開始しています...", status="running")
    t = threading.Thread(target=_safe_enrich, daemon=True)
    t.start()
    return {"job_id": job_id, "message": "URL補完を開始しました"}


@router.get("/quality-stats")
def get_quality_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_system_admin(current_user)
    from sqlalchemy import func as sqlfunc, case
    from server.models import JobLog

    total = db.query(sqlfunc.count(CompanyMaster.id)).scalar() or 0
    has_url = db.query(sqlfunc.count(CompanyMaster.id)).filter(
        CompanyMaster.website_url.isnot(None), CompanyMaster.website_url != ""
    ).scalar() or 0
    has_contact = db.query(sqlfunc.count(CompanyMaster.id)).filter(
        CompanyMaster.contact_url.isnot(None), CompanyMaster.contact_url != ""
    ).scalar() or 0
    has_email = db.query(sqlfunc.count(CompanyMaster.id)).filter(
        CompanyMaster.email.isnot(None), CompanyMaster.email != ""
    ).scalar() or 0
    has_phone = db.query(sqlfunc.count(CompanyMaster.id)).filter(
        CompanyMaster.phone.isnot(None), CompanyMaster.phone != ""
    ).scalar() or 0
    has_cms = db.query(sqlfunc.count(CompanyMaster.id)).filter(
        CompanyMaster.cms_type.isnot(None), CompanyMaster.cms_type != ""
    ).scalar() or 0

    rank_rows = db.query(
        CompanyMaster.score_rank, sqlfunc.count(CompanyMaster.id)
    ).group_by(CompanyMaster.score_rank).all()
    by_rank = {r: c for r, c in rank_rows}

    pref_rows = db.query(
        CompanyMaster.prefecture, sqlfunc.count(CompanyMaster.id)
    ).filter(CompanyMaster.prefecture.isnot(None)).group_by(
        CompanyMaster.prefecture
    ).order_by(sqlfunc.count(CompanyMaster.id).desc()).limit(10).all()
    by_prefecture = [{"prefecture": p, "count": c} for p, c in pref_rows]

    cat_rows = db.query(
        CompanyMaster.category_main, sqlfunc.count(CompanyMaster.id)
    ).filter(CompanyMaster.category_main.isnot(None)).group_by(
        CompanyMaster.category_main
    ).order_by(sqlfunc.count(CompanyMaster.id).desc()).limit(10).all()
    by_category = [{"category": c, "count": n} for c, n in cat_rows]

    last_created = db.query(sqlfunc.max(CompanyMaster.created_at)).scalar()
    last_scraped = db.query(sqlfunc.max(CompanyMaster.last_scraped_at)).scalar()

    job_rows = db.query(JobLog).order_by(JobLog.started_at.desc()).limit(10).all()
    recent_jobs = [
        {
            "job_id": j.job_id,
            "job_type": j.job_type,
            "status": j.status,
            "source_count": j.source_count,
            "saved_count": j.saved_count,
            "error_count": j.error_count,
            "started_at": j.started_at.isoformat() if j.started_at else None,
            "finished_at": j.finished_at.isoformat() if j.finished_at else None,
        }
        for j in job_rows
    ]

    return {
        "total": total,
        "has_url": has_url,
        "has_contact": has_contact,
        "has_email": has_email,
        "has_phone": has_phone,
        "has_cms": has_cms,
        "by_rank": by_rank,
        "by_prefecture": by_prefecture,
        "by_category": by_category,
        "last_created_at": last_created.isoformat() if last_created else None,
        "last_scraped_at": last_scraped.isoformat() if last_scraped else None,
        "recent_jobs": recent_jobs,
    }
