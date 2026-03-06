from urllib.parse import urlparse
from sqlalchemy.orm import Session
from server.models import AppSetting, Company, RejectedUrl, SearchKeyword, CollectionLog
from server.services.scraper import scrape_company_info
from server.services.categorizer import categorize_company, detect_flags
from server.services.scorer import calculate_score
from server.services.aggregator import normalize_domain, is_aggregator_site
from server.services.google_search import search_google


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
        db,
        num=10,
    )

    if search_results and "error" in search_results[0]:
        return {"error": f"検索APIエラー: {search_results[0]['error']}"}

    results = _process_search_results(search_results, db, rejected_domains, existing_domains)

    summary = {
        "keyword": keyword.keyword,
        "total": len(results),
        "success": sum(1 for r in results if r["status"] == "success"),
        "duplicate": sum(1 for r in results if r["status"] == "duplicate"),
        "rejected": sum(1 for r in results if r["status"] == "rejected"),
        "error": sum(1 for r in results if r["status"] == "error"),
    }

    log = CollectionLog(
        keyword_id=keyword.id,
        keyword_text=keyword.keyword,
        total_found=summary["total"],
        success_count=summary["success"],
        duplicate_count=summary["duplicate"],
        rejected_count=summary["rejected"],
        error_count=summary["error"],
    )
    db.add(log)
    db.commit()

    return {"results": results, "summary": summary}


def _process_search_results(
    search_results: list[dict],
    db: Session,
    rejected_domains: set,
    existing_domains: set,
) -> list[dict]:
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

    return results
