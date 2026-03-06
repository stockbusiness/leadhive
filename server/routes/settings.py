from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from server.database import get_db
from server.models import AppSetting

router = APIRouter(prefix="/api/settings", tags=["settings"])

SETTING_KEYS = ["google_api_key", "google_cx", "auto_collect_enabled", "auto_collect_time"]


def mask_value(key: str, value: str) -> str:
    if not value:
        return ""
    if "api_key" in key or "secret" in key:
        if len(value) <= 8:
            return "****"
        return value[:4] + "*" * (len(value) - 8) + value[-4:]
    return value


@router.get("")
def get_settings(db: Session = Depends(get_db)):
    settings = db.query(AppSetting).filter(AppSetting.setting_key.in_(SETTING_KEYS)).all()
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
def update_settings(data: dict, db: Session = Depends(get_db)):
    updated = []
    for key, value in data.items():
        if key not in SETTING_KEYS:
            continue
        setting = db.query(AppSetting).filter(AppSetting.setting_key == key).first()
        if setting:
            setting.setting_value = value
        else:
            setting = AppSetting(setting_key=key, setting_value=value)
            db.add(setting)
        updated.append(key)
    db.commit()
    return {"message": "設定を保存しました", "updated": updated}


@router.get("/scheduler")
def get_scheduler_status():
    from server.services.scheduler import get_scheduler_status
    return get_scheduler_status()


@router.post("/test")
def test_connection(db: Session = Depends(get_db)):
    import requests

    api_key_setting = db.query(AppSetting).filter(AppSetting.setting_key == "google_api_key").first()
    cx_setting = db.query(AppSetting).filter(AppSetting.setting_key == "google_cx").first()

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
