import logging
from urllib.parse import urlparse
from sqlalchemy.orm import Session

from server.models import AppSetting

logger = logging.getLogger(__name__)

SHOPIFY_PARTNER_QUERIES = [
    "Shopify パートナー 制作会社 日本",
    "Shopify エキスパート 公式サイト 日本",
    "Shopify ストア 構築 代行 会社",
    "Shopify EC制作 日本 会社",
    "Shopify Plus パートナー 日本",
]


def collect_shopify_partners_via_google(
    max_results: int,
    db: Session,
    org_id: int,
) -> list[dict]:
    from server.services.google_search import search_google
    from server.services.aggregator import normalize_domain, is_aggregator_site

    api_key_row = db.query(AppSetting).filter(
        AppSetting.org_id == org_id, AppSetting.setting_key == "google_api_key"
    ).first()
    cx_row = db.query(AppSetting).filter(
        AppSetting.org_id == org_id, AppSetting.setting_key == "google_cx"
    ).first()

    if not (api_key_row and api_key_row.setting_value and cx_row and cx_row.setting_value):
        return []

    api_key = api_key_row.setting_value
    cx = cx_row.setting_value

    seen_domains = set()
    results = []

    for query in SHOPIFY_PARTNER_QUERIES:
        if len(results) >= max_results:
            break

        try:
            items = search_google(api_key, cx, query, db, num=10)
        except Exception as e:
            logger.warning(f"Google search failed for Shopify query '{query}': {e}")
            continue

        for item in items:
            if len(results) >= max_results:
                break
            url = item.get("url", "")
            if not url:
                continue
            domain = normalize_domain(url)
            if not domain:
                continue
            if is_aggregator_site(domain):
                continue
            if domain in seen_domains:
                continue
            parsed = urlparse(url)
            if any(skip in parsed.netloc for skip in ["shopify.com", "google.com", "youtube.com"]):
                continue
            seen_domains.add(domain)
            results.append({
                "url": url,
                "title": item.get("title", ""),
                "source": "Shopifyパートナー検索",
            })

    return results
