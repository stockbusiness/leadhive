import logging
import threading
from datetime import datetime
from urllib.parse import urlparse
from sqlalchemy.orm import Session
from server.models import AppSetting, Company, CompanyMaster, RejectedUrl, SearchKeyword, CollectionLog
from server.services.scraper import scrape_company_info, scrape_urls_parallel
from server.services.categorizer import categorize_company, detect_flags
from server.services.scorer import calculate_score
from server.services.aggregator import normalize_domain, is_aggregator_site
from server.services.google_search import search_google

logger = logging.getLogger(__name__)

_job_store: dict[str, dict] = {}
_job_store_lock = threading.Lock()


def job_update(job_id: str, **kwargs):
    with _job_store_lock:
        if job_id not in _job_store:
            _job_store[job_id] = {}
        _job_store[job_id].update(kwargs)


def job_get(job_id: str) -> dict | None:
    with _job_store_lock:
        return dict(_job_store.get(job_id, {}))


def job_cleanup(job_id: str):
    with _job_store_lock:
        _job_store.pop(job_id, None)


def _upsert_company_master(db: Session, company_data: dict, domain: str = None, source: str = "unknown", corporate_number: str = None):
    try:
        search_parts = [
            company_data.get("company_name") or "",
            domain or "",
            company_data.get("category_main") or "",
            company_data.get("prefecture") or "",
        ]
        search_text = " ".join(p for p in search_parts if p).lower()

        corp_num = corporate_number or company_data.get("corporate_number") or None

        existing = None
        if domain:
            existing = db.query(CompanyMaster).filter(CompanyMaster.domain == domain).first()
        if not existing and corp_num:
            existing = db.query(CompanyMaster).filter(CompanyMaster.corporate_number == corp_num).first()

        if existing:
            for field in ["company_name", "website_url", "contact_url", "phone", "email",
                          "prefecture", "city", "category_main", "category_sub",
                          "shopify_flag", "ec_flag", "amazon_flag", "rakuten_flag",
                          "consulting_flag", "operation_flag", "production_flag",
                          "score_total", "score_rank",
                          "cms_type", "cms_detected_at", "sns_links", "has_recruitment",
                          "employee_count", "escms_target_flag", "robots_disallow"]:
                val = company_data.get(field)
                if val is not None:
                    setattr(existing, field, val)
            if domain and not existing.domain:
                existing.domain = domain
            if corp_num and not existing.corporate_number:
                existing.corporate_number = corp_num
            existing.search_text = search_text
            existing.last_scraped_at = datetime.utcnow()
        else:
            master_fields = {k: v for k, v in company_data.items() if hasattr(CompanyMaster, k)}
            master_fields["domain"] = domain or None
            master_fields["corporate_number"] = corp_num
            master_fields["source"] = source
            master_fields["search_text"] = search_text
            master_fields["last_scraped_at"] = datetime.utcnow()
            master_fields.pop("id", None)
            master_fields.pop("project_id", None)
            master_fields.pop("status", None)
            master_fields.pop("notes", None)
            master_fields.pop("score_adjustment", None)
            db.add(CompanyMaster(**master_fields))
        db.commit()
    except Exception as e:
        logger.warning(f"CompanyMaster upsert failed for {domain or corp_num}: {e}")
        db.rollback()


def collect_by_keyword(keyword_id: int, db: Session, project_id: int = None) -> dict:
    keyword = db.query(SearchKeyword).filter(SearchKeyword.id == keyword_id).first()
    if not keyword:
        return {"error": "キーワードが見つかりません"}

    if project_id is None:
        project_id = keyword.project_id

    api_key_setting = db.query(AppSetting).filter(AppSetting.setting_key == "google_api_key").first()
    cx_setting = db.query(AppSetting).filter(AppSetting.setting_key == "google_cx").first()

    if not api_key_setting or not api_key_setting.setting_value:
        return {"error": "Google API Keyが設定されていません。設定画面で登録してください。"}
    if not cx_setting or not cx_setting.setting_value:
        return {"error": "Search Engine ID (cx)が設定されていません。設定画面で登録してください。"}

    query = keyword.keyword
    if keyword.region:
        query += f" {keyword.region}"

    rej_q = db.query(RejectedUrl.domain)
    comp_q = db.query(Company.domain)
    if project_id:
        rej_q = rej_q.filter(RejectedUrl.project_id == project_id)
        comp_q = comp_q.filter(Company.project_id == project_id)
    rejected_domains = set(r.domain for r in rej_q.all())
    existing_domains = set(c.domain for c in comp_q.all())

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

    results = _process_search_results(search_results, db, rejected_domains, existing_domains, project_id=project_id)

    summary = {
        "keyword": keyword.keyword,
        "total": len(results),
        "success": sum(1 for r in results if r["status"] == "success"),
        "duplicate": sum(1 for r in results if r["status"] == "duplicate"),
        "rejected": sum(1 for r in results if r["status"] == "rejected"),
        "error": sum(1 for r in results if r["status"] == "error"),
    }

    log = CollectionLog(
        project_id=project_id,
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

    if summary["success"] >= 1:
        _send_collection_slack(db, project_id, keyword.keyword, summary, results)

    return {"results": results, "summary": summary}


def _send_collection_slack(db: Session, project_id, source: str, summary: dict, results: list):
    try:
        webhook_row = db.query(AppSetting).filter(AppSetting.setting_key == "slack_webhook_url").first()
        if not webhook_row or not webhook_row.setting_value:
            return
        from server.services.slack import send_slack_notification
        from server.models import Project
        project_name = "不明"
        if project_id:
            p = db.query(Project).filter(Project.id == project_id).first()
            if p:
                project_name = p.name
        rank_a = sum(1 for r in results if r.get("status") == "success" and "A" in r.get("message", ""))
        rank_b = sum(1 for r in results if r.get("status") == "success" and "B" in r.get("message", ""))
        msg = (
            f"✅ 収集完了: {project_name} / {source}\n"
            f"新規 {summary['success']}件  除外 {summary['rejected']}件  重複 {summary['duplicate']}件"
        )
        send_slack_notification(msg, webhook_row.setting_value)
    except Exception as e:
        logger.warning(f"Slack通知エラー: {e}")


def _process_search_results(
    search_results: list[dict],
    db: Session,
    rejected_domains: set,
    existing_domains: set,
    project_id: int = None,
) -> list[dict]:
    results = []
    urls_to_scrape = []
    url_indices = []

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

        urls_to_scrape.append(url)
        url_indices.append(len(results))
        results.append(None)

    if urls_to_scrape:
        scraped_results = scrape_urls_parallel(urls_to_scrape, max_workers=5)

        for i, info in enumerate(scraped_results):
            url = urls_to_scrape[i]
            idx = url_indices[i]
            domain = normalize_domain(urlparse(url).netloc)

            if not info or "error" in info:
                results[idx] = {
                    "url": url, "status": "error",
                    "message": info.get("error", "スクレイピング失敗") if info else "スクレイピング失敗",
                }
                continue

            full_text = info.pop("full_text", "")
            category_main, category_sub = categorize_company(full_text)
            cms_type = info.get("cms_type") or None
            flags = detect_flags(full_text, cms_type=cms_type)

            company_data = {
                **info,
                "category_main": category_main,
                "category_sub": category_sub,
                **flags,
            }

            score, rank = calculate_score(company_data)
            company_data["score_total"] = score
            company_data["score_rank"] = rank

            company_fields = {k: v for k, v in company_data.items() if hasattr(Company, k)}
            if project_id:
                company_fields["project_id"] = project_id
            company = Company(**company_fields)
            db.add(company)
            db.commit()
            db.refresh(company)
            existing_domains.add(domain)

            _upsert_company_master(db, company_data, domain, source="auto")

            results[idx] = {
                "url": url, "status": "success",
                "message": f"{company.company_name or domain} (スコア: {score})",
                "company_id": company.id,
            }

    return [r for r in results if r is not None]


def process_urls_to_companies(
    url_items: list[dict],
    db: Session,
    source: str = "scrape",
    project_id: int = None,
) -> dict:
    rej_q = db.query(RejectedUrl.domain)
    comp_q = db.query(Company.domain)
    if project_id:
        rej_q = rej_q.filter(RejectedUrl.project_id == project_id)
        comp_q = comp_q.filter(Company.project_id == project_id)
    rejected_domains = set(r.domain for r in rej_q.all())
    existing_domains = set(c.domain for c in comp_q.all())

    search_results = [{"url": item.get("url", ""), "title": item.get("title", "")} for item in url_items]
    results = _process_search_results(search_results, db, rejected_domains, existing_domains, project_id=project_id)

    summary = {
        "source": source,
        "total": len(results),
        "success": sum(1 for r in results if r["status"] == "success"),
        "duplicate": sum(1 for r in results if r["status"] == "duplicate"),
        "rejected": sum(1 for r in results if r["status"] == "rejected"),
        "error": sum(1 for r in results if r["status"] == "error"),
    }

    log = CollectionLog(
        project_id=project_id,
        keyword_text=f"[{source}]",
        total_found=summary["total"],
        success_count=summary["success"],
        duplicate_count=summary["duplicate"],
        rejected_count=summary["rejected"],
        error_count=summary["error"],
    )
    db.add(log)
    db.commit()

    if summary["success"] >= 1:
        _send_collection_slack(db, project_id, source, summary, results)

    return {"results": results, "summary": summary}
