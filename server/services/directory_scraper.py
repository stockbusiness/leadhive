import re
import time
import logging
import requests
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
]


def _get_headers(idx: int = 0) -> dict:
    return {"User-Agent": USER_AGENTS[idx % len(USER_AGENTS)]}


def _extract_links_from_soup(soup: BeautifulSoup, page_url: str) -> list[dict]:
    base_domain = urlparse(page_url).netloc.lower()
    if base_domain.startswith("www."):
        base_domain = base_domain[4:]
    links = []
    seen_domains = set()

    for a_tag in soup.find_all("a", href=True):
        href = a_tag.get("href", "").strip()
        if not href or href.startswith("#") or href.startswith("javascript:"):
            continue

        full_url = urljoin(page_url, href)
        parsed = urlparse(full_url)

        if parsed.scheme not in ("http", "https"):
            continue

        link_domain = parsed.netloc.lower()
        if link_domain.startswith("www."):
            link_domain = link_domain[4:]

        if link_domain == base_domain:
            continue

        if link_domain in seen_domains:
            continue

        skip_extensions = (".pdf", ".jpg", ".jpeg", ".png", ".gif", ".zip", ".css", ".js")
        if any(parsed.path.lower().endswith(ext) for ext in skip_extensions):
            continue

        skip_domains = (
            "google.", "facebook.com", "twitter.com", "x.com", "instagram.com",
            "youtube.com", "linkedin.com", "github.com", "apple.com",
            "play.google.com", "apps.apple.com",
        )
        if any(sd in link_domain for sd in skip_domains):
            continue

        seen_domains.add(link_domain)
        link_text = a_tag.get_text(strip=True)
        links.append({"url": full_url, "title": link_text})

    return links


def find_next_page(soup: BeautifulSoup, current_url: str) -> str | None:
    next_patterns = [
        r"次へ", r"次のページ", r"next", r"次ページ", r">>", r"›",
    ]

    for a_tag in soup.find_all("a", href=True):
        text = a_tag.get_text(strip=True).lower()
        href = a_tag.get("href", "")
        aria_label = (a_tag.get("aria-label") or "").lower()
        combined = f"{text} {aria_label}"

        for pattern in next_patterns:
            if re.search(pattern, combined, re.IGNORECASE):
                full_url = urljoin(current_url, href)
                if full_url != current_url:
                    return full_url

    return None


def _validate_url(url: str) -> bool:
    import socket
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return False
    hostname = parsed.hostname
    if not hostname:
        return False
    try:
        ip = socket.gethostbyname(hostname)
        parts = ip.split(".")
        if parts[0] in ("10", "127", "0") or (parts[0] == "172" and 16 <= int(parts[1]) <= 31) or (parts[0] == "192" and parts[1] == "168"):
            return False
    except socket.gaierror:
        return False
    return True


def scrape_directory(url: str, max_pages: int = 3) -> list[dict]:
    if not _validate_url(url):
        logger.warning(f"Directory URL rejected (invalid/private): {url}")
        return []

    all_links = []
    current_url = url
    visited = set()

    for page_num in range(max_pages):
        if current_url in visited:
            break
        visited.add(current_url)

        logger.info(f"Directory scrape page {page_num + 1}: {current_url}")

        try:
            resp = requests.get(current_url, headers=_get_headers(page_num), timeout=15)
            resp.encoding = resp.apparent_encoding
            soup = BeautifulSoup(resp.text, "html.parser")
        except Exception as e:
            logger.error(f"Directory page fetch error: {current_url} - {e}")
            break

        page_links = _extract_links_from_soup(soup, current_url)
        all_links.extend(page_links)

        next_url = find_next_page(soup, current_url)
        if not next_url:
            break

        current_url = next_url
        time.sleep(1)

    seen = set()
    unique_links = []
    for link in all_links:
        domain = urlparse(link["url"]).netloc.lower()
        if domain.startswith("www."):
            domain = domain[4:]
        if domain not in seen:
            seen.add(domain)
            unique_links.append(link)

    return unique_links
