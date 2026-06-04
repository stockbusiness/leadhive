import csv
import io
import logging
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import func as sqlfunc, case
from sqlalchemy.orm import Session

from server.auth import get_current_user
from server.database import get_db
from server.models import AppSetting, CallLog, Company, Project, User

router = APIRouter(prefix="/api/tele-apo", tags=["tele-apo"])
logger = logging.getLogger(__name__)

VALID_RESULTS = {"不在", "留守電", "折り返し", "NG", "興味あり", "商談決定"}
CONNECTED_RESULTS = {"折り返し", "NG", "興味あり", "商談決定"}
APPOINTMENT_RESULTS = {"商談決定"}


def _owned_projects(current_user: User, db: Session):
    return [p.id for p in db.query(Project.id).filter(Project.org_id == current_user.org_id).all()]


# ─── O1: N+1クエリ修正 ─── 最新架電情報をサブクエリで一括取得 ─────────────────
def _fetch_last_call_info(company_ids: list[int], org_id: int, db: Session) -> dict[int, dict]:
    if not company_ids:
        return {}
    latest_subq = (
        db.query(
            CallLog.company_id,
            sqlfunc.max(CallLog.called_at).label("max_called_at"),
        )
        .filter(CallLog.company_id.in_(company_ids), CallLog.org_id == org_id)
        .group_by(CallLog.company_id)
        .subquery()
    )
    rows = (
        db.query(CallLog)
        .join(
            latest_subq,
            (CallLog.company_id == latest_subq.c.company_id)
            & (CallLog.called_at == latest_subq.c.max_called_at),
        )
        .filter(CallLog.org_id == org_id)
        .all()
    )
    return {
        row.company_id: {
            "last_called_at": row.called_at,
            "last_call_result": row.result,
            "callback_at": row.callback_at,
        }
        for row in rows
    }


# ─── GET /companies (O1 N+1修正, O3 ソート, E5 exclude_ng) ───────────────────
@router.get("/companies")
def list_companies_for_call(
    project_id: Optional[int] = None,
    score_rank: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    sort: str = "score",
    exclude_ng: bool = False,
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
    if exclude_ng:
        q = q.filter(Company.status != "NG")
    if search:
        q = q.filter(
            Company.company_name.ilike(f"%{search}%")
            | Company.phone.ilike(f"%{search}%")
        )
    total = q.count()

    # O3: ソートオプション
    if sort == "uncalled_first":
        called_ids_subq = (
            db.query(CallLog.company_id)
            .filter(CallLog.org_id == current_user.org_id)
            .distinct()
            .subquery()
        )
        q = q.outerjoin(called_ids_subq, Company.id == called_ids_subq.c.company_id)
        q = q.order_by(
            case((called_ids_subq.c.company_id.is_(None), 0), else_=1),
            Company.score_total.desc(),
        )
    elif sort == "last_called":
        latest_subq = (
            db.query(
                CallLog.company_id,
                sqlfunc.max(CallLog.called_at).label("max_called_at"),
            )
            .filter(CallLog.org_id == current_user.org_id)
            .group_by(CallLog.company_id)
            .subquery()
        )
        q = q.outerjoin(latest_subq, Company.id == latest_subq.c.company_id)
        q = q.order_by(sqlfunc.coalesce(latest_subq.c.max_called_at, datetime(1970, 1, 1)).asc())
    else:
        q = q.order_by(Company.score_total.desc())

    companies = q.offset(offset).limit(limit).all()
    company_ids = [c.id for c in companies]
    last_info = _fetch_last_call_info(company_ids, current_user.org_id, db)

    result = []
    for c in companies:
        info = last_info.get(c.id, {})
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
            "last_called_at": info.get("last_called_at"),
            "last_call_result": info.get("last_call_result"),
            "pending_callback": (
                info.get("callback_at") is not None
                and info.get("callback_at") > datetime.utcnow()
            ),
            "callback_at": info.get("callback_at"),
        })
    return {"companies": result, "total": total}


# ─── POST /logs (E1: callback_at, call_duration) ─────────────────────────────
class CallLogCreate(BaseModel):
    company_id: int
    result: str
    note: Optional[str] = None
    call_duration: Optional[int] = None
    callback_at: Optional[datetime] = None


@router.post("/logs")
def create_call_log(
    payload: CallLogCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.result not in VALID_RESULTS:
        raise HTTPException(status_code=422, detail="無効な架電結果です")
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
        call_duration=payload.call_duration,
        callback_at=payload.callback_at,
    )
    db.add(log)

    if payload.result == "商談決定" and co.status in ("未確認", "対象候補", "アプローチ前"):
        co.status = "商談中"
    elif payload.result == "興味あり" and co.status in ("未確認", "対象候補"):
        co.status = "アプローチ済"

    db.commit()
    db.refresh(log)
    return {
        "id": log.id,
        "called_at": log.called_at,
        "result": log.result,
        "callback_at": log.callback_at,
    }


# ─── GET /logs ────────────────────────────────────────────────────────────────
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

    company_ids = list({l.company_id for l in logs})
    caller_ids = list({l.called_by for l in logs})
    co_map = {
        c.id: c.company_name
        for c in db.query(Company).filter(Company.id.in_(company_ids)).all()
    } if company_ids else {}
    user_map = {
        u.id: (u.display_name or u.email)
        for u in db.query(User).filter(User.id.in_(caller_ids)).all()
    } if caller_ids else {}

    result = []
    for log in logs:
        result.append({
            "id": log.id,
            "company_id": log.company_id,
            "company_name": co_map.get(log.company_id, ""),
            "caller_name": user_map.get(log.called_by, ""),
            "called_at": log.called_at,
            "result": log.result,
            "note": log.note,
            "call_duration": log.call_duration,
            "callback_at": log.callback_at,
        })
    return {"logs": result}


# ─── DELETE /logs/{log_id} ────────────────────────────────────────────────────
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


# ─── GET /stats (O6: days param, daily breakdown) ────────────────────────────
@router.get("/stats")
def get_call_stats(
    days: int = 1,
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
    connected = sum(1 for l in today_logs if l.result in CONNECTED_RESULTS)
    appointments = sum(1 for l in today_logs if l.result in APPOINTMENT_RESULTS)

    daily = []
    if days > 1:
        for i in range(days - 1, -1, -1):
            d = today - timedelta(days=i)
            rows = (
                db.query(CallLog)
                .filter(
                    CallLog.org_id == current_user.org_id,
                    sqlfunc.date(CallLog.called_at) == d,
                )
                .all()
            )
            conn_d = sum(1 for l in rows if l.result in CONNECTED_RESULTS)
            apo_d = sum(1 for l in rows if l.result in APPOINTMENT_RESULTS)
            daily.append({
                "date": d.isoformat(),
                "label": f"{d.month}/{d.day}",
                "total": len(rows),
                "connected": conn_d,
                "appointments": apo_d,
                "connect_rate": round(conn_d / len(rows) * 100) if rows else 0,
            })

    return {
        "total_today": total_today,
        "connected": connected,
        "connect_rate": round(connected / total_today * 100) if total_today > 0 else 0,
        "appointments": appointments,
        "appointment_rate": round(appointments / connected * 100) if connected > 0 else 0,
        "daily": daily,
    }


# ─── E1: GET /callbacks — 折り返し予定一覧 ────────────────────────────────────
@router.get("/callbacks")
def list_pending_callbacks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    now = datetime.utcnow()
    owned_pids = _owned_projects(current_user, db)
    logs = (
        db.query(CallLog)
        .filter(
            CallLog.org_id == current_user.org_id,
            CallLog.callback_at.isnot(None),
            CallLog.callback_at >= now - timedelta(days=1),
        )
        .order_by(CallLog.callback_at.asc())
        .limit(50)
        .all()
    )
    company_ids = list({l.company_id for l in logs})
    co_map = {
        c.id: c
        for c in db.query(Company).filter(
            Company.id.in_(company_ids),
            Company.project_id.in_(owned_pids),
        ).all()
    } if company_ids else {}

    result = []
    for log in logs:
        co = co_map.get(log.company_id)
        if not co:
            continue
        result.append({
            "log_id": log.id,
            "company_id": log.company_id,
            "company_name": co.company_name,
            "phone": co.phone,
            "score_rank": co.score_rank,
            "callback_at": log.callback_at,
            "is_overdue": log.callback_at < now,
            "note": log.note,
        })
    return {"callbacks": result, "total": len(result)}


# ─── E3: GET /team-stats — チーム架電統計 (管理者以上) ───────────────────────
@router.get("/team-stats")
def get_team_stats(
    days: int = 7,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role not in ("admin", "system_admin") and not current_user.is_system_admin:
        raise HTTPException(status_code=403, detail="管理者権限が必要です")
    since = datetime.utcnow() - timedelta(days=days)
    logs = (
        db.query(CallLog)
        .filter(
            CallLog.org_id == current_user.org_id,
            CallLog.called_at >= since,
        )
        .all()
    )
    user_ids = list({l.called_by for l in logs})
    user_map = {
        u.id: (u.display_name or u.email)
        for u in db.query(User).filter(User.id.in_(user_ids)).all()
    } if user_ids else {}

    stats: dict[int, dict] = {}
    for log in logs:
        uid = log.called_by
        if uid not in stats:
            stats[uid] = {
                "user_id": uid,
                "name": user_map.get(uid, f"User#{uid}"),
                "total": 0,
                "connected": 0,
                "appointments": 0,
                "avg_duration": 0,
                "_durations": [],
            }
        s = stats[uid]
        s["total"] += 1
        if log.result in CONNECTED_RESULTS:
            s["connected"] += 1
        if log.result in APPOINTMENT_RESULTS:
            s["appointments"] += 1
        if log.call_duration:
            s["_durations"].append(log.call_duration)

    rows = []
    for s in stats.values():
        durs = s.pop("_durations")
        s["avg_duration"] = round(sum(durs) / len(durs)) if durs else 0
        s["connect_rate"] = round(s["connected"] / s["total"] * 100) if s["total"] else 0
        s["appointment_rate"] = round(s["appointments"] / s["connected"] * 100) if s["connected"] else 0
        rows.append(s)

    rows.sort(key=lambda x: x["appointments"], reverse=True)
    return {"members": rows, "days": days}


# ─── E4: GET/POST /script-templates — スクリプトテンプレ保存/取得 ─────────────
SCRIPT_TEMPLATE_KEY = "tele_apo_script_template"


@router.get("/script-templates")
def get_script_template(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = db.query(AppSetting).filter(
        AppSetting.setting_key == SCRIPT_TEMPLATE_KEY,
        AppSetting.org_id == current_user.org_id,
    ).first()
    return {"template": row.setting_value if row else ""}


class ScriptTemplateBody(BaseModel):
    template: str


@router.post("/script-templates")
def save_script_template(
    payload: ScriptTemplateBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = db.query(AppSetting).filter(
        AppSetting.setting_key == SCRIPT_TEMPLATE_KEY,
        AppSetting.org_id == current_user.org_id,
    ).first()
    if row:
        row.setting_value = payload.template
    else:
        row = AppSetting(
            org_id=current_user.org_id,
            setting_key=SCRIPT_TEMPLATE_KEY,
            setting_value=payload.template,
        )
        db.add(row)
    db.commit()
    return {"saved": True}


# ─── E6: GET /export.csv — 架電ログCSV出力 ───────────────────────────────────
@router.get("/export.csv")
def export_call_logs_csv(
    days: int = 30,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    since = datetime.utcnow() - timedelta(days=days)
    logs = (
        db.query(CallLog)
        .filter(
            CallLog.org_id == current_user.org_id,
            CallLog.called_at >= since,
        )
        .order_by(CallLog.called_at.desc())
        .limit(5000)
        .all()
    )
    company_ids = list({l.company_id for l in logs})
    caller_ids = list({l.called_by for l in logs})
    co_map = {
        c.id: c
        for c in db.query(Company).filter(Company.id.in_(company_ids)).all()
    } if company_ids else {}
    user_map = {
        u.id: (u.display_name or u.email)
        for u in db.query(User).filter(User.id.in_(caller_ids)).all()
    } if caller_ids else {}

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["架電日時", "会社名", "電話番号", "担当者", "結果", "通話時間(秒)", "折り返し予定", "メモ"])
    for log in logs:
        co = co_map.get(log.company_id)
        writer.writerow([
            log.called_at.strftime("%Y/%m/%d %H:%M") if log.called_at else "",
            co.company_name if co else "",
            co.phone if co else "",
            user_map.get(log.called_by, ""),
            log.result,
            log.call_duration or "",
            log.callback_at.strftime("%Y/%m/%d %H:%M") if log.callback_at else "",
            log.note or "",
        ])
    output.seek(0)
    filename = f"call_logs_{date.today().isoformat()}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8-sig",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ─── E8: GET /insights — 架電ベストタイム分析 ────────────────────────────────
@router.get("/insights")
def get_call_insights(
    days: int = 30,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    since = datetime.utcnow() - timedelta(days=days)
    logs = (
        db.query(CallLog)
        .filter(
            CallLog.org_id == current_user.org_id,
            CallLog.called_at >= since,
        )
        .all()
    )
    HOUR_LABELS = {h: f"{h}時" for h in range(7, 22)}
    DOW_LABELS = ["月", "火", "水", "木", "金", "土", "日"]

    hour_stats: dict[int, dict] = {}
    dow_stats: dict[int, dict] = {}

    for log in logs:
        if not log.called_at:
            continue
        h = log.called_at.hour
        w = log.called_at.weekday()
        for bucket, key in [(hour_stats, h), (dow_stats, w)]:
            if key not in bucket:
                bucket[key] = {"total": 0, "connected": 0, "appointments": 0}
            bucket[key]["total"] += 1
            if log.result in CONNECTED_RESULTS:
                bucket[key]["connected"] += 1
            if log.result in APPOINTMENT_RESULTS:
                bucket[key]["appointments"] += 1

    def _build_rows(stats: dict, labels: dict) -> list[dict]:
        rows = []
        for k, v in sorted(stats.items()):
            rows.append({
                "key": k,
                "label": labels.get(k, str(k)),
                "total": v["total"],
                "connected": v["connected"],
                "appointments": v["appointments"],
                "connect_rate": round(v["connected"] / v["total"] * 100) if v["total"] else 0,
                "appointment_rate": round(v["appointments"] / v["connected"] * 100) if v["connected"] else 0,
            })
        return rows

    hour_rows = _build_rows(hour_stats, HOUR_LABELS)
    dow_rows = _build_rows(dow_stats, {i: l for i, l in enumerate(DOW_LABELS)})

    best_hour = max(hour_rows, key=lambda x: x["connect_rate"], default=None)
    best_dow = max(dow_rows, key=lambda x: x["connect_rate"], default=None)

    return {
        "days": days,
        "total_logs": len(logs),
        "by_hour": hour_rows,
        "by_dow": dow_rows,
        "best_hour": best_hour,
        "best_dow": best_dow,
    }


# ─── POST /script — AIトークスクリプト生成 ───────────────────────────────────
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
            co.ai_summary.get("summary")
            or co.ai_summary.get("description")
            or str(co.ai_summary)[:300]
        )

    custom_template = ""
    tmpl_row = db.query(AppSetting).filter(
        AppSetting.setting_key == SCRIPT_TEMPLATE_KEY,
        AppSetting.org_id == current_user.org_id,
    ).first()
    if tmpl_row and tmpl_row.setting_value:
        custom_template = tmpl_row.setting_value

    try:
        from server.services.ai_writer import _resolve_anthropic_key
        import anthropic

        api_key = _resolve_anthropic_key()
        name_addr = f"{co.contact_title or ''}の{co.contact_name}様" if co.contact_name else "ご担当者様"
        template_hint = f"\n\n## カスタムテンプレート（参考にしてください）\n{custom_template}" if custom_template else ""
        prompt = f"""あなたはB2B営業のプロです。以下の企業に対するテレアポトークスクリプトを日本語で作成してください。

## 相手企業情報
- 会社名: {co.company_name or "不明"}
- 業種: {co.category_main or "不明"}
- 都道府県: {co.prefecture or "不明"}
- 担当者: {name_addr}
{f"- サイト概要: {ai_summary_text}" if ai_summary_text else ""}
{template_hint}

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
