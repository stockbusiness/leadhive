import json
import logging
import requests
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from server.database import get_db, SessionLocal
from server.models import SystemSettings, User, Company, CompanyMaster
from server.auth import get_current_user
from server.services.scorer import DEFAULT_SCORING_RULES, get_rules_from_db, calculate_score
from server.services.scraper import detect_cms, LEADHIVE_UA
from server.services.categorizer import calculate_ec_score
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

router = APIRouter()

SCORING_RULES_KEY = "scoring_rules"


def _require_system_admin(current_user: User):
    if not current_user.is_system_admin:
        raise HTTPException(status_code=403, detail="System admin required")


@router.get("/api/admin/scoring-rules")
def get_scoring_rules(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_system_admin(current_user)
    row = db.query(SystemSettings).filter(SystemSettings.key == SCORING_RULES_KEY).first()
    if row and row.value:
        try:
            rules = json.loads(row.value)
        except Exception:
            rules = dict(DEFAULT_SCORING_RULES)
    else:
        rules = dict(DEFAULT_SCORING_RULES)
    return {"rules": rules, "defaults": DEFAULT_SCORING_RULES}


@router.put("/api/admin/scoring-rules")
def update_scoring_rules(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_system_admin(current_user)
    rules = payload.get("rules", {})
    if not isinstance(rules, dict):
        raise HTTPException(status_code=400, detail="rules must be a dict")
    for k, v in rules.items():
        if not isinstance(v, (int, float)):
            raise HTTPException(status_code=400, detail=f"Value for {k} must be numeric")

    serialized = json.dumps(rules)
    row = db.query(SystemSettings).filter(SystemSettings.key == SCORING_RULES_KEY).first()
    if row:
        row.value = serialized
    else:
        db.add(SystemSettings(key=SCORING_RULES_KEY, value=serialized))
    db.commit()
    return {"ok": True, "rules": rules}


@router.post("/api/admin/scoring-rules/reset")
def reset_scoring_rules(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_system_admin(current_user)
    row = db.query(SystemSettings).filter(SystemSettings.key == SCORING_RULES_KEY).first()
    if row:
        db.delete(row)
        db.commit()
    return {"ok": True, "rules": DEFAULT_SCORING_RULES}


_rescore_status: dict = {"running": False, "updated_companies": 0, "updated_masters": 0, "total": 0, "done": 0}


def _run_bulk_rescore():
    global _rescore_status
    db = SessionLocal()
    try:
        rules = get_rules_from_db(db)
        batch_size = 200

        masters = db.query(CompanyMaster).all()
        total_m = len(masters)
        updated_m = 0
        for i in range(0, total_m, batch_size):
            batch = masters[i:i + batch_size]
            for m in batch:
                d = {c.name: getattr(m, c.name) for c in CompanyMaster.__table__.columns}
                score, rank = calculate_score(d, custom_rules=rules)
                m.score_total = score
                m.score_rank = rank
                updated_m += 1
            db.commit()
            _rescore_status["updated_masters"] = updated_m
            _rescore_status["done"] = updated_m + _rescore_status["updated_companies"]

        companies = db.query(Company).all()
        total_c = len(companies)
        updated_c = 0
        for i in range(0, total_c, batch_size):
            batch = companies[i:i + batch_size]
            for c in batch:
                d = {col.name: getattr(c, col.name) for col in Company.__table__.columns}
                score, rank = calculate_score(d, custom_rules=rules)
                c.score_total = score
                c.score_rank = rank
                updated_c += 1
            db.commit()
            _rescore_status["updated_companies"] = updated_c
            _rescore_status["done"] = updated_m + updated_c

        _rescore_status["total"] = total_m + total_c
    except Exception as e:
        logger.error(f"Bulk rescore error: {e}")
    finally:
        _rescore_status["running"] = False
        db.close()


@router.post("/api/admin/scoring-rules/bulk-rescore")
def bulk_rescore(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    global _rescore_status
    _require_system_admin(current_user)
    if _rescore_status["running"]:
        return {"ok": False, "message": "既に再スコアリング中です"}
    _rescore_status = {"running": True, "updated_companies": 0, "updated_masters": 0, "total": 0, "done": 0}
    background_tasks.add_task(_run_bulk_rescore)
    return {"ok": True, "message": "再スコアリングを開始しました"}


@router.get("/api/admin/scoring-rules/bulk-rescore/status")
def bulk_rescore_status(current_user: User = Depends(get_current_user)):
    _require_system_admin(current_user)
    return _rescore_status


@router.get("/api/admin/slack-triggers")
def get_slack_triggers(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_system_admin(current_user)
    from server.services.slack_notifier import get_triggers, DEFAULT_TRIGGERS
    triggers = get_triggers(db)
    return {"triggers": triggers, "defaults": DEFAULT_TRIGGERS}


@router.put("/api/admin/slack-triggers")
def update_slack_triggers(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_system_admin(current_user)
    from server.services.slack_notifier import save_triggers
    triggers = payload.get("triggers", {})
    if not isinstance(triggers, dict):
        raise HTTPException(status_code=400, detail="triggers must be a dict")
    save_triggers(db, triggers)
    return {"ok": True, "triggers": triggers}


EC_DETECT_HISTORY_KEY = "ec_detect_history"

_ec_detect_status: dict = {
    "running": False, "done": 0, "total": 0,
    "updated": 0, "skipped": 0, "errors": 0,
    "updated_master": 0, "include_master": False,
}


def _detect_and_update(record, db) -> bool:
    """Fetch a URL, detect CMS/EC, update record fields. Returns True if changed."""
    try:
        resp = requests.get(
            record.website_url,
            headers={"User-Agent": LEADHIVE_UA},
            timeout=10,
            allow_redirects=True,
        )
        html = resp.text
        soup = BeautifulSoup(html, "html.parser")
        text = soup.get_text(separator=" ", strip=True)
        cms = detect_cms(soup, html, dict(resp.headers))
        ec_score = calculate_ec_score(soup, html, text)
        ec_flag_val = True if ec_score >= 70 else (False if ec_score <= 30 else None)

        changed = False
        if cms and getattr(record, "cms_type", None) != cms:
            record.cms_type = cms
            if hasattr(record, "cms_detected_at"):
                record.cms_detected_at = datetime.utcnow()
            changed = True
        if ec_flag_val is not None and getattr(record, "ec_flag", None) != ec_flag_val:
            record.ec_flag = ec_flag_val
            changed = True
        if cms == "Shopify" and hasattr(record, "shopify_flag") and not record.shopify_flag:
            record.shopify_flag = True
            changed = True
        if cms == "BASE" and hasattr(record, "base_flag") and not record.base_flag:
            record.base_flag = True
            changed = True
        if cms == "MakeShop" and hasattr(record, "makeshop_flag") and not record.makeshop_flag:
            record.makeshop_flag = True
            changed = True
        if cms == "futureshop" and hasattr(record, "futureshop_flag") and not record.futureshop_flag:
            record.futureshop_flag = True
            changed = True
        if cms == "STORES" and hasattr(record, "stores_flag") and not record.stores_flag:
            record.stores_flag = True
            changed = True
        return changed
    except Exception:
        return False


def _run_bulk_ec_detect(only_missing: bool = True, include_master: bool = True):
    global _ec_detect_status
    db = SessionLocal()
    started_at = datetime.utcnow().isoformat()
    try:
        # Company レコード
        q = db.query(Company).filter(Company.website_url.isnot(None), Company.website_url != "")
        if only_missing:
            q = q.filter(Company.cms_type.is_(None))
        companies = q.all()

        # CompanyMaster レコード（オプション）
        masters = []
        if include_master:
            qm = db.query(CompanyMaster).filter(CompanyMaster.website_url.isnot(None), CompanyMaster.website_url != "")
            if only_missing:
                qm = qm.filter(CompanyMaster.cms_type.is_(None))
            masters = qm.all()

        total = len(companies) + len(masters)
        _ec_detect_status["total"] = total

        updated = skipped = errors = updated_master = 0

        for records, is_master in [(companies, False), (masters, True)]:
            for c in records:
                try:
                    changed = _detect_and_update(c, db)
                    if changed:
                        if is_master:
                            updated_master += 1
                        else:
                            updated += 1
                    else:
                        skipped += 1
                except Exception:
                    errors += 1
                    skipped += 1

                _ec_detect_status["done"] += 1
                _ec_detect_status["updated"] = updated
                _ec_detect_status["updated_master"] = updated_master
                _ec_detect_status["skipped"] = skipped
                _ec_detect_status["errors"] = errors

                if _ec_detect_status["done"] % 10 == 0:
                    db.commit()

        db.commit()

        # 履歴を SystemSettings に保存
        finished_at = datetime.utcnow().isoformat()
        history_entry = {
            "started_at": started_at,
            "finished_at": finished_at,
            "only_missing": only_missing,
            "include_master": include_master,
            "total": total,
            "updated": updated,
            "updated_master": updated_master,
            "skipped": skipped,
            "errors": errors,
        }
        row = db.query(SystemSettings).filter(SystemSettings.key == EC_DETECT_HISTORY_KEY).first()
        if row:
            try:
                prev = json.loads(row.value) if row.value else []
            except Exception:
                prev = []
            prev.insert(0, history_entry)
            row.value = json.dumps(prev[:20])  # 最新20件保持
        else:
            row = SystemSettings(key=EC_DETECT_HISTORY_KEY, value=json.dumps([history_entry]))
            db.add(row)
        db.commit()

    except Exception as e:
        logger.error(f"Bulk EC detect error: {e}")
    finally:
        _ec_detect_status["running"] = False
        db.close()


@router.post("/api/admin/ec-detect-bulk")
def bulk_ec_detect(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    only_missing: bool = True,
    include_master: bool = True,
):
    global _ec_detect_status
    _require_system_admin(current_user)
    if _ec_detect_status["running"]:
        return {"ok": False, "message": "既に実行中です"}
    _ec_detect_status = {
        "running": True, "done": 0, "total": 0,
        "updated": 0, "updated_master": 0, "skipped": 0, "errors": 0,
        "include_master": include_master,
    }
    background_tasks.add_task(_run_bulk_ec_detect, only_missing, include_master)
    mode = "未検出企業のみ" if only_missing else "全企業"
    master_note = "（マスターDB含む）" if include_master else ""
    return {"ok": True, "message": f"{mode}{master_note}のEC再検出を開始しました"}


@router.get("/api/admin/ec-detect-bulk/status")
def bulk_ec_detect_status(current_user: User = Depends(get_current_user)):
    _require_system_admin(current_user)
    return _ec_detect_status


@router.get("/api/admin/ec-detect-bulk/history")
def bulk_ec_detect_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_system_admin(current_user)
    row = db.query(SystemSettings).filter(SystemSettings.key == EC_DETECT_HISTORY_KEY).first()
    if not row or not row.value:
        return {"history": []}
    try:
        history = json.loads(row.value)
    except Exception:
        history = []
    return {"history": history}
