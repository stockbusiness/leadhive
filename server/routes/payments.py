import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta, date
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session
from sqlalchemy import func as sa_func, desc
from pydantic import BaseModel
from server.database import get_db
from server.models import SystemSettings, Plan, Organization, User, Company, Project, SystemLog, Announcement, CollectionLog, ApiUsageLog
from server.auth import get_current_user, require_admin

router = APIRouter(tags=["payments"])

STRIPE_SETTINGS_KEYS = [
    "stripe_secret_key",
    "stripe_publishable_key",
    "stripe_webhook_secret",
    "stripe_mode",
]


def get_setting(db: Session, key: str) -> Optional[str]:
    row = db.query(SystemSettings).filter(SystemSettings.key == key).first()
    return row.value if row else None


def set_setting(db: Session, key: str, value: Optional[str]):
    row = db.query(SystemSettings).filter(SystemSettings.key == key).first()
    if row:
        row.value = value
    else:
        db.add(SystemSettings(key=key, value=value))


def get_stripe_client(db: Session):
    import stripe as stripe_lib
    secret_key = get_setting(db, "stripe_secret_key")
    if not secret_key:
        raise HTTPException(status_code=503, detail="Stripeが設定されていません。管理画面でAPIキーを設定してください。")
    stripe_lib.api_key = secret_key
    return stripe_lib


# ──────────────────────────────────────────────────────────────
#  Admin: Stripe 設定 CRUD
# ──────────────────────────────────────────────────────────────

@router.get("/api/admin/stripe-settings")
def get_stripe_settings(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    data = {}
    for key in STRIPE_SETTINGS_KEYS:
        value = get_setting(db, key)
        if key == "stripe_secret_key" and value:
            masked = value[:7] + "••••••••" + value[-4:] if len(value) > 11 else "••••••••••••"
            data[key] = masked
            data["stripe_secret_key_set"] = True
        elif key == "stripe_webhook_secret" and value:
            masked = value[:6] + "••••••••" + value[-4:] if len(value) > 10 else "••••••••••••"
            data[key] = masked
            data["stripe_webhook_secret_set"] = True
        else:
            data[key] = value
    return data


class StripeSettingsBody(BaseModel):
    stripe_secret_key: Optional[str] = None
    stripe_publishable_key: Optional[str] = None
    stripe_webhook_secret: Optional[str] = None
    stripe_mode: Optional[str] = None


@router.put("/api/admin/stripe-settings")
def update_stripe_settings(
    body: StripeSettingsBody,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    updates = body.model_dump(exclude_none=True)
    for key, value in updates.items():
        if key in STRIPE_SETTINGS_KEYS:
            if "••••" not in str(value):
                set_setting(db, key, value if value else None)
    db.commit()
    return {"success": True}


# ──────────────────────────────────────────────────────────────
#  Stripe 接続テスト
# ──────────────────────────────────────────────────────────────

@router.post("/api/admin/stripe-settings/test")
def test_stripe_connection(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    try:
        stripe = get_stripe_client(db)
        account = stripe.Account.retrieve()
        return {"success": True, "account_id": account.id, "display_name": account.get("display_name") or account.id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ──────────────────────────────────────────────────────────────
#  Admin: システムAPI設定（gBizINFO等）
# ──────────────────────────────────────────────────────────────

SYSTEM_API_KEYS = ["gbizinfo_api_token"]


@router.get("/api/admin/api-settings")
def get_api_settings(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    data = {}
    for key in SYSTEM_API_KEYS:
        value = get_setting(db, key)
        if value:
            masked = value[:4] + "••••••••" + value[-4:] if len(value) > 8 else "••••••••"
            data[key] = masked
            data[f"{key}_set"] = True
        else:
            data[key] = ""
            data[f"{key}_set"] = False
    return data


@router.put("/api/admin/api-settings")
def update_api_settings(
    payload: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    updated = []
    for key in SYSTEM_API_KEYS:
        if key in payload and payload[key] and "••" not in payload[key]:
            set_setting(db, key, payload[key])
            updated.append(key)
    db.commit()
    return {"message": "設定を保存しました", "updated": updated}


# ──────────────────────────────────────────────────────────────
#  Checkout Session 作成
# ──────────────────────────────────────────────────────────────

class CheckoutBody(BaseModel):
    plan_id: int
    success_url: str
    cancel_url: str


@router.post("/api/payments/checkout")
def create_checkout_session(
    body: CheckoutBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plan = db.query(Plan).filter(Plan.id == body.plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="プランが見つかりません")
    if not plan.stripe_price_id:
        raise HTTPException(status_code=400, detail=f"プラン「{plan.name}」にStripe Price IDが設定されていません。管理者に連絡してください。")

    stripe = get_stripe_client(db)
    try:
        session = stripe.checkout.Session.create(
            mode="subscription",
            line_items=[{"price": plan.stripe_price_id, "quantity": 1}],
            success_url=body.success_url + "?session_id={CHECKOUT_SESSION_ID}",
            cancel_url=body.cancel_url,
            metadata={
                "org_id": str(current_user.org_id),
                "plan_id": str(plan.id),
                "user_id": str(current_user.id),
            },
            customer_email=current_user.email,
        )
        return {"url": session.url, "session_id": session.id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ──────────────────────────────────────────────────────────────
#  Webhook
# ──────────────────────────────────────────────────────────────

@router.post("/api/payments/webhook")
async def stripe_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    import stripe as stripe_lib
    secret_key = get_setting(db, "stripe_secret_key")
    if not secret_key:
        raise HTTPException(status_code=503, detail="Stripe not configured")
    stripe_lib.api_key = secret_key
    webhook_secret = get_setting(db, "stripe_webhook_secret")

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        if webhook_secret:
            event = stripe_lib.Webhook.construct_event(payload, sig_header, webhook_secret)
        else:
            import json
            event = json.loads(payload)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        metadata = session.get("metadata", {})
        org_id = metadata.get("org_id")
        plan_id = metadata.get("plan_id")
        if org_id and plan_id:
            org = db.query(Organization).filter(Organization.id == int(org_id)).first()
            if org:
                org.plan_id = int(plan_id)
                db.commit()

    return {"received": True}


class TenantUpdateBody(BaseModel):
    plan_id: Optional[int] = None
    name: Optional[str] = None


@router.get("/api/admin/tenants")
def list_tenants(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    orgs = db.query(Organization).order_by(Organization.id).all()
    plans = {p.id: p for p in db.query(Plan).all()}
    result = []
    for org in orgs:
        member_count = db.query(User).filter(User.org_id == org.id).count()
        project_count = db.query(Project).filter(Project.org_id == org.id).count()
        company_count = (
            db.query(Company)
            .join(Project, Company.project_id == Project.id)
            .filter(Project.org_id == org.id)
            .count()
        )
        plan = plans.get(org.plan_id) if org.plan_id else None
        result.append({
            "id": org.id,
            "name": org.name,
            "plan_id": org.plan_id,
            "plan_name": plan.name if plan else None,
            "member_count": member_count,
            "company_count": company_count,
            "project_count": project_count,
            "created_at": org.created_at.isoformat() if org.created_at else None,
        })
    return {"tenants": result}


@router.patch("/api/admin/tenants/{org_id}")
def update_tenant(
    org_id: int,
    body: TenantUpdateBody,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    if body.plan_id is not None:
        plan = db.query(Plan).filter(Plan.id == body.plan_id).first()
        if not plan:
            raise HTTPException(status_code=404, detail="Plan not found")
        org.plan_id = body.plan_id
    if body.name is not None:
        org.name = body.name
    db.commit()
    db.refresh(org)
    return {"id": org.id, "name": org.name, "plan_id": org.plan_id}


# ──────────────────────────────────────────────────────────────
#  Helper: System Log
# ──────────────────────────────────────────────────────────────
def write_system_log(db: Session, action: str, actor_email: str = "", actor_org: str = "", target: str = "", detail: str = ""):
    db.add(SystemLog(action=action, actor_email=actor_email, actor_org=actor_org, target=target, detail=detail))
    db.commit()


# ──────────────────────────────────────────────────────────────
#  Admin: Dashboard
# ──────────────────────────────────────────────────────────────
@router.get("/api/admin/dashboard")
def admin_dashboard(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    org_count = db.query(Organization).count()
    user_count = db.query(User).count()
    project_count = db.query(Project).count()
    company_count = db.query(Company).count()

    today = date.today()
    month_start = today.replace(day=1)
    month_collections = (
        db.query(sa_func.sum(CollectionLog.success_count))
        .filter(sa_func.date(CollectionLog.created_at) >= month_start)
        .scalar() or 0
    )

    today_api = db.query(ApiUsageLog).filter(ApiUsageLog.usage_date == today).first()
    today_api_count = today_api.request_count if today_api else 0

    # 過去7日の日別収集件数
    daily_collections = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        count = (
            db.query(sa_func.sum(CollectionLog.success_count))
            .filter(sa_func.date(CollectionLog.created_at) == d)
            .scalar() or 0
        )
        daily_collections.append({"date": d.strftime("%m/%d"), "count": int(count)})

    # プラン別テナント数
    plans = db.query(Plan).all()
    plan_dist = []
    for p in plans:
        cnt = db.query(Organization).filter(Organization.plan_id == p.id).count()
        if cnt > 0:
            plan_dist.append({"name": p.name, "count": cnt})
    unassigned = db.query(Organization).filter(Organization.plan_id == None).count()
    if unassigned > 0:
        plan_dist.append({"name": "未割当", "count": unassigned})

    return {
        "org_count": org_count,
        "user_count": user_count,
        "project_count": project_count,
        "company_count": company_count,
        "month_collections": int(month_collections),
        "today_api_count": today_api_count,
        "daily_collections": daily_collections,
        "plan_distribution": plan_dist,
    }


# ──────────────────────────────────────────────────────────────
#  Admin: All Users Management
# ──────────────────────────────────────────────────────────────
class UserRoleBody(BaseModel):
    role: str


@router.get("/api/admin/all-users")
def list_all_users(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
    search: str = Query(""),
    role: str = Query(""),
    org_id: Optional[int] = Query(None),
):
    q = db.query(User, Organization).join(Organization, User.org_id == Organization.id)
    if search:
        q = q.filter((User.email.ilike(f"%{search}%")) | (User.display_name.ilike(f"%{search}%")))
    if role:
        q = q.filter(User.role == role)
    if org_id:
        q = q.filter(User.org_id == org_id)
    rows = q.order_by(User.id).all()
    return {
        "users": [
            {
                "id": u.id,
                "email": u.email,
                "display_name": u.display_name,
                "role": u.role,
                "org_id": u.org_id,
                "org_name": o.name,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u, o in rows
        ]
    }


@router.patch("/api/admin/all-users/{user_id}")
def update_user_role(
    user_id: int,
    body: UserRoleBody,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if body.role not in ("member", "admin"):
        raise HTTPException(status_code=400, detail="role must be member or admin")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    old_role = user.role
    user.role = body.role
    db.commit()
    write_system_log(db, "user_role_change", current_user.email,
                     current_user.org_id and str(current_user.org_id) or "",
                     user.email, f"{old_role} → {body.role}")
    return {"id": user.id, "role": user.role}


@router.delete("/api/admin/all-users/{user_id}")
def delete_user_admin(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="自分自身は削除できません")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    email = user.email
    db.delete(user)
    db.commit()
    write_system_log(db, "user_delete", current_user.email, "", email, "管理者によるユーザー削除")
    return {"message": "deleted"}


# ──────────────────────────────────────────────────────────────
#  Admin: System Logs
# ──────────────────────────────────────────────────────────────
@router.get("/api/admin/logs")
def list_system_logs(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    limit: int = Query(50, le=200),
    action: str = Query(""),
    search: str = Query(""),
):
    q = db.query(SystemLog)
    if action:
        q = q.filter(SystemLog.action == action)
    if search:
        q = q.filter(
            SystemLog.actor_email.ilike(f"%{search}%") |
            SystemLog.target.ilike(f"%{search}%") |
            SystemLog.detail.ilike(f"%{search}%")
        )
    total = q.count()
    logs = q.order_by(desc(SystemLog.created_at)).offset((page - 1) * limit).limit(limit).all()
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "logs": [
            {
                "id": l.id,
                "action": l.action,
                "actor_email": l.actor_email,
                "actor_org": l.actor_org,
                "target": l.target,
                "detail": l.detail,
                "created_at": l.created_at.isoformat() if l.created_at else None,
            }
            for l in logs
        ],
    }


# ──────────────────────────────────────────────────────────────
#  Admin: Announcements
# ──────────────────────────────────────────────────────────────
class AnnouncementBody(BaseModel):
    title: str
    content: str
    target_org_id: Optional[int] = None
    is_active: bool = True


@router.get("/api/admin/announcements")
def list_announcements_admin(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    items = db.query(Announcement).order_by(desc(Announcement.created_at)).all()
    orgs = {o.id: o.name for o in db.query(Organization).all()}
    return {
        "announcements": [
            {
                "id": a.id,
                "title": a.title,
                "content": a.content,
                "target_org_id": a.target_org_id,
                "target_org_name": orgs.get(a.target_org_id) if a.target_org_id else None,
                "is_active": a.is_active,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in items
        ]
    }


@router.post("/api/admin/announcements")
def create_announcement(
    body: AnnouncementBody,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    a = Announcement(title=body.title, content=body.content, target_org_id=body.target_org_id, is_active=body.is_active)
    db.add(a)
    db.commit()
    db.refresh(a)
    return {"id": a.id}


@router.patch("/api/admin/announcements/{ann_id}")
def update_announcement(
    ann_id: int,
    body: AnnouncementBody,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    a = db.query(Announcement).filter(Announcement.id == ann_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Not found")
    a.title = body.title
    a.content = body.content
    a.target_org_id = body.target_org_id
    a.is_active = body.is_active
    db.commit()
    return {"id": a.id}


@router.delete("/api/admin/announcements/{ann_id}")
def delete_announcement(
    ann_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    a = db.query(Announcement).filter(Announcement.id == ann_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(a)
    db.commit()
    return {"message": "deleted"}


@router.get("/api/announcements")
def get_user_announcements(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    items = db.query(Announcement).filter(
        Announcement.is_active == True,
        (Announcement.target_org_id == None) | (Announcement.target_org_id == current_user.org_id)
    ).order_by(desc(Announcement.created_at)).all()
    return {
        "announcements": [
            {"id": a.id, "title": a.title, "content": a.content, "created_at": a.created_at.isoformat() if a.created_at else None}
            for a in items
        ]
    }


# ──────────────────────────────────────────────────────────────
#  Admin: Billing History
# ──────────────────────────────────────────────────────────────
@router.get("/api/admin/billing")
def get_billing_history(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    try:
        stripe_lib = get_stripe_client(db)
    except HTTPException:
        return {"configured": False, "charges": []}

    try:
        charges = stripe_lib.PaymentIntent.list(limit=100)
        orgs = {str(o.id): o.name for o in db.query(Organization).all()}
        result = []
        for c in charges.data:
            org_id = c.get("metadata", {}).get("org_id", "")
            result.append({
                "id": c.id,
                "amount": c.amount,
                "currency": c.currency,
                "status": c.status,
                "org_id": org_id,
                "org_name": orgs.get(org_id, "—"),
                "created_at": datetime.fromtimestamp(c.created).isoformat(),
            })
        total_success = sum(c["amount"] for c in result if c["status"] == "succeeded")
        return {
            "configured": True,
            "charges": result,
            "summary": {
                "total": total_success,
                "success_count": sum(1 for c in result if c["status"] == "succeeded"),
                "fail_count": sum(1 for c in result if c["status"] != "succeeded"),
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ──────────────────────────────────────────────────────────────
#  Admin: SMTP Settings
# ──────────────────────────────────────────────────────────────
SMTP_KEYS = ["smtp_host", "smtp_port", "smtp_user", "smtp_password", "smtp_from_email", "smtp_from_name"]


@router.get("/api/admin/smtp-settings")
def get_smtp_settings(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    data: dict = {}
    for key in SMTP_KEYS:
        val = get_setting(db, key)
        if key == "smtp_password" and val:
            data[key] = ""
            data["smtp_password_set"] = True
        else:
            data[key] = val or ""
    return data


class SmtpSettingsBody(BaseModel):
    smtp_host: Optional[str] = None
    smtp_port: Optional[str] = None
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from_email: Optional[str] = None
    smtp_from_name: Optional[str] = None


@router.put("/api/admin/smtp-settings")
def save_smtp_settings(
    body: SmtpSettingsBody,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    for key in SMTP_KEYS:
        val = getattr(body, key)
        if key == "smtp_password" and val == "":
            continue
        if val is not None:
            set_setting(db, key, val)
    db.commit()
    return {"message": "保存しました"}


@router.post("/api/admin/smtp-settings/test")
def test_smtp(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    host = get_setting(db, "smtp_host")
    port_str = get_setting(db, "smtp_port") or "587"
    user = get_setting(db, "smtp_user")
    password = get_setting(db, "smtp_password")
    from_email = get_setting(db, "smtp_from_email") or user
    from_name = get_setting(db, "smtp_from_name") or "LeadHive"

    if not host or not user or not password:
        raise HTTPException(status_code=400, detail="SMTP設定が不完全です")

    try:
        port = int(port_str)
        msg = MIMEMultipart()
        msg["From"] = f"{from_name} <{from_email}>"
        msg["To"] = current_user.email
        msg["Subject"] = "LeadHive SMTP テスト"
        msg.attach(MIMEText("LeadHive からのSMTPテストメールです。正常に受信できました。", "plain", "utf-8"))

        if port == 465:
            with smtplib.SMTP_SSL(host, port, timeout=10) as server:
                server.login(user, password)
                server.sendmail(from_email, current_user.email, msg.as_string())
        else:
            with smtplib.SMTP(host, port, timeout=10) as server:
                server.ehlo()
                server.starttls()
                server.login(user, password)
                server.sendmail(from_email, current_user.email, msg.as_string())
        return {"success": True, "message": f"{current_user.email} にテストメールを送信しました"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ──────────────────────────────────────────────────────────────
#  Admin: Feature Flags
# ──────────────────────────────────────────────────────────────
FEATURE_FLAGS = [
    "feature_ai_analysis",
    "feature_csv_export",
    "feature_master_db",
    "feature_gbizinfo",
    "feature_google_maps",
    "feature_slack_notify",
    "feature_self_upgrade",
]


@router.get("/api/admin/feature-flags")
def get_feature_flags(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    data = {}
    for key in FEATURE_FLAGS:
        val = get_setting(db, key)
        data[key] = val != "false"
    return data


class FeatureFlagsBody(BaseModel):
    flags: dict


@router.put("/api/admin/feature-flags")
def save_feature_flags(
    body: FeatureFlagsBody,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    for key in FEATURE_FLAGS:
        if key in body.flags:
            set_setting(db, key, "true" if body.flags[key] else "false")
    db.commit()
    return {"message": "保存しました"}
