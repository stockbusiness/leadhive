import re
import time
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse

RETRYABLE_EXCEPTIONS = (
    requests.exceptions.Timeout,
    requests.exceptions.ConnectionError,
    requests.exceptions.ChunkedEncodingError,
)

KNOWN_ENCODINGS = {"utf-8", "shift_jis", "shift-jis", "euc-jp", "iso-2022-jp", "cp932", "ascii"}


def _detect_encoding(response: requests.Response) -> str:
    content_type = response.headers.get("content-type", "")
    charset_match = re.search(r"charset=([^\s;\"']+)", content_type, re.IGNORECASE)
    if charset_match:
        return charset_match.group(1).strip("\"'").lower()
    apparent = (response.apparent_encoding or "").lower()
    if apparent in KNOWN_ENCODINGS:
        return apparent
    return "utf-8"


def scrape_company_info(url: str, max_retries: int = 3) -> dict:
    last_error = ""
    for attempt in range(max_retries):
        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
            response = requests.get(url, headers=headers, timeout=15)
            response.encoding = _detect_encoding(response)
            soup = BeautifulSoup(response.text, "html.parser")
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
            email = extract_email(text_content)
            prefecture, city = extract_location(text_content)
            contact_url = find_contact_page(soup, url)

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
                rf"{pref}([^\s　,、。]{2,10}?[市区町村郡])", text
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
