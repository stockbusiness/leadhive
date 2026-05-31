import requests
import logging
from typing import Optional

logger = logging.getLogger(__name__)


def search_serper(api_key: str, query: str, num: int = 10, start_page: int = 1) -> list[dict]:
    """Serper APIで検索する。
    numに応じてページングを自動制御する。
    Serperは1リクエストあたり最大100件（num=100）を返せる。
    100件を超える場合はページングで追加取得する。
    start_page: 開始ページ番号（継続収集時に使用）
    """
    try:
        results = []
        # 1リクエストで取得する件数（Serper上限100件）
        per_request = min(num, 100)
        page = max(1, start_page)

        while len(results) < num:
            remaining = num - len(results)
            batch_size = min(per_request, remaining, 100)

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
                    "num": batch_size,
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

            if len(page_results) < batch_size:
                break

            page += 1

        return results[:num] if results else [{"error": "検索結果が0件でした"}]
    except Exception as e:
        logger.error(f"Serper search error: {e}")
        return [{"error": str(e)}]


def get_serper_api_key(db=None, org_id: int = None) -> Optional[str]:
    import os
    from server.services.encryption import decrypt_value

    # 1. テナント設定（AppSetting）を優先確認
    if db and org_id:
        try:
            from server.models import AppSetting
            row = db.query(AppSetting).filter(
                AppSetting.org_id == org_id,
                AppSetting.setting_key == "serper_api_key",
            ).first()
            if row and row.setting_value:
                return decrypt_value(row.setting_value)
        except Exception:
            pass

    # 2. 環境変数（システム管理者のデフォルト）
    key = os.environ.get("SERPER_API_KEY", "")
    if key:
        return key

    # 3. SystemSettings テーブル（管理画面で設定したシステム共通キー）
    try:
        from server.database import SessionLocal
        from server.models import SystemSettings
        _db = SessionLocal()
        try:
            row = _db.query(SystemSettings).filter(SystemSettings.key == "serper_api_key").first()
            if row and row.value:
                return decrypt_value(row.value)
        finally:
            _db.close()
    except Exception:
        pass

    return None
