import requests
from datetime import date
from sqlalchemy.orm import Session
from server.models import ApiUsageLog


def increment_api_usage(db: Session):
    today = date.today()
    log = db.query(ApiUsageLog).filter(ApiUsageLog.usage_date == today).first()
    if log:
        log.request_count += 1
    else:
        log = ApiUsageLog(usage_date=today, request_count=1)
        db.add(log)
    db.commit()


def get_api_usage_today(db: Session) -> int:
    today = date.today()
    log = db.query(ApiUsageLog).filter(ApiUsageLog.usage_date == today).first()
    return log.request_count if log else 0


def search_google(api_key: str, cx: str, query: str, db: Session, num: int = 10, start: int = 1) -> list[dict]:
    try:
        increment_api_usage(db)

        resp = requests.get(
            "https://www.googleapis.com/customsearch/v1",
            params={
                "key": api_key,
                "cx": cx,
                "q": query,
                "num": min(num, 10),
                "start": start,
                "lr": "lang_ja",
                "gl": "jp",
            },
            timeout=15,
        )
        if resp.status_code != 200:
            error_msg = resp.json().get("error", {}).get("message", "Unknown error")
            return [{"error": error_msg}]

        data = resp.json()
        results = []
        for item in data.get("items", []):
            results.append({
                "url": item.get("link", ""),
                "title": item.get("title", ""),
                "snippet": item.get("snippet", ""),
            })
        return results
    except Exception as e:
        return [{"error": str(e)}]
