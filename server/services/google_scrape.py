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
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0",
]


def scrape_google_search(query: str, num: int = 10, lang: str = "ja") -> list[dict]:
    results = []
    seen_domains = set()
    start = 0

    while len(results) < num:
        batch = _fetch_google_page(query, start=start, lang=lang)
        if not batch:
            break

        for item in batch:
            domain = urlparse(item["url"]).netloc.lower()
            if domain.startswith("www."):
                domain = domain[4:]
            if domain not in seen_domains:
                seen_domains.add(domain)
                results.append(item)
                if len(results) >= num:
                    break

        start += 10
        if start >= 30:
            break

        time.sleep(random.uniform(2, 4))

    return results[:num]


def _fetch_google_page(query: str, start: int = 0, lang: str = "ja") -> list[dict]:
    encoded_query = quote_plus(query)
    url = f"https://www.google.com/search?q={encoded_query}&start={start}&hl={lang}&gl=jp&num=10"

    headers = {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ja,en-US;q=0.7,en;q=0.3",
        "Accept-Encoding": "gzip, deflate",
        "DNT": "1",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
    }

    try:
        resp = requests.get(url, headers=headers, timeout=8)
        if resp.status_code != 200:
            logger.warning(f"Google scrape: HTTP {resp.status_code}")
            return []

        resp.encoding = "utf-8"
        soup = BeautifulSoup(resp.text, "html.parser")
    except Exception as e:
        logger.error(f"Google scrape error: {e}")
        return []

    results = []

    for div in soup.find_all("div", class_="g"):
        a_tag = div.find("a", href=True)
        if not a_tag:
            continue

        href = a_tag.get("href", "")
        if not href.startswith("http"):
            continue

        parsed = urlparse(href)
        if "google." in parsed.netloc:
            continue

        title_el = div.find("h3")
        title = title_el.get_text(strip=True) if title_el else ""

        snippet_el = div.find("div", class_=re.compile(r"VwiC3b|IsZvec|s3v9rd"))
        if not snippet_el:
            snippet_el = div.find("span", class_=re.compile(r"aCOpRe|st"))
        snippet = snippet_el.get_text(strip=True) if snippet_el else ""

        results.append({
            "url": href,
            "title": title,
            "snippet": snippet,
        })

    if not results:
        for a_tag in soup.find_all("a", href=True):
            href = a_tag.get("href", "")
            if href.startswith("/url?q="):
                actual_url = href.split("/url?q=")[1].split("&")[0]
                if actual_url.startswith("http") and "google." not in urlparse(actual_url).netloc:
                    title = a_tag.get_text(strip=True)
                    if title and len(title) > 3:
                        results.append({
                            "url": actual_url,
                            "title": title,
                            "snippet": "",
                        })

    return results
