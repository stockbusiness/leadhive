import re
import time
import random
import logging
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse, quote_plus

logger = logging.getLogger(__name__)

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
]

SHOPIFY_PARTNER_SOURCES = [
    {
        "name": "Shopify Experts Japan",
        "url": "https://experts.shopify.com/services/store-setup?location%5Bcountry%5D=JP",
    },
    {
        "name": "Shopify Partners Directory",
        "url": "https://www.shopify.com/partners/directory/services/store-setup?location=japan",
    },
]


def scrape_shopify_partners(max_results: int = 30) -> list[dict]:
    all_partners = []

    for source in SHOPIFY_PARTNER_SOURCES:
        partners = _scrape_shopify_source(source["url"], source["name"], max_results)
        all_partners.extend(partners)
        if len(all_partners) >= max_results:
            break
        time.sleep(random.uniform(1, 2))

    if len(all_partners) < max_results:
        google_partners = _search_shopify_partners_via_google(max_results - len(all_partners))
        all_partners.extend(google_partners)

    seen_domains = set()
    unique = []
    for p in all_partners:
        domain = urlparse(p.get("url", "")).netloc.lower()
        if domain.startswith("www."):
            domain = domain[4:]
        if domain and domain not in seen_domains:
            seen_domains.add(domain)
            unique.append(p)
        if len(unique) >= max_results:
            break

    return unique


def _scrape_shopify_source(url: str, source_name: str, max_results: int) -> list[dict]:
    headers = {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ja,en-US;q=0.7,en;q=0.3",
    }

    try:
        resp = requests.get(url, headers=headers, timeout=15)
        if resp.status_code != 200:
            logger.warning(f"Shopify source HTTP {resp.status_code}: {url}")
            return []
        resp.encoding = resp.apparent_encoding
        soup = BeautifulSoup(resp.text, "html.parser")
    except Exception as e:
        logger.error(f"Shopify source error: {url} - {e}")
        return []

    partners = []

    for card in soup.find_all(["div", "article", "li"], class_=re.compile(r"partner|expert|card|listing", re.IGNORECASE)):
        a_tag = card.find("a", href=True)
        if not a_tag:
            continue

        href = a_tag.get("href", "")
        full_url = urljoin(url, href)
        parsed = urlparse(full_url)

        if "shopify.com" in parsed.netloc:
            website_links = card.find_all("a", href=True)
            for wl in website_links:
                wl_href = wl.get("href", "")
                if wl_href.startswith("http") and "shopify.com" not in wl_href:
                    full_url = wl_href
                    break
            else:
                continue

        title = a_tag.get_text(strip=True)
        desc_el = card.find(["p", "span", "div"], class_=re.compile(r"desc|bio|summary|text", re.IGNORECASE))
        description = desc_el.get_text(strip=True) if desc_el else ""

        partners.append({
            "url": full_url,
            "title": title,
            "description": description,
            "source": source_name,
        })

        if len(partners) >= max_results:
            break

    return partners


def _search_shopify_partners_via_google(num: int) -> list[dict]:
    queries = [
        "Shopify パートナー 制作会社 日本",
        "Shopify 構築 代行 会社 東京",
        "Shopify エキスパート 日本 EC制作",
    ]

    results = []
    for query in queries:
        if len(results) >= num:
            break

        encoded = quote_plus(query)
        url = f"https://www.google.com/search?q={encoded}&hl=ja&gl=jp&num=10"

        headers = {
            "User-Agent": random.choice(USER_AGENTS),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "ja,en-US;q=0.7,en;q=0.3",
        }

        try:
            resp = requests.get(url, headers=headers, timeout=15)
            if resp.status_code != 200:
                continue
            resp.encoding = "utf-8"
            soup = BeautifulSoup(resp.text, "html.parser")
        except Exception:
            continue

        for div in soup.find_all("div", class_="g"):
            a_tag = div.find("a", href=True)
            if not a_tag:
                continue
            href = a_tag.get("href", "")
            if not href.startswith("http"):
                continue
            if "google." in urlparse(href).netloc:
                continue

            title_el = div.find("h3")
            title = title_el.get_text(strip=True) if title_el else ""

            results.append({
                "url": href,
                "title": title,
                "source": "Google検索",
            })

            if len(results) >= num:
                break

        time.sleep(random.uniform(2, 4))

    return results
