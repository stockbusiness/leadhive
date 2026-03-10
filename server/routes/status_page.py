from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from server.database import get_db
from server.auth import require_admin
from server.models import StatusIncident

router = APIRouter(tags=["status"])

SEVERITIES = {
    "minor": "軽微",
    "major": "重大",
    "critical": "緊急",
}

STATUSES = {
    "investigating": "調査中",
    "identified": "原因特定",
    "monitoring": "監視中",
    "resolved": "解決済み",
}


def _to_dict(inc: StatusIncident) -> dict:
    return {
        "id": inc.id,
        "title": inc.title,
        "body": inc.body,
        "severity": inc.severity,
        "severity_label": SEVERITIES.get(inc.severity, inc.severity),
        "status": inc.status,
        "status_label": STATUSES.get(inc.status, inc.status),
        "created_at": inc.created_at.isoformat() if inc.created_at else None,
        "resolved_at": inc.resolved_at.isoformat() if inc.resolved_at else None,
    }


@router.get("/api/status-page")
def get_status(db: Session = Depends(get_db)):
    incidents = db.query(StatusIncident).order_by(
        StatusIncident.created_at.desc()
    ).limit(20).all()
    active = [i for i in incidents if i.status != "resolved"]
    is_operational = len(active) == 0
    return {
        "is_operational": is_operational,
        "incidents": [_to_dict(i) for i in incidents],
    }


@router.get("/api/admin/status-incidents")
def admin_list(
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    items = db.query(StatusIncident).order_by(StatusIncident.created_at.desc()).all()
    return [_to_dict(i) for i in items]


class IncidentBody(BaseModel):
    title: str
    body: Optional[str] = ""
    severity: str = "minor"
    status: str = "investigating"


@router.post("/api/admin/status-incidents")
def create_incident(
    body: IncidentBody,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    if not body.title.strip():
        raise HTTPException(status_code=400, detail="タイトルは必須です")
    inc = StatusIncident(
        title=body.title.strip(),
        body=body.body,
        severity=body.severity,
        status=body.status,
    )
    db.add(inc)
    db.commit()
    db.refresh(inc)
    return _to_dict(inc)


@router.put("/api/admin/status-incidents/{inc_id}")
def update_incident(
    inc_id: int,
    body: IncidentBody,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    inc = db.query(StatusIncident).filter(StatusIncident.id == inc_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="インシデントが見つかりません")
    inc.title = body.title.strip()
    inc.body = body.body
    inc.severity = body.severity
    inc.status = body.status
    if body.status == "resolved" and not inc.resolved_at:
        inc.resolved_at = datetime.now()
    db.commit()
    db.refresh(inc)
    return _to_dict(inc)


@router.delete("/api/admin/status-incidents/{inc_id}")
def delete_incident(
    inc_id: int,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    inc = db.query(StatusIncident).filter(StatusIncident.id == inc_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail="インシデントが見つかりません")
    db.delete(inc)
    db.commit()
    return {"message": "削除しました"}
