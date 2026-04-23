import logging
from urllib.parse import urlparse
from sqlalchemy.orm import Session

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
    from server.services.serper_search import search_serper, get_serper_api_key
    from server.services.aggregator import normalize_domain, is_aggregator_site

    serper_key = get_serper_api_key(db=db, org_id=org_id)
    if not serper_key:
        return []

    seen_domains = set()
    results = []

    for query in SHOPIFY_PARTNER_QUERIES:
        if len(results) >= max_results:
            break

        try:
            items = search_serper(serper_key, query, num=10)
        except Exception as e:
            logger.warning(f"Serper search failed for Shopify query '{query}': {e}")
            continue

        for item in items:
            if len(results) >= max_results:
                break
            url = item.get("url", "")
            if not url:
                continue
            domain = normalize_domain(urlparse(url).netloc)
            if not domain:
                continue
            if is_aggregator_site(url)[0]:
                continue
            if domain in seen_domains:
                continue
            if any(skip in urlparse(url).netloc for skip in ["shopify.com", "google.com", "youtube.com"]):
                continue
            seen_domains.add(domain)
            results.append({
                "url": url,
                "title": item.get("title", ""),
                "source": "Shopifyパートナー検索",
            })

    return results
