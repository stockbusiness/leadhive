import threading
import time
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

_scheduler_thread = None
_scheduler_running = False
_scheduler_lock = threading.Lock()


def _run_auto_collect():
    from server.database import SessionLocal
    from server.models import AppSetting, SearchKeyword
    from server.services.collector import collect_by_keyword

    db = SessionLocal()
    try:
        enabled = db.query(AppSetting).filter(AppSetting.setting_key == "auto_collect_enabled").first()
        if not enabled or enabled.setting_value != "true":
            return

        keywords = db.query(SearchKeyword).filter(SearchKeyword.is_active == True).all()
        if not keywords:
            logger.info("Auto-collect: No active keywords")
            return

        logger.info(f"Auto-collect: Starting collection for {len(keywords)} keywords")
        for kw in keywords:
            try:
                result = collect_by_keyword(kw.id, db)
                success = result.get("summary", {}).get("success", 0)
                logger.info(f"Auto-collect: '{kw.keyword}' - {success} new companies")
            except Exception as e:
                logger.error(f"Auto-collect error for '{kw.keyword}': {e}")

        logger.info("Auto-collect: Collection complete")
    except Exception as e:
        logger.error(f"Auto-collect error: {e}")
    finally:
        db.close()


def _scheduler_loop():
    global _scheduler_running
    last_run_date = None

    while _scheduler_running:
        try:
            from server.database import SessionLocal
            from server.models import AppSetting

            db = SessionLocal()
            try:
                enabled = db.query(AppSetting).filter(AppSetting.setting_key == "auto_collect_enabled").first()
                schedule = db.query(AppSetting).filter(AppSetting.setting_key == "auto_collect_time").first()
            finally:
                db.close()

            if enabled and enabled.setting_value == "true" and schedule and schedule.setting_value:
                try:
                    hour, minute = map(int, schedule.setting_value.split(":"))
                    now = datetime.now()
                    today = now.date()

                    if now.hour == hour and now.minute == minute and last_run_date != today:
                        last_run_date = today
                        logger.info(f"Auto-collect: Triggered at {now.strftime('%H:%M')}")
                        _run_auto_collect()
                except (ValueError, AttributeError):
                    pass

        except Exception as e:
            logger.error(f"Scheduler error: {e}")

        time.sleep(30)


def start_scheduler():
    global _scheduler_thread, _scheduler_running
    with _scheduler_lock:
        if _scheduler_running:
            return
        _scheduler_running = True
        _scheduler_thread = threading.Thread(target=_scheduler_loop, daemon=True)
        _scheduler_thread.start()
        logger.info("Scheduler started")


def stop_scheduler():
    global _scheduler_running
    with _scheduler_lock:
        _scheduler_running = False
        logger.info("Scheduler stopped")


def get_scheduler_status() -> dict:
    return {
        "running": _scheduler_running,
    }
