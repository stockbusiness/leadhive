import re
import time
import logging
import random
import urllib.robotparser
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from server.services.categorizer import calculate_ec_score

logger = logging.getLogger(__name__)

RETRYABLE_EXCEPTIONS = (
    requests.exceptions.Timeout,
    requests.exceptions.ConnectionError,
    requests.exceptions.ChunkedEncodingError,
)

KNOWN_ENCODINGS = {"utf-8", "shift_jis", "shift-jis", "euc-jp", "iso-2022-jp", "cp932", "ascii"}

LEADHIVE_UA = "LeadHive/1.0 +https://leadhive.work"

_robots_cache: dict[str, tuple[bool, float]] = {}
_ROBOTS_CACHE_TTL = 86400


def check_robots_allowed(url: str) -> bool:
    parsed = urlparse(url)
    base = f"{parsed.scheme}://{parsed.netloc}"
    now = time.time()
    if base in _robots_cache:
        allowed, cached_at = _robots_cache[base]
        if now - cached_at < _ROBOTS_CACHE_TTL:
            return allowed
    try:
        rp = urllib.robotparser.RobotFileParser()
        rp.set_url(f"{base}/robots.txt")
        rp.read()
        allowed = rp.can_fetch(LEADHIVE_UA, url)
    except Exception:
        allowed = True
    _robots_cache[base] = (allowed, now)
    return allowed


def _detect_encoding(response: requests.Response) -> str:
    content_type = response.headers.get("content-type", "")
    charset_match = re.search(r"charset=([^\s;\"']+)", content_type, re.IGNORECASE)
    if charset_match:
        return charset_match.group(1).strip("\"'").lower()
    apparent = (response.apparent_encoding or "").lower()
    if apparent in KNOWN_ENCODINGS:
        return apparent
    return "utf-8"


def detect_cms(soup: BeautifulSoup, html_source: str, response_headers: dict) -> str:
    html_lower = html_source.lower()

    if (
        "cdn.shopify.com" in html_lower
        or "shopify.com/s/files" in html_lower
        or "Shopify.theme" in html_source
        or response_headers.get("x-shopid")
        or response_headers.get("x-shopify-stage")
    ):
        return "Shopify"

    if (
        "wp-content/" in html_lower
        or "wp-includes/" in html_lower
        or soup.find("meta", attrs={"name": "generator", "content": re.compile(r"WordPress", re.I)})
    ):
        return "WordPress"

    if (
        "pay.base.com" in html_lower
        or ".base.shop" in html_lower
        or "base-ec.jp" in html_lower
    ):
        return "BASE"

    if "makeshop.jp" in html_lower:
        return "MakeShop"

    if "future-shop.jp" in html_lower or "futureshop" in html_lower:
        return "futureshop"

    if "shop-pro.jp" in html_lower or "karakami" in html_lower or "color-me-shop" in html_lower:
        return "カラーミー"

    if "ec-cube" in html_lower or "eccube" in html_lower:
        return "EC-CUBE"

    if "static.wixstatic.com" in html_lower or "wix.com" in html_lower:
        return "Wix"

    if "squarespace.com" in html_lower:
        return "Squarespace"

    if "stores.jp" in html_lower:
        return "STORES"

    if "jimdo.com" in html_lower or "jimdofree.com" in html_lower:
        return "Jimdo"

    return ""


def extract_sns_links(soup: BeautifulSoup) -> dict:
    result = {
        "twitter": None,
        "instagram": None,
        "facebook": None,
        "youtube": None,
        "line": None,
        "tiktok": None,
    }
    individual = {
        "sns_x_url": None,
        "sns_instagram_url": None,
        "sns_facebook_url": None,
        "sns_youtube_url": None,
        "sns_tiktok_url": None,
        "sns_line_url": None,
    }

    for a in soup.find_all("a", href=True):
        href = a.get("href", "")
        if not href:
            continue

        if result["twitter"] is None and re.search(r"(?:twitter\.com|x\.com)/(?!(?:share|intent|home|search|hashtag|i/))", href):
            result["twitter"] = href
            individual["sns_x_url"] = href

        if result["instagram"] is None and "instagram.com/" in href and "/p/" not in href:
            result["instagram"] = href
            individual["sns_instagram_url"] = href

        if result["facebook"] is None and re.search(r"facebook\.com/(?!(?:sharer|share|dialog|login|l\.php))", href):
            result["facebook"] = href
            individual["sns_facebook_url"] = href

        if result["youtube"] is None and re.search(r"youtube\.com/(?:channel|@|c/|user/)", href):
            result["youtube"] = href
            individual["sns_youtube_url"] = href

        if result["line"] is None and ("lin.ee/" in href or "line.me/R/ti/p/" in href or "line.me/ti/p/" in href):
            result["line"] = href
            individual["sns_line_url"] = href

        if result["tiktok"] is None and "tiktok.com/" in href:
            result["tiktok"] = href
            individual["sns_tiktok_url"] = href

    sns_count = sum(1 for v in individual.values() if v)
    return {**result, **individual, "sns_count": sns_count}


def detect_recruitment(soup: BeautifulSoup, text: str) -> bool:
    RECRUIT_KEYWORDS = ["採用", "求人", "募集", "career", "recruit", "join us", "働く", "採用情報", "求人情報"]
    text_lower = text.lower()
    for kw in RECRUIT_KEYWORDS:
        if kw.lower() in text_lower:
            return True

    for a in soup.find_all("a", href=True):
        href = a.get("href", "").lower()
        link_text = a.get_text(strip=True).lower()
        combined = f"{href} {link_text}"
        if re.search(r"recruit|career|join|採用|求人|募集|indeed\.com|求人ボックス", combined):
            return True

    return False


def extract_email_from_soup(soup: BeautifulSoup, text: str) -> str:
    candidates: list[str] = []

    for a in soup.find_all("a", href=True):
        href = a.get("href", "")
        if href.startswith("mailto:"):
            addr = href[7:].split("?")[0].strip()
            if re.match(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", addr):
                candidates.append(addr)

    normalized = re.sub(r"\[at\]|\(at\)|（at）|\s+at\s+", "@", text, flags=re.IGNORECASE)
    normalized = re.sub(r"\[dot\]|\(dot\)|（dot）", ".", normalized, flags=re.IGNORECASE)
    for m in re.finditer(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", normalized):
        addr = m.group(0)
        if addr not in candidates:
            candidates.append(addr)

    JUNK_DOMAINS = {"example.com", "example.jp", "sentry.io", "wixpress.com", "shopify.com"}
    filtered = [e for e in candidates if e.split("@")[-1].lower() not in JUNK_DOMAINS]
    if not filtered:
        return ""

    PRIORITY_PREFIXES = ["info", "contact", "inquiry", "support", "sales", "hello", "mail", "admin"]
    for prefix in PRIORITY_PREFIXES:
        for addr in filtered:
            if addr.lower().startswith(prefix + "@") or addr.lower().startswith(prefix + "."):
                return addr

    return filtered[0]


def scrape_company_info(url: str, max_retries: int = 3) -> dict:
    if not check_robots_allowed(url):
        parsed = urlparse(url)
        raw_domain = parsed.netloc.lower()
        domain = raw_domain[4:] if raw_domain.startswith("www.") else raw_domain
        return {
            "website_url": url,
            "domain": domain,
            "robots_disallow": True,
        }

    last_error = ""
    for attempt in range(max_retries):
        try:
            headers = {"User-Agent": LEADHIVE_UA}
            response = requests.get(url, headers=headers, timeout=15)
            response.encoding = _detect_encoding(response)
            html_source = response.text
            soup = BeautifulSoup(html_source, "html.parser")
            text_content = soup.get_text(separator=" ", strip=True)

            raw_domain = urlparse(url).netloc.lower()
            domain = raw_domain[4:] if raw_domain.startswith("www.") else raw_domain
            title = soup.title.string.strip() if soup.title and soup.title.string else ""

            meta_desc = ""
            meta_tag = soup.find("meta", attrs={"name": "description"})
            if meta_tag and meta_tag.get("content"):
                meta_desc = meta_tag["content"]

            h1_texts = [h.get_text(strip=True) for h in soup.find_all("h1")]
            h2_texts = [h.get_text(strip=True) for h in soup.find_all("h2")]

            company_name = extract_company_name(soup, title, text_content)
            phone = extract_phone(text_content)
            prefecture, city = extract_location(text_content)
            contact_url = find_contact_page(soup, url)

            email = extract_email_from_soup(soup, text_content)

            if not email and contact_url:
                try:
                    contact_resp = requests.get(contact_url, headers=headers, timeout=10)
                    contact_resp.encoding = _detect_encoding(contact_resp)
                    contact_soup = BeautifulSoup(contact_resp.text, "html.parser")
                    contact_text = contact_soup.get_text(separator=" ", strip=True)
                    email = extract_email_from_soup(contact_soup, contact_text)
                except Exception:
                    pass

            cms_type = detect_cms(soup, html_source, dict(response.headers))
            cms_detected_at = datetime.utcnow().isoformat() if cms_type else None
            sns_data = extract_sns_links(soup)
            has_recruitment = detect_recruitment(soup, text_content)

            sns_links = {k: v for k, v in sns_data.items() if k in ("twitter", "instagram", "facebook", "youtube", "line", "tiktok")}
            sns_count = sns_data.get("sns_count", 0)

            ec_score = calculate_ec_score(soup, html_source, text_content)
            if ec_score >= 70:
                ec_flag_val = True
            elif ec_score < 40:
                ec_flag_val = False
            else:
                ec_flag_val = None

            full_text = f"{title} {meta_desc} {' '.join(h1_texts)} {' '.join(h2_texts)} {text_content[:3000]}"

            return {
                "company_name": company_name,
                "website_url": url,
                "domain": domain,
                "contact_url": contact_url,
                "prefecture": prefecture,
                "city": city,
                "phone": phone,
                "email": email,
                "cms_type": cms_type or None,
                "cms_detected_at": cms_detected_at,
                "sns_links": sns_links,
                "sns_instagram_url": sns_data.get("sns_instagram_url"),
                "sns_x_url": sns_data.get("sns_x_url"),
                "sns_facebook_url": sns_data.get("sns_facebook_url"),
                "sns_youtube_url": sns_data.get("sns_youtube_url"),
                "sns_tiktok_url": sns_data.get("sns_tiktok_url"),
                "sns_line_url": sns_data.get("sns_line_url"),
                "sns_count": sns_count,
                "ec_score": ec_score,
                "ec_flag": ec_flag_val,
                "has_recruitment": has_recruitment,
                "robots_disallow": False,
                "full_text": full_text,
            }
        except RETRYABLE_EXCEPTIONS as e:
            last_error = f"{type(e).__name__}: {str(e)}"
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)
        except Exception as e:
            return {
                "error": str(e),
                "error_type": "parse_error",
                "website_url": url,
                "domain": urlparse(url).netloc,
            }

    return {
        "error": last_error,
        "error_type": "network_error",
        "retries": max_retries,
        "website_url": url,
        "domain": urlparse(url).netloc,
    }


def extract_company_name(soup: BeautifulSoup, title: str, text: str) -> str:
    og_site = soup.find("meta", property="og:site_name")
    if og_site and og_site.get("content"):
        return og_site["content"].strip()

    if title:
        parts = re.split(r"[|｜\-–—]", title)
        if parts:
            name = parts[0].strip()
            if len(name) > 2:
                return name

    patterns = [
        r"(株式会社[^\s　、。,.<>]{2,20})",
        r"([^\s　、。,.<>]{2,20}株式会社)",
        r"(有限会社[^\s　、。,.<>]{2,20})",
        r"(合同会社[^\s　、。,.<>]{2,20})",
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(1)

    return title.split("|")[0].strip() if title else ""


def extract_phone(text: str) -> str:
    patterns = [
        r"(?:TEL|電話|tel|Tel|phone)[：:\s]*(\d{2,4}[-\-]\d{2,4}[-\-]\d{3,4})",
        r"(\d{2,4}[-\-]\d{2,4}[-\-]\d{3,4})",
        r"(0\d{1,3}[-\-]\d{2,4}[-\-]\d{3,4})",
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            phone = match.group(1)
            phone = phone.replace("−", "-").replace("ー", "-")
            if re.match(r"^0\d", phone):
                return phone
    return ""


def extract_email(text: str) -> str:
    match = re.search(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", text)
    return match.group(0) if match else ""


PREFECTURES = [
    "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
    "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
    "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
    "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
    "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
    "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
    "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
]


def extract_location(text: str) -> tuple[str, str]:
    for pref in PREFECTURES:
        if pref in text:
            city_match = re.search(
                rf"{pref}([^\s　,、。]{{2,10}}?[市区町村郡])", text
            )
            city = city_match.group(1) if city_match else ""
            return pref, city
    return "", ""


def find_contact_page(soup: BeautifulSoup, base_url: str) -> str:
    contact_patterns = [
        r"contact", r"inquiry", r"お問い合わせ", r"問い合わせ",
        r"otoiawase", r"form", r"mail",
    ]
    for link in soup.find_all("a", href=True):
        href = link.get("href", "")
        link_text = link.get_text(strip=True)
        combined = f"{href} {link_text}".lower()

        for pattern in contact_patterns:
            if re.search(pattern, combined, re.IGNORECASE):
                full_url = urljoin(base_url, href)
                if urlparse(full_url).netloc == urlparse(base_url).netloc:
                    return full_url

    return ""


_domain_last_access: dict[str, float] = {}
_CRAWL_MIN_INTERVAL = 3.0


def crawl_delay(domain: str):
    now = time.time()
    last = _domain_last_access.get(domain, 0)
    wait = _CRAWL_MIN_INTERVAL - (now - last)
    if wait > 0:
        time.sleep(wait + random.uniform(0, 1.5))
    _domain_last_access[domain] = time.time()


def scrape_urls_parallel(urls: list[str], max_workers: int = 5) -> list[dict]:
    results = [None] * len(urls)
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_index = {
            executor.submit(scrape_company_info, url): i
            for i, url in enumerate(urls)
        }
        for future in as_completed(future_to_index):
            idx = future_to_index[future]
            try:
                results[idx] = future.result()
            except Exception as e:
                results[idx] = {"error": str(e), "error_type": "executor_error", "website_url": urls[idx], "domain": urlparse(urls[idx]).netloc}
    return results
