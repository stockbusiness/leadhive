import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from server.database import get_db
from server.models import SystemSettings, User
from server.auth import get_current_user
from server.services.scorer import DEFAULT_SCORING_RULES

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
