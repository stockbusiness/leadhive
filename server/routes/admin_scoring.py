import json
import logging
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from server.database import get_db, SessionLocal
from server.models import SystemSettings, User, Company, CompanyMaster
from server.auth import get_current_user
from server.services.scorer import DEFAULT_SCORING_RULES, get_rules_from_db, calculate_score

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
