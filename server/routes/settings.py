from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from server.database import get_db
from server.models import AppSetting, User
from server.auth import get_current_user

router = APIRouter(prefix="/api/settings", tags=["settings"])

SETTING_KEYS = [
    "google_api_key", "google_cx", "auto_collect_enabled", "auto_collect_time",
    "google_places_api_key", "slack_webhook_url",
    "smtp_host", "smtp_port", "smtp_user", "smtp_password",
    "smtp_from_email", "smtp_from_name", "smtp_use_tls",
    "followup_notify_enabled", "followup_notify_channel",
    "openai_api_key", "auto_enrich_enabled",
]

MASKED_KEYS = {"api_key", "secret", "webhook", "password", "token"}


def mask_value(key: str, value: str) -> str:
    if not value:
        return ""
    if any(k in key for k in MASKED_KEYS):
        if len(value) <= 8:
            return "****"
        return value[:4] + "*" * (len(value) - 8) + value[-4:]
    return value


@router.get("")
def get_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    settings = db.query(AppSetting).filter(
        AppSetting.setting_key.in_(SETTING_KEYS),
        AppSetting.org_id == current_user.org_id,
    ).all()
    result = {}
    for s in settings:
        result[s.setting_key] = {
            "value": mask_value(s.setting_key, s.setting_value or ""),
            "is_set": bool(s.setting_value),
        }
    for key in SETTING_KEYS:
        if key not in result:
            result[key] = {"value": "", "is_set": False}
    return {"settings": result}


@router.put("")
def update_settings(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    updated = []
    for key, value in data.items():
        if key not in SETTING_KEYS:
            continue
        setting = db.query(AppSetting).filter(
            AppSetting.setting_key == key,
            AppSetting.org_id == current_user.org_id,
        ).first()
        if setting:
            setting.setting_value = value
        else:
            setting = AppSetting(setting_key=key, setting_value=value, org_id=current_user.org_id)
            db.add(setting)
        updated.append(key)
    db.commit()
    return {"message": "設定を保存しました", "updated": updated}


@router.get("/scheduler")
def get_scheduler_status(current_user: User = Depends(get_current_user)):
    from server.services.scheduler import get_scheduler_status
    return get_scheduler_status()


@router.post("/slack-test")
def test_slack(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from server.services.slack import send_slack_notification
    webhook = db.query(AppSetting).filter(
        AppSetting.setting_key == "slack_webhook_url",
        AppSetting.org_id == current_user.org_id,
    ).first()
    if not webhook or not webhook.setting_value:
        return {"success": False, "message": "Slack Webhook URLが設定されていません"}
    ok = send_slack_notification("🔔 LeadHiveからのテスト通知です。Slack連携が正常に動作しています！", webhook.setting_value)
    if ok:
        return {"success": True, "message": "Slack通知を送信しました"}
    return {"success": False, "message": "送信に失敗しました。Webhook URLを確認してください"}


@router.post("/smtp-test")
def test_smtp(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from server.services.mailer import get_smtp_settings, send_email
    smtp_cfg = get_smtp_settings(db, current_user.org_id)
    test_to = data.get("test_to", current_user.email)
    ok, msg = send_email(
        to=test_to,
        subject="LeadHiveテストメール",
        html_body="<p>LeadHiveからのテストメールです。SMTP設定が正常に動作しています。</p>",
        smtp_settings=smtp_cfg,
        text_body="LeadHiveからのテストメールです。SMTP設定が正常に動作しています。",
    )
    return {"success": ok, "message": msg}


@router.post("/test")
def test_connection(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    import requests

    api_key_setting = db.query(AppSetting).filter(
        AppSetting.setting_key == "google_api_key",
        AppSetting.org_id == current_user.org_id,
    ).first()
    cx_setting = db.query(AppSetting).filter(
        AppSetting.setting_key == "google_cx",
        AppSetting.org_id == current_user.org_id,
    ).first()

    if not api_key_setting or not api_key_setting.setting_value:
        return {"success": False, "message": "Google API Keyが設定されていません"}
    if not cx_setting or not cx_setting.setting_value:
        return {"success": False, "message": "Search Engine ID (cx)が設定されていません"}

    try:
        resp = requests.get(
            "https://www.googleapis.com/customsearch/v1",
            params={
                "key": api_key_setting.setting_value,
                "cx": cx_setting.setting_value,
                "q": "test",
                "num": 1,
            },
            timeout=10,
        )
        if resp.status_code == 200:
            return {"success": True, "message": "接続成功！APIが正常に動作しています"}
        else:
            error_msg = resp.json().get("error", {}).get("message", resp.text[:200])
            return {"success": False, "message": f"APIエラー: {error_msg}"}
    except Exception as e:
        return {"success": False, "message": f"接続エラー: {str(e)}"}
