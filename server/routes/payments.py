import os
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from server.database import get_db
from server.models import SystemSettings, Plan, Organization, User
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
