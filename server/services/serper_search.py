import requests
import logging
from typing import Optional

logger = logging.getLogger(__name__)


def search_serper(api_key: str, query: str, num: int = 10) -> list[dict]:
    try:
        results = []
        pages_needed = max(1, (num + 9) // 10)
        for page in range(1, pages_needed + 1):
            resp = requests.post(
                "https://google.serper.dev/search",
                headers={
                    "X-API-KEY": api_key,
                    "Content-Type": "application/json",
                },
                json={
                    "q": query,
                    "gl": "jp",
                    "hl": "ja",
                    "num": 10,
                    "page": page,
                },
                timeout=15,
            )
            if resp.status_code != 200:
                if page == 1:
                    return [{"error": f"Serper APIエラー: HTTP {resp.status_code}"}]
                break

            data = resp.json()
            page_results = data.get("organic", [])
            if not page_results:
                break

            for item in page_results:
                results.append({
                    "url": item.get("link", ""),
                    "title": item.get("title", ""),
                    "snippet": item.get("snippet", ""),
                })
            if len(results) >= num:
                break

        return results[:num] if results else [{"error": "検索結果が0件でした"}]
    except Exception as e:
        logger.error(f"Serper search error: {e}")
        return [{"error": str(e)}]


def get_serper_api_key() -> Optional[str]:
    import os
    key = os.environ.get("SERPER_API_KEY", "")
    if key:
        return key

    try:
        from server.database import SessionLocal
        from server.models import SystemSettings
        db = SessionLocal()
        try:
            from server.services.encryption import decrypt_value
            row = db.query(SystemSettings).filter(SystemSettings.key == "serper_api_key").first()
            if row and row.value:
                return decrypt_value(row.value)
        finally:
            db.close()
    except Exception:
        pass

    return None
