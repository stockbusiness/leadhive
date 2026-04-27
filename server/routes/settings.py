from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from server.database import get_db
from server.models import AppSetting, User
from server.auth import get_current_user, require_admin
from server.services.encryption import encrypt_value, decrypt_value, should_encrypt

router = APIRouter(prefix="/api/settings", tags=["settings"])

SETTING_KEYS = [
    "auto_collect_enabled", "auto_collect_time",
    "google_places_api_key", "slack_webhook_url",
    "smtp_host", "smtp_port", "smtp_user", "smtp_password",
    "smtp_from_email", "smtp_from_name", "smtp_use_tls",
    "followup_notify_enabled", "followup_notify_channel",
    "openai_api_key", "auto_enrich_enabled",
    "sendgrid_api_key", "sendgrid_from_email", "sendgrid_from_name",
    "serper_api_key",
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
        raw = decrypt_value(s.setting_value or "")
        result[s.setting_key] = {
            "value": mask_value(s.setting_key, raw),
            "is_set": bool(s.setting_value),
        }
    for key in SETTING_KEYS:
        if key not in result:
            result[key] = {"value": "", "is_set": False}
    return {"settings": result}


@router.put("")
def update_settings(
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if "slack_webhook_url" in data and data["slack_webhook_url"]:
        from server.routes.plans import check_slack_allowed
        check_slack_allowed(current_user.org_id, db)
    updated = []
    for key, value in data.items():
        if key not in SETTING_KEYS:
            continue
        store_value = encrypt_value(value) if should_encrypt(key) and value else value
        setting = db.query(AppSetting).filter(
            AppSetting.setting_key == key,
            AppSetting.org_id == current_user.org_id,
        ).first()
        if setting:
            setting.setting_value = store_value
        else:
            setting = AppSetting(setting_key=key, setting_value=store_value, org_id=current_user.org_id)
            db.add(setting)
        updated.append(key)
    db.commit()
    return {"message": "設定を保存しました", "updated": updated}


@router.get("/setup-status")
def get_setup_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from server.models import SearchKeyword, Company, Project

    def is_set(key: str) -> bool:
        row = db.query(AppSetting).filter(
            AppSetting.setting_key == key,
            AppSetting.org_id == current_user.org_id,
        ).first()
        return bool(row and row.setting_value)

    has_smtp = is_set("smtp_host")
    has_sendgrid = is_set("sendgrid_api_key")
    has_serper = is_set("serper_api_key")
    project_ids = [p.id for p in db.query(Project.id).filter(Project.org_id == current_user.org_id).all()]
    keyword_count = db.query(SearchKeyword).filter(SearchKeyword.project_id.in_(project_ids)).count() if project_ids else 0
    company_count = db.query(Company).filter(Company.project_id.in_(project_ids)).count() if project_ids else 0

    return {
        "has_serper_api_key": has_serper,
        "has_email_config": has_smtp or has_sendgrid,
        "keyword_count": keyword_count,
        "company_count": company_count,
    }


@router.get("/scheduler")
def get_scheduler_status(current_user: User = Depends(get_current_user)):
    from server.services.scheduler import get_scheduler_status
    return get_scheduler_status()


@router.post("/slack-test")
def test_slack(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    from server.routes.plans import check_slack_allowed
    check_slack_allowed(current_user.org_id, db)
    from server.services.slack import send_slack_notification
    webhook = db.query(AppSetting).filter(
        AppSetting.setting_key == "slack_webhook_url",
        AppSetting.org_id == current_user.org_id,
    ).first()
    if not webhook or not webhook.setting_value:
        return {"success": False, "message": "Slack Webhook URLが設定されていません"}
    webhook_url = decrypt_value(webhook.setting_value)
    ok = send_slack_notification("🔔 LeadHiveからのテスト通知です。Slack連携が正常に動作しています！", webhook_url)
    if ok:
        return {"success": True, "message": "Slack通知を送信しました"}
    return {"success": False, "message": "送信に失敗しました。Webhook URLを確認してください"}


@router.post("/smtp-test")
def test_smtp(
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    from server.services.mailer import get_smtp_settings, send_email
    # DBから設定を読み込み、リクエストで送られたフォーム値で上書き（保存前でもテスト可能）
    smtp_cfg = get_smtp_settings(db, current_user.org_id)
    override_keys = ["smtp_host", "smtp_port", "smtp_user", "smtp_password",
                     "smtp_from_email", "smtp_from_name", "smtp_use_tls"]
    for key in override_keys:
        val = data.get(key)
        if val is not None and str(val).strip():
            smtp_cfg[key] = str(val).strip()
    test_to = data.get("test_to") or current_user.email
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
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    from server.services.serper_search import get_serper_api_key, search_serper
    serper_key = get_serper_api_key(db=db, org_id=current_user.org_id)
    if not serper_key:
        return {"success": False, "message": "Serper APIキーが設定されていません。設定画面で登録してください。"}
    try:
        results = search_serper(serper_key, "test", num=1)
        if results is not None:
            return {"success": True, "message": "Serper API 接続成功！"}
        return {"success": False, "message": "Serper APIから応答がありません"}
    except Exception as e:
        return {"success": False, "message": f"接続エラー: {str(e)}"}


@router.post("/sendgrid-test")
def test_sendgrid(
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    from server.services.mailer import get_sendgrid_settings, send_via_sendgrid
    cfg = get_sendgrid_settings(db, current_user.org_id)
    if not cfg["api_key"]:
        return {"success": False, "message": "SendGrid APIキーが設定されていません"}
    test_to = data.get("test_to") or current_user.email
    ok, msg = send_via_sendgrid(
        to=test_to,
        subject="LeadHive SendGrid テストメール",
        html_body="<p>LeadHiveからのテストメールです。SendGrid設定が正常に動作しています。</p>",
        api_key=cfg["api_key"],
        from_email=cfg["from_email"],
        from_name=cfg["from_name"],
        text_body="LeadHiveからのテストメールです。SendGrid設定が正常に動作しています。",
    )
    return {"success": ok, "message": msg}
