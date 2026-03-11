import re
import time
import random
import logging
import requests
from sqlalchemy.orm import Session

from server.models import Company, RejectedUrl, AppSetting
from server.services.scraper import scrape_company_info
from server.services.aggregator import normalize_domain, is_aggregator_site
from server.services.categorizer import categorize_company, detect_flags
from server.services.scorer import calculate_score

logger = logging.getLogger(__name__)

GBIZ_BASE_URL = "https://info.gbiz.go.jp/hojin/v1/hojin"

PREFECTURES = [
    "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
    "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
    "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
    "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
    "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
    "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
    "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
]

PREFECTURE_CODES = {
    "北海道": "01", "青森県": "02", "岩手県": "03", "宮城県": "04", "秋田県": "05",
    "山形県": "06", "福島県": "07", "茨城県": "08", "栃木県": "09", "群馬県": "10",
    "埼玉県": "11", "千葉県": "12", "東京都": "13", "神奈川県": "14", "新潟県": "15",
    "富山県": "16", "石川県": "17", "福井県": "18", "山梨県": "19", "長野県": "20",
    "岐阜県": "21", "静岡県": "22", "愛知県": "23", "三重県": "24", "滋賀県": "25",
    "京都府": "26", "大阪府": "27", "兵庫県": "28", "奈良県": "29", "和歌山県": "30",
    "鳥取県": "31", "島根県": "32", "岡山県": "33", "広島県": "34", "山口県": "35",
    "徳島県": "36", "香川県": "37", "愛媛県": "38", "高知県": "39", "福岡県": "40",
    "佐賀県": "41", "長崎県": "42", "熊本県": "43", "大分県": "44", "宮崎県": "45",
    "鹿児島県": "46", "沖縄県": "47",
}


def get_gbiz_token(org_id: int, db: Session) -> str | None:
    import os
    from server.models import SystemSettings
    env_token = os.environ.get("GbizAPIkey") or os.environ.get("GBIZINFO_API_TOKEN") or os.environ.get("GBIZ_API_TOKEN")
    if env_token:
        return env_token
    from server.services.encryption import decrypt_value
    row = db.query(SystemSettings).filter(SystemSettings.key == "gbizinfo_api_token").first()
    return decrypt_value(row.value) if row and row.value else None


def search_gbiz(token: str, name_keyword: str = "", prefecture: str = "", page: int = 1, pref_code: str = "", city_code: str = "") -> dict:
    headers = {
        "X-hojinInfo-api-token": token,
        "Accept": "application/json",
    }
    params = {"page": page}
    if name_keyword:
        params["name"] = name_keyword
    # pref_code takes priority; fallback to prefecture name lookup
    resolved_pref_code = pref_code or PREFECTURE_CODES.get(prefecture, "")
    if resolved_pref_code:
        params["prefecture"] = resolved_pref_code
    if city_code and resolved_pref_code:
        params["city"] = city_code

    resp = requests.get(GBIZ_BASE_URL, headers=headers, params=params, timeout=15)
    if resp.status_code in (400, 404):
        return {"companies": [], "total_page_count": max(1, page - 1), "is_last_page": True}
    resp.raise_for_status()
    data = resp.json()

    companies = []
    for item in (data.get("hojin-infos") or []):
        companies.append({
            "name": item.get("name", ""),
            "location": item.get("location", "") or "",
            "company_url": item.get("company_url", "") or "",
            "business_summary": item.get("business_summary", "") or "",
            "corporate_number": item.get("corporate_number", "") or "",
        })

    total_pages = data.get("total_page_count")
    is_last_page = len(companies) == 0 or (total_pages is not None and page >= int(total_pages))

    return {
        "companies": companies,
        "total_page_count": int(total_pages) if total_pages else 999,
        "is_last_page": is_last_page,
    }


def find_website_for_company(company_name: str, location: str = "", db: Session = None, org_id: int = None) -> str | None:
    from urllib.parse import urlparse as _urlparse
    city = ""
    for pref in PREFECTURES:
        if location.startswith(pref):
            rest = location[len(pref):]
            m = re.match(r'^([^\s]+?[市区町村郡])', rest)
            city = m.group(1) if m else rest[:6]
            break

    def _extract_domain(url: str) -> str:
        try:
            netloc = _urlparse(url).netloc or ""
            return normalize_domain(netloc)
        except Exception:
            return ""

    def _is_valid_company_url(url: str) -> bool:
        if not url or url.startswith("error"):
            return False
        domain = _extract_domain(url)
        if not domain:
            return False
        return not is_aggregator_site(url)[0]

    query_strict = f'"{company_name}" {city} 公式サイト'.strip()
    query_loose = f'{company_name} {city} 公式サイト'.strip() if city else f'{company_name} 公式サイト'

    # Serper API を最優先使用（システム管理者設定）
    serper_key = None
    try:
        from server.services.serper_search import get_serper_api_key, search_serper
        serper_key = get_serper_api_key()
    except Exception:
        pass

    if serper_key:
        for q in [query_strict, query_loose]:
            try:
                results = search_serper(serper_key, q, num=5)
                for r in results:
                    url = r.get("url", "")
                    if _is_valid_company_url(url):
                        logger.debug(f"Serper found: {company_name} → {_extract_domain(url)}")
                        return url
            except Exception as e:
                logger.warning(f"Serper search failed for {company_name} query={q!r}: {e}")
                break
        logger.debug(f"Serper: no valid URL for {company_name}")

    # Google Custom Search API（クライアント設定）にフォールバック
    if db and org_id:
        try:
            from server.services.google_search import search_google
            api_key_row = db.query(AppSetting).filter(
                AppSetting.org_id == org_id, AppSetting.setting_key == "google_api_key"
            ).first()
            cx_row = db.query(AppSetting).filter(
                AppSetting.org_id == org_id, AppSetting.setting_key == "google_cx"
            ).first()
            if api_key_row and api_key_row.setting_value and cx_row and cx_row.setting_value:
                results = search_google(api_key_row.setting_value, cx_row.setting_value, query_loose, db, num=5)
                for r in results:
                    url = r.get("url", "")
                    if _is_valid_company_url(url):
                        return url
        except Exception as e:
            logger.warning(f"Google API search failed for {company_name}: {e}")

    # DuckDuckGo検索（フォールバック）
    try:
        from ddgs import DDGS
        from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeout

        def _ddg_fetch():
            with DDGS(timeout=10) as ddgs:
                return list(ddgs.text(query_loose, max_results=5, region="jp-ja"))

        with ThreadPoolExecutor(max_workers=1) as _ex:
            _future = _ex.submit(_ddg_fetch)
            try:
                ddg_results = _future.result(timeout=15)
            except FuturesTimeout:
                _future.cancel()
                logger.warning(f"DuckDuckGo timeout for {company_name}")
                ddg_results = []

        for r in ddg_results:
            url = r.get("href", "")
            if _is_valid_company_url(url):
                return url
    except Exception as e:
        logger.warning(f"DuckDuckGo search failed for {company_name}: {e}")

    # 最終フォールバック: 直接スクレイピング
    try:
        from server.services.google_scrape import scrape_google_search
        results = scrape_google_search(query_loose, num=3)
        for r in results:
            url = r.get("url", "")
            if _is_valid_company_url(url):
                return url
    except Exception as e:
        logger.warning(f"Website scrape search failed for {company_name}: {e}")
    return None


def _parse_location(location: str) -> tuple[str, str]:
    prefecture = ""
    city = ""
    for pref in PREFECTURES:
        if location.startswith(pref):
            prefecture = pref
            rest = location[len(pref):]
            m = re.match(r'^([^\s]+?[市区町村郡])', rest)
            city = m.group(1) if m else rest[:6]
            break
    return prefecture, city


def collect_from_gbiz(
    job_id: str,
    project_id: int,
    org_id: int,
    keyword: str,
    prefecture: str,
    max_results: int,
    db: Session,
) -> dict:
    from server.services.collector import _upsert_company_master, job_update

    token = get_gbiz_token(org_id, db)
    if not token:
        raise ValueError("gBizINFO APIトークンが設定されていません")

    existing_domains = set(
        c.domain for c in db.query(Company).filter(Company.project_id == project_id).all()
        if c.domain
    )
    rejected_domains = set(
        r.domain for r in db.query(RejectedUrl).filter(RejectedUrl.project_id == project_id).all()
        if r.domain
    )

    job_update(job_id, message="gBizINFO から法人リストを取得中...")

    all_candidates = []
    page = 1
    max_pages = 10
    while len(all_candidates) < max_results * 3 and page <= max_pages:
        try:
            result = search_gbiz(token, name_keyword=keyword, prefecture=prefecture, page=page)
        except requests.HTTPError as e:
            status = e.response.status_code if hasattr(e, "response") else "?"
            raise ValueError(f"gBizINFO API エラー (HTTP {status}): APIトークンを確認してください")
        except Exception as e:
            raise ValueError(f"gBizINFO 接続エラー: {str(e)}")

        all_candidates.extend(result["companies"])
        if page >= result["total_page_count"]:
            break
        page += 1
        time.sleep(0.3)

    job_update(job_id, message=f"gBizINFOから {len(all_candidates)} 件取得。ホームページを探索中...")

    success = 0
    duplicate = 0
    skipped = 0
    errors = 0
    results = []

    targets = all_candidates[: max_results * 2]

    for i, company in enumerate(targets):
        if success >= max_results:
            break

        job_update(
            job_id,
            current=i + 1,
            total=min(len(targets), max_results * 2),
            message=f"({i + 1}/{len(targets)}) 「{company['name']}」を処理中...",
        )

        try:
            url = company["company_url"]
            if not url:
                url = find_website_for_company(company["name"], company["location"], db=db, org_id=org_id)
                if url:
                    time.sleep(random.uniform(1.0, 2.0))

            pref, city = _parse_location(company["location"])

            if not url:
                # URLが見つからなくても企業情報をDBに保存
                info = {
                    "company_name": company["name"],
                    "website_url": None,
                    "domain": None,
                    "prefecture": pref or None,
                    "city": city or None,
                    "project_id": project_id,
                }
                if company.get("corporate_number"):
                    info["corporate_number"] = company["corporate_number"]
                score, rank = calculate_score(info)
                info["score_total"] = score
                info["score_rank"] = rank
                allowed_fields = {c.name for c in Company.__table__.columns}
                company_kwargs = {k: v for k, v in info.items() if k in allowed_fields}
                new_company = Company(**company_kwargs)
                db.add(new_company)
                db.commit()
                skipped += 1
                results.append({
                    "url": "",
                    "name": company["name"],
                    "status": "skipped",
                    "message": "URLなし・企業情報のみ保存",
                })
                continue

            from urllib.parse import urlparse as _up3
            domain = normalize_domain(_up3(url).netloc)
            if not domain:
                skipped += 1
                continue

            if domain in existing_domains or domain in rejected_domains:
                duplicate += 1
                results.append({"url": url, "name": company["name"], "status": "duplicate", "message": "重複"})
                continue

            if is_aggregator_site(url)[0]:
                rejected_domains.add(domain)
                skipped += 1
                results.append({"url": url, "name": company["name"], "status": "rejected", "message": "アグリゲーターサイト"})
                continue

            scraped = scrape_company_info(url)
            if not scraped:
                errors += 1
                results.append({"url": url, "name": company["name"], "status": "error", "message": "スクレイピング失敗"})
                continue

            scraped["company_name"] = company["name"] or scraped.get("company_name", "")
            if pref:
                scraped["prefecture"] = pref
            if city:
                scraped["city"] = city
            scraped["website_url"] = url
            scraped["domain"] = domain

            full_text = scraped.get("full_text", "")
            category_main, category_sub = categorize_company(full_text)
            flags = detect_flags(full_text)
            scraped.update({
                "category_main": category_main,
                "category_sub": category_sub,
                **flags,
            })
            score, rank = calculate_score(scraped)
            scraped["score_total"] = score
            scraped["score_rank"] = rank

            allowed_fields = {c.name for c in Company.__table__.columns}
            company_kwargs = {k: v for k, v in scraped.items() if k in allowed_fields}
            company_kwargs["project_id"] = project_id

            new_company = Company(**company_kwargs)
            db.add(new_company)
            db.commit()
            db.refresh(new_company)

            existing_domains.add(domain)
            _upsert_company_master(db, scraped, domain, source="gbiz")

            success += 1
            results.append({
                "url": url,
                "name": company["name"],
                "status": "success",
                "message": f"ランク{rank} / スコア{score}",
                "score_rank": rank,
                "score_total": score,
            })

        except Exception as e:
            logger.warning(f"gbiz collect error for {company.get('name', '')}: {e}")
            errors += 1
            results.append({
                "url": "",
                "name": company.get("name", ""),
                "status": "error",
                "message": str(e),
            })

    summary = {
        "success": success,
        "duplicate": duplicate,
        "skipped": skipped,
        "error": errors,
        "keyword": keyword,
        "prefecture": prefecture,
    }
    return {"results": results, "summary": summary}
