import logging
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func as sqlfunc
from sqlalchemy.orm import Session

from server.auth import get_current_user
from server.database import get_db
from server.models import CallLog, Company, Project, User

router = APIRouter(prefix="/api/tele-apo", tags=["tele-apo"])
logger = logging.getLogger(__name__)


def _owned_projects(current_user: User, db: Session):
    return [p.id for p in db.query(Project.id).filter(Project.org_id == current_user.org_id).all()]


@router.get("/companies")
def list_companies_for_call(
    project_id: Optional[int] = None,
    score_rank: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    owned_pids = _owned_projects(current_user, db)
    q = db.query(Company).filter(
        Company.project_id.in_(owned_pids),
        Company.phone.isnot(None),
        Company.phone != "",
    )
    if project_id and project_id in owned_pids:
        q = q.filter(Company.project_id == project_id)
    if score_rank:
        q = q.filter(Company.score_rank == score_rank)
    if status:
        q = q.filter(Company.status == status)
    if search:
        q = q.filter(
            Company.company_name.ilike(f"%{search}%") |
            Company.phone.ilike(f"%{search}%")
        )
    total = q.count()
    companies = q.order_by(Company.score_total.desc()).offset(offset).limit(limit).all()

    company_ids = [c.id for c in companies]
    last_calls: dict = {}
    last_results: dict = {}
    if company_ids:
        rows = (
            db.query(CallLog.company_id, sqlfunc.max(CallLog.called_at).label("last_called"))
            .filter(CallLog.company_id.in_(company_ids), CallLog.org_id == current_user.org_id)
            .group_by(CallLog.company_id)
            .all()
        )
        for co_id, last_at in rows:
            last_calls[co_id] = last_at
        for co_id, last_at in last_calls.items():
            log = db.query(CallLog).filter(
                CallLog.company_id == co_id,
                CallLog.called_at == last_at,
                CallLog.org_id == current_user.org_id,
            ).first()
            if log:
                last_results[co_id] = log.result

    result = []
    for c in companies:
        result.append({
            "id": c.id,
            "company_name": c.company_name,
            "phone": c.phone,
            "website_url": c.website_url,
            "status": c.status,
            "score_rank": c.score_rank,
            "score_total": c.score_total,
            "prefecture": c.prefecture,
            "category_main": c.category_main,
            "contact_name": c.contact_name,
            "contact_title": c.contact_title,
            "notes": c.notes,
            "ai_summary": c.ai_summary,
            "last_called_at": last_calls.get(c.id),
            "last_call_result": last_results.get(c.id),
        })
    return {"companies": result, "total": total}


class CallLogCreate(BaseModel):
    company_id: int
    result: str
    note: Optional[str] = None


@router.post("/logs")
def create_call_log(
    payload: CallLogCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    owned_pids = _owned_projects(current_user, db)
    co = db.query(Company).filter(
        Company.id == payload.company_id,
        Company.project_id.in_(owned_pids),
    ).first()
    if not co:
        raise HTTPException(status_code=404, detail="企業が見つかりません")

    log = CallLog(
        org_id=current_user.org_id,
        company_id=payload.company_id,
        called_by=current_user.id,
        result=payload.result,
        note=payload.note,
    )
    db.add(log)

    if payload.result == "商談決定" and co.status in ("未確認", "対象候補", "アプローチ前"):
        co.status = "商談中"
    elif payload.result == "興味あり" and co.status in ("未確認", "対象候補"):
        co.status = "アプローチ済"

    db.commit()
    db.refresh(log)
    return {"id": log.id, "called_at": log.called_at, "result": log.result}


@router.get("/logs")
def list_call_logs(
    company_id: Optional[int] = None,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(CallLog).filter(CallLog.org_id == current_user.org_id)
    if company_id:
        q = q.filter(CallLog.company_id == company_id)
    logs = q.order_by(CallLog.called_at.desc()).limit(limit).all()

    result = []
    for log in logs:
        co = db.query(Company.company_name).filter(Company.id == log.company_id).first()
        caller = db.query(User.display_name, User.email).filter(User.id == log.called_by).first()
        result.append({
            "id": log.id,
            "company_id": log.company_id,
            "company_name": co.company_name if co else "",
            "caller_name": (caller.display_name or caller.email) if caller else "",
            "called_at": log.called_at,
            "result": log.result,
            "note": log.note,
        })
    return {"logs": result}


@router.delete("/logs/{log_id}")
def delete_call_log(
    log_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    log = db.query(CallLog).filter(
        CallLog.id == log_id, CallLog.org_id == current_user.org_id
    ).first()
    if not log:
        raise HTTPException(status_code=404, detail="ログが見つかりません")
    db.delete(log)
    db.commit()
    return {"deleted": True}


@router.get("/stats")
def get_call_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today = date.today()
    today_logs = (
        db.query(CallLog)
        .filter(
            CallLog.org_id == current_user.org_id,
            sqlfunc.date(CallLog.called_at) == today,
        )
        .all()
    )
    total_today = len(today_logs)
    connected = sum(1 for l in today_logs if l.result not in ("不在", "留守電"))
    appointments = sum(1 for l in today_logs if l.result == "商談決定")
    return {
        "total_today": total_today,
        "connected": connected,
        "connect_rate": round(connected / total_today * 100) if total_today > 0 else 0,
        "appointments": appointments,
        "appointment_rate": round(appointments / connected * 100) if connected > 0 else 0,
    }


class ScriptRequest(BaseModel):
    company_id: int


@router.post("/script")
def generate_script(
    payload: ScriptRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    owned_pids = _owned_projects(current_user, db)
    co = db.query(Company).filter(
        Company.id == payload.company_id,
        Company.project_id.in_(owned_pids),
    ).first()
    if not co:
        raise HTTPException(status_code=404, detail="企業が見つかりません")

    ai_summary_text = ""
    if co.ai_summary and isinstance(co.ai_summary, dict):
        ai_summary_text = (
            co.ai_summary.get("summary") or
            co.ai_summary.get("description") or
            str(co.ai_summary)[:300]
        )

    try:
        from server.services.ai_writer import _resolve_anthropic_key
        import anthropic

        api_key = _resolve_anthropic_key()
        name_addr = f"{co.contact_title or ''}の{co.contact_name}様" if co.contact_name else "ご担当者様"
        prompt = f"""あなたはB2B営業のプロです。以下の企業に対するテレアポトークスクリプトを日本語で作成してください。

## 相手企業情報
- 会社名: {co.company_name or "不明"}
- 業種: {co.category_main or "不明"}
- 都道府県: {co.prefecture or "不明"}
- 担当者: {name_addr}
{f"- サイト概要: {ai_summary_text}" if ai_summary_text else ""}

## 指示
- 挨拶 → 自己紹介 → 用件 → ヒアリング → アポ打診 の流れで
- 各セクションは2〜3文程度で簡潔に
- 全体で1〜2分程度で読める長さ
- マークダウン形式（## セクション名 + 内容）で出力
"""
        client = anthropic.Anthropic(api_key=api_key)
        resp = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=800,
            messages=[{"role": "user", "content": prompt}],
        )
        script = resp.content[0].text
    except Exception as e:
        logger.warning(f"AI script generation failed, using rule-based: {e}")
        name_addr = f"{co.contact_title or ''}の{co.contact_name}様" if co.contact_name else "ご担当者様"
        company = co.company_name or "御社"
        script = f"""## 挨拶・自己紹介
突然のお電話失礼いたします。私、[自社名]の[氏名]と申します。{company}の{name_addr}はいらっしゃいますでしょうか。

## 用件
本日お電話いたしましたのは、{co.category_main or "御社"}様のビジネスに貢献できるご提案をさせていただきたく、ご連絡いたしました。

## ヒアリング
現在、営業活動の効率化や新規顧客の獲得において、何かご課題はございますか？弊社では多くの企業様の営業支援をしており、具体的な改善事例もございます。

## アポイント打診
もしよろしければ、詳しいご説明の機会を30分ほどいただけないでしょうか？オンラインでも対応可能でございます。今週か来週で、ご都合のよいお日にちはございますか？

## クロージング
それでは、[日時]にお時間をいただけますでしょうか。本日はお時間をいただきありがとうございました。"""

    return {"script": script, "company_name": co.company_name}
