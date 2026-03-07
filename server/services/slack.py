import requests
import logging

logger = logging.getLogger(__name__)


def send_slack_notification(message: str, webhook_url: str) -> bool:
    if not webhook_url or not webhook_url.strip():
        return False
    try:
        resp = requests.post(
            webhook_url.strip(),
            json={"text": message},
            timeout=10,
        )
        return resp.status_code == 200
    except Exception as e:
        logger.warning(f"Slack通知送信失敗: {e}")
        return False


def build_collection_message(project_name: str, source: str, success: int, rank_a: int = 0, rank_b: int = 0) -> str:
    return (
        f"✅ 収集完了: {project_name} / {source}\n"
        f"新規 {success}件 (Aランク: {rank_a}件, Bランク: {rank_b}件)"
    )
