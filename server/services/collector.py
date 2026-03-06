import re
import requests
from urllib.parse import urlparse
from sqlalchemy.orm import Session
from server.models import AppSetting, Company, RejectedUrl, SearchKeyword
from server.services.scraper import scrape_company_info
from server.services.categorizer import categorize_company, detect_flags
from server.services.scorer import calculate_score

KNOWN_AGGREGATOR_DOMAINS = [
    "matome.naver.jp", "matomeno.in", "togetter.com",
    "naver.jp", "hatena.ne.jp", "hatenablog.com",
    "qiita.com", "zenn.dev", "note.com",
    "kakaku.com", "price.com", "mybest.com",
    "rank-king.jp", "ranking.net",
    "comparison.com", "hikaku.com",
    "ferret-plus.com", "liskul.com", "boxil.jp",
    "itreview.jp", "oricon.co.jp",
    "minne.com", "creema.jp",
    "coconala.com", "lancers.jp", "crowdworks.jp",
    "wikipedia.org", "youtube.com", "twitter.com", "x.com",
    "facebook.com", "instagram.com", "linkedin.com",
    "amazon.co.jp", "rakuten.co.jp",
    "amebaownd.com", "ameblo.jp", "livedoor.com",
    "fc2.com", "seesaa.net", "jugem.jp",
    "wix.com", "jimdo.com", "weebly.com",
]

AGGREGATOR_TITLE_PATTERNS = [
    r"\d+選", r"\d+社", r"おすすめ\d+",
    r"ランキング", r"比較", r"まとめ",
    r"一覧", r"徹底比較", r"厳選",
    r"best\s*\d+", r"top\s*\d+",
]

AGGREGATOR_URL_PATTERNS = [
    r"ranking", r"matome", r"hikaku",
    r"compare", r"best-?of", r"top-?\d+",
    r"recommend", r"osusume",
]


def normalize_domain(domain: str) -> str:
    domain = domain.lower().strip()
    if domain.startswith("www."):
        domain = domain[4:]
    return domain


def is_aggregator_site(url: str, title: str = "") -> tuple[bool, str]:
    domain = normalize_domain(urlparse(url).netloc)
    path = urlparse(url).path.lower()

    for agg_domain in KNOWN_AGGREGATOR_DOMAINS:
        if agg_domain in domain:
            return True, f"既知のまとめサイト: {agg_domain}"

    for pattern in AGGREGATOR_URL_PATTERNS:
        if re.search(pattern, path, re.IGNORECASE):
            return True, f"URLパターン: {pattern}"

    if title:
        for pattern in AGGREGATOR_TITLE_PATTERNS:
            if re.search(pattern, title, re.IGNORECASE):
                return True, f"タイトルパターン: {pattern}"

    return False, ""


def search_google(api_key: str, cx: str, query: str, num: int = 10, start: int = 1) -> list[dict]:
    try:
        resp = requests.get(
            "https://www.googleapis.com/customsearch/v1",
            params={
                "key": api_key,
                "cx": cx,
                "q": query,
                "num": min(num, 10),
                "start": start,
                "lr": "lang_ja",
                "gl": "jp",
            },
            timeout=15,
        )
        if resp.status_code != 200:
            error_msg = resp.json().get("error", {}).get("message", "Unknown error")
            return [{"error": error_msg}]

        data = resp.json()
        results = []
        for item in data.get("items", []):
            results.append({
                "url": item.get("link", ""),
                "title": item.get("title", ""),
                "snippet": item.get("snippet", ""),
            })
        return results
    except Exception as e:
        return [{"error": str(e)}]


def collect_by_keyword(keyword_id: int, db: Session) -> dict:
    keyword = db.query(SearchKeyword).filter(SearchKeyword.id == keyword_id).first()
    if not keyword:
        return {"error": "キーワードが見つかりません"}

    api_key_setting = db.query(AppSetting).filter(AppSetting.setting_key == "google_api_key").first()
    cx_setting = db.query(AppSetting).filter(AppSetting.setting_key == "google_cx").first()

    if not api_key_setting or not api_key_setting.setting_value:
        return {"error": "Google API Keyが設定されていません。設定画面で登録してください。"}
    if not cx_setting or not cx_setting.setting_value:
        return {"error": "Search Engine ID (cx)が設定されていません。設定画面で登録してください。"}

    query = keyword.keyword
    if keyword.region:
        query += f" {keyword.region}"

    rejected_domains = set(
        r.domain for r in db.query(RejectedUrl.domain).all()
    )

    existing_domains = set(
        c.domain for c in db.query(Company.domain).all()
    )

    exclude_list = []
    if keyword.exclude_keywords:
        exclude_list = [kw.strip() for kw in keyword.exclude_keywords.split(",") if kw.strip()]

    for ex in exclude_list:
        query += f" -{ex}"

    search_results = search_google(
        api_key_setting.setting_value,
        cx_setting.setting_value,
        query,
        num=10,
    )

    if search_results and "error" in search_results[0]:
        return {"error": f"検索APIエラー: {search_results[0]['error']}"}

    results = []
    for sr in search_results:
        url = sr.get("url", "")
        title = sr.get("title", "")
        if not url:
            continue

        domain = normalize_domain(urlparse(url).netloc)

        if domain in rejected_domains:
            results.append({
                "url": url, "status": "rejected",
                "message": "拒否リストに登録済み",
            })
            continue

        is_agg, reason = is_aggregator_site(url, title)
        if is_agg:
            existing_rejected = db.query(RejectedUrl).filter(RejectedUrl.domain == domain).first()
            if not existing_rejected:
                db.add(RejectedUrl(domain=domain, url=url, reason=reason))
                db.commit()
                rejected_domains.add(domain)
            results.append({
                "url": url, "status": "rejected",
                "message": f"まとめサイトとして除外: {reason}",
            })
            continue

        if domain in existing_domains:
            results.append({
                "url": url, "status": "duplicate",
                "message": "既に登録済み",
            })
            continue

        info = scrape_company_info(url)
        if "error" in info:
            results.append({
                "url": url, "status": "error",
                "message": info["error"],
            })
            continue

        full_text = info.pop("full_text", "")
        category_main, category_sub = categorize_company(full_text)
        flags = detect_flags(full_text)

        company_data = {
            **info,
            "category_main": category_main,
            "category_sub": category_sub,
            **flags,
        }

        score, rank = calculate_score(company_data)
        company_data["score_total"] = score
        company_data["score_rank"] = rank

        company = Company(**{k: v for k, v in company_data.items() if hasattr(Company, k)})
        db.add(company)
        db.commit()
        db.refresh(company)
        existing_domains.add(domain)

        results.append({
            "url": url, "status": "success",
            "message": f"{company.company_name or domain} (スコア: {score})",
            "company_id": company.id,
        })

    summary = {
        "keyword": keyword.keyword,
        "total": len(results),
        "success": sum(1 for r in results if r["status"] == "success"),
        "duplicate": sum(1 for r in results if r["status"] == "duplicate"),
        "rejected": sum(1 for r in results if r["status"] == "rejected"),
        "error": sum(1 for r in results if r["status"] == "error"),
    }

    return {"results": results, "summary": summary}
