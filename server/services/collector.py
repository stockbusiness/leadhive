import re
import logging
import threading
from datetime import datetime
from urllib.parse import urlparse
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from server.models import AppSetting, Company, CompanyMaster, RejectedUrl, SearchKeyword, CollectionLog
from server.services.scraper import scrape_company_info, scrape_urls_parallel
from server.services.categorizer import categorize_company, detect_flags
from server.services.scorer import calculate_score
from server.services.aggregator import normalize_domain, is_aggregator_site
from server.services.serper_search import search_serper, get_serper_api_key

logger = logging.getLogger(__name__)

_job_store: dict[str, dict] = {}
_job_store_lock = threading.Lock()


def _persist_job_log(job_id: str, data: dict):
    try:
        from server.database import SessionLocal
        from server.models import JobLog
        from datetime import datetime as dt
        db = SessionLocal()
        try:
            row = db.query(JobLog).filter(JobLog.job_id == job_id).first()
            if row is None:
                row = JobLog(job_id=job_id)
                db.add(row)
            row.job_type = data.get("job_type", row.job_type)
            row.status = data.get("status", row.status or "running")
            row.message = data.get("message", row.message)
            row.current = data.get("current", row.current or 0)
            row.total = data.get("total", row.total or 0)
            row.source_count = data.get("source_count", row.source_count or 0)
            row.saved_count = data.get("saved_count", row.saved_count or 0)
            row.error_count = data.get("error_count", row.error_count or 0)
            if data.get("type") in ("done", "error"):
                row.finished_at = dt.utcnow()
            db.commit()
        except Exception as e:
            logger.warning(f"job_log DB persist error: {e}")
        finally:
            db.close()
    except Exception as e:
        logger.warning(f"job_log persist outer error: {e}")


def job_update(job_id: str, **kwargs):
    with _job_store_lock:
        if job_id not in _job_store:
            _job_store[job_id] = {}
        _job_store[job_id].update(kwargs)
    event_type = kwargs.get("type", "")
    if event_type in ("done", "error") or (event_type == "progress" and not _job_store.get(job_id, {}).get("_db_created")):
        threading.Thread(target=_persist_job_log, args=(job_id, {**_job_store.get(job_id, {}), **kwargs}), daemon=True).start()
        with _job_store_lock:
            _job_store.setdefault(job_id, {})["_db_created"] = True


def job_get(job_id: str) -> dict | None:
    with _job_store_lock:
        return dict(_job_store.get(job_id, {}))


def job_cleanup(job_id: str):
    with _job_store_lock:
        _job_store.pop(job_id, None)


def _detect_ec_platform_from_url(url: str, title: str = "", snippet: str = "") -> dict:
    """URLパターン・タイトル・スニペットからECプラットフォームとフラグを判定する（スクレイピング不要）。"""
    netloc = urlparse(url).netloc.lower()
    url_lower = url.lower()
    combined = f"{title} {snippet}".lower()

    flags: dict = {
        "ec_flag": True,
        "shopify_flag": False,
        "base_flag": False,
        "stores_flag": False,
        "makeshop_flag": False,
        "futureshop_flag": False,
        "rakuten_flag": False,
        "amazon_flag": False,
        "cms_type": None,
        "ec_score": 0,
    }

    # プラットフォーム検出（URLベース）
    if "myshopify.com" in netloc or "shopify" in netloc:
        flags["shopify_flag"] = True
        flags["cms_type"] = "Shopify"
        flags["ec_score"] = 80
    elif "base.shop" in netloc or "thebase.in" in netloc:
        flags["base_flag"] = True
        flags["cms_type"] = "BASE"
        flags["ec_score"] = 75
    elif "stores.jp" in netloc:
        flags["stores_flag"] = True
        flags["cms_type"] = "STORES"
        flags["ec_score"] = 75
    elif "makeshop.jp" in netloc:
        flags["makeshop_flag"] = True
        flags["cms_type"] = "MakeShop"
        flags["ec_score"] = 75
    elif "futureshop.jp" in netloc:
        flags["futureshop_flag"] = True
        flags["cms_type"] = "futureshop"
        flags["ec_score"] = 75
    elif "shop-pro.jp" in netloc or "colormelabo.jp" in netloc:
        flags["cms_type"] = "カラーミー"
        flags["ec_score"] = 70
    elif "wixsite.com" in netloc or "wix.com" in netloc:
        flags["cms_type"] = "Wix"
        flags["ec_score"] = 40
    elif "shoplogic.jp" in netloc:
        flags["cms_type"] = "ショップサーブ"
        flags["ec_score"] = 70
    elif "lolipop.jp" in netloc:
        flags["cms_type"] = "ロリポップEC"
        flags["ec_score"] = 55
    elif "rakuten.co.jp" in netloc or "rshop.to" in netloc:
        flags["rakuten_flag"] = True
        flags["cms_type"] = "楽天市場"
        flags["ec_score"] = 60
    elif "amazon.co.jp" in netloc or "amazon.com" in netloc:
        flags["amazon_flag"] = True
        flags["cms_type"] = "Amazon"
        flags["ec_score"] = 50
    elif "store.shopping.yahoo.co.jp" in netloc or "shopping.yahoo.co.jp" in netloc:
        flags["cms_type"] = "Yahoo!ショッピング"
        flags["ec_score"] = 60
    elif "next-engine.com" in netloc or "next-engine.org" in netloc:
        flags["cms_type"] = "NEXT ENGINE"
        flags["ec_score"] = 65
    elif "ec-cube.net" in netloc or "cube.ne.jp" in netloc:
        flags["cms_type"] = "EC-CUBE"
        flags["ec_score"] = 70
    elif "aishipr.com" in netloc or "aiship.jp" in netloc:
        flags["cms_type"] = "aishipR"
        flags["ec_score"] = 65
    elif "cart.jp" in netloc:
        flags["cms_type"] = "カートジェイピー"
        flags["ec_score"] = 60
    elif "canmake.co.jp" in netloc or "meishodo.co.jp" in netloc:
        # 既知の独自ECブランドのパターンは除外（誤検知防止）
        flags["cms_type"] = "独自EC"
        flags["ec_score"] = 65
    else:
        # URLパターンなし → タイトル・スニペットから軽量スコア
        ec_kws = ["通販", "ネットショップ", "オンラインショップ", "ec", "ショッピング", "shop", "store",
                  "d2c", "自社ec", "定期便", "お取り寄せ"]
        ec_kws_strong = ["ネットショップ", "通販サイト", "公式オンラインストア", "公式通販", "自社ec", "公式ショップ"]
        score = 30  # EC discovery のキーワードで見つかった時点でベーススコア
        for kw in ec_kws_strong:
            if kw in combined:
                score += 15
                break
        for kw in ec_kws:
            if kw in combined:
                score += 10
                break

        # WooCommerce検出（URLパス・スニペットベース）
        woo_signals = ["woocommerce", "wp-content/plugins/woocommerce", "add-to-cart", "?add-to-cart="]
        if any(s in url_lower for s in woo_signals) or "woocommerce" in combined:
            flags["cms_type"] = "WooCommerce"
            score = max(score, 70)
        # 特商法ページ検出（自社EC運営の強いシグナル）
        elif "tokushoho" in url_lower or "law.html" in url_lower or "legal.html" in url_lower:
            score = max(score, 50)
        # カート・決済ページシグナル
        elif any(s in url_lower for s in ["/cart", "/checkout", "/basket", "/カート", "/purchase"]):
            score = max(score, 55)

        flags["ec_score"] = min(score, 100)

    return flags


_EC_POSITIVE_KEYWORDS = [
    "通販", "ネットショップ", "オンラインショップ", "公式ショップ", "公式ストア",
    "公式通販", "自社ec", "d2c", "定期便", "お取り寄せ", "カート", "購入",
    "ショッピング", "shop", "store", "ec", "ecommerce", "買う", "注文",
    "オンライン販売", "直販", "直売", "通信販売",
]

_NON_EC_TITLE_PATTERNS = [
    r"^\[PDF\]", r"^PDF\s", r"\[PDF\]", r"\.pdf$",
    r"とは(何か|どんな|[\?？\s])", r"メリット.*デメリット", r"デメリット.*メリット",
    r"解説(記事|コラム)?$", r"入門", r"基礎知識",
    r"号\s*[-–―]\s*", r"アーカイブ", r"懸賞", r"報告書", r"統合報告",
    r"論文", r"学術", r"授業", r"シラバス",
    r"年\d+月", r"短期大学", r"大学院", r"専門学校",
    r"プレスリリース", r"ニュースリリース", r"お知らせ$",
    r"\d{4}年\d+月\d+日",
]

def _normalize_to_homepage(url: str) -> str:
    """URLをサイトのトップページに正規化する。
    例: https://example.com/about/company → https://example.com/
    サブドメインは保持（shop.example.com → shop.example.com/）
    """
    try:
        parsed = urlparse(url)
        return f"{parsed.scheme}://{parsed.netloc}/"
    except Exception:
        return url


def _is_likely_ec_shop(url: str, title: str, snippet: str, platform_flags: dict) -> tuple[bool, str]:
    """EC shopである可能性が高いかどうかを判定する（軽量チェック）。
    URLはSerperが返した元のURLで判定し、保存時にホームページに正規化する。
    Returns (is_ec, reject_reason). reject_reason が空文字なら通過。
    """
    url_lower = url.lower()
    title_lower = title.lower()
    combined = f"{title} {snippet}".lower()

    # 1. PDFチェック（最優先）
    if url_lower.endswith(".pdf") or re.search(r"\.pdf($|\?|#)", url_lower):
        return False, "PDFファイル"
    if re.search(r"^\s*\[pdf\]", title_lower) or title_lower.startswith("[pdf]"):
        return False, "PDFファイル（タイトル）"

    # 2. 明らかなブログ記事URL（日付3階層: /2022/06/15/）
    path = urlparse(url).path
    if re.search(r"/\d{4}/\d{2}/\d{2}/", path):
        return False, "ブログ記事URL（日付3階層）"

    # 3. タイトルの非ECパターン
    for pattern in _NON_EC_TITLE_PATTERNS:
        if re.search(pattern, title, re.IGNORECASE):
            return False, f"非ECタイトルパターン: {pattern}"

    # 4. 学術・官公庁ドメイン
    netloc = urlparse(url).netloc.lower()
    if netloc.endswith(".ac.jp") or netloc.endswith(".go.jp") or netloc.endswith(".ed.jp"):
        return False, "学術・官公庁ドメイン"

    # 5. EC信頼性チェック: プラットフォーム検出なし かつ EC陽性シグナルが皆無の場合は除外
    has_platform = bool(platform_flags.get("cms_type"))
    if not has_platform:
        has_positive = any(kw in combined for kw in _EC_POSITIVE_KEYWORDS)
        if not has_positive:
            return False, "ECシグナルなし（プラットフォーム未検出・キーワードなし）"

    return True, ""


def _save_ec_from_search_results_lightweight(
    search_results: list[dict],
    db: Session,
    rejected_domains: set,
    existing_domains: set,
    project_id: int = None,
    scoring_rules: dict = None,
    org_id: int = None,
) -> list[dict]:
    """スクレイピングなしでSerper検索結果から直接ECサイトを保存する。
    EC Discovery専用の高速版。1件あたり数ms以内で完了する。
    """
    results = []

    for sr in search_results:
        url = sr.get("url", "")
        title = sr.get("title", "") or ""
        snippet = sr.get("snippet", "") or ""

        if not url:
            continue

        # ★ 先にホームページURLに正規化する（/blog/ や /news/ パスによる誤除外を防ぐ）
        homepage_url = _normalize_to_homepage(url)
        domain = normalize_domain(urlparse(homepage_url).netloc)

        if domain in rejected_domains:
            results.append({"url": url, "status": "rejected", "message": "拒否リストに登録済み"})
            continue

        # プラットフォーム判定（正規化URLで実行）
        platform_flags = _detect_ec_platform_from_url(homepage_url, title, snippet)

        # EC適格性チェック（正規化URLで実行: PDFパスや日付パスはホームページには存在しない）
        is_ec, reject_reason = _is_likely_ec_shop(homepage_url, title, snippet, platform_flags)
        if not is_ec:
            results.append({"url": url, "status": "rejected", "message": f"EC非適格: {reject_reason}"})
            continue

        # アグリゲーターチェック（正規化URLで実行: /blog/ 等サブパスを持つEC店舗を誤除外しない）
        is_agg, reason = is_aggregator_site(homepage_url, title)
        if is_agg:
            existing_rej = db.query(RejectedUrl).filter(RejectedUrl.domain == domain).first()
            if not existing_rej:
                db.add(RejectedUrl(domain=domain, url=homepage_url, reason=reason))
                try:
                    db.commit()
                except Exception:
                    db.rollback()
                rejected_domains.add(domain)
            results.append({"url": url, "status": "rejected", "message": f"まとめサイトとして除外: {reason}"})
            continue

        if domain in existing_domains:
            results.append({"url": url, "status": "duplicate", "message": "既に登録済み"})
            continue

        company_name = title.strip() if title else domain
        # タイトルが長すぎる場合は短縮
        if len(company_name) > 200:
            company_name = company_name[:200]

        company_data = {
            "website_url": homepage_url,
            "domain": domain,
            "company_name": company_name,
            "ec_flag": platform_flags["ec_flag"],
            "ec_score": platform_flags["ec_score"],
            "shopify_flag": platform_flags["shopify_flag"],
            "base_flag": platform_flags["base_flag"],
            "stores_flag": platform_flags["stores_flag"],
            "makeshop_flag": platform_flags["makeshop_flag"],
            "futureshop_flag": platform_flags["futureshop_flag"],
            "rakuten_flag": platform_flags["rakuten_flag"],
            "amazon_flag": platform_flags["amazon_flag"],
            "cms_type": platform_flags["cms_type"],
            "escms_target_flag": bool(
                platform_flags["ec_flag"] and
                platform_flags["cms_type"] and
                platform_flags["cms_type"] != "Shopify"
            ),
        }

        if project_id:
            company_data["project_id"] = project_id
        if org_id:
            company_data["org_id"] = org_id

        score, rank = calculate_score(company_data, custom_rules=scoring_rules if scoring_rules else None, db=db if not scoring_rules else None)
        company_data["score_total"] = score
        company_data["score_rank"] = rank

        company_fields = {k: v for k, v in company_data.items() if hasattr(Company, k)}
        company = Company(**company_fields)
        try:
            db.add(company)
            db.commit()
            db.refresh(company)
        except IntegrityError:
            db.rollback()
            existing_domains.add(domain)
            results.append({"url": url, "status": "duplicate", "message": "既に登録済み（DB重複スキップ）"})
            continue
        except Exception as e:
            db.rollback()
            results.append({"url": url, "status": "error", "message": f"DB保存エラー: {e}"})
            continue

        existing_domains.add(domain)

        if rank == "A":
            try:
                from server.services.slack_notifier import notify_rank_a_company
                notify_rank_a_company(db, company.company_name or domain, domain=domain)
            except Exception:
                pass

        try:
            _upsert_company_master(db, company_data, domain, source="ec_discovery")
        except IntegrityError:
            db.rollback()
        except Exception:
            pass

        results.append({
            "url": url, "status": "success",
            "message": f"{company_name} (スコア: {score}, {platform_flags['cms_type'] or 'EC'})",
            "company_id": company.id,
        })

    return results


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
                          "shopify_flag", "ec_flag", "ec_score", "amazon_flag", "rakuten_flag",
                          "consulting_flag", "operation_flag", "production_flag",
                          "score_total", "score_rank",
                          "cms_type", "cms_detected_at", "sns_links",
                          "sns_instagram_url", "sns_x_url", "sns_facebook_url",
                          "sns_youtube_url", "sns_tiktok_url", "sns_line_url", "sns_count",
                          "has_recruitment", "employee_count", "escms_target_flag", "robots_disallow"]:
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


def collect_by_keyword(keyword_id: int, db: Session, project_id: int = None, org_id: int = None) -> dict:
    keyword = db.query(SearchKeyword).filter(SearchKeyword.id == keyword_id).first()
    if not keyword:
        return {"error": "キーワードが見つかりません"}

    if project_id is None:
        project_id = keyword.project_id

    from server.models import Project
    project_scoring_rules = None
    if project_id:
        proj = db.query(Project).filter(Project.id == project_id).first()
        if proj:
            if proj.scoring_rules:
                project_scoring_rules = proj.scoring_rules
            if org_id is None:
                org_id = proj.org_id

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

    serper_key = get_serper_api_key(db=db, org_id=org_id)
    if not serper_key:
        return {"error": "Serper APIキーが設定されていません。設定画面でSerper APIキーを登録してください。"}
    search_results = search_serper(serper_key, query, num=30)
    search_engine = "serper"

    if search_results and "error" in search_results[0]:
        return {"error": f"検索APIエラー ({search_engine}): {search_results[0]['error']}"}

    results = _process_search_results(search_results, db, rejected_domains, existing_domains, project_id=project_id, scoring_rules=project_scoring_rules)

    summary = {
        "keyword": keyword.keyword,
        "total": len(results),
        "success": sum(1 for r in results if r["status"] == "success"),
        "duplicate": sum(1 for r in results if r["status"] == "duplicate"),
        "rejected": sum(1 for r in results if r["status"] == "rejected"),
        "error": sum(1 for r in results if r["status"] == "error"),
    }

    try:
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
    except Exception as log_err:
        logger.warning(f"CollectionLog保存エラー（無視）: {log_err}")
        try:
            db.rollback()
        except Exception:
            pass

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
        from server.services.encryption import decrypt_value as _dv
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
        send_slack_notification(msg, _dv(webhook_row.setting_value))
    except Exception as e:
        logger.warning(f"Slack通知エラー: {e}")


def _process_search_results(
    search_results: list[dict],
    db: Session,
    rejected_domains: set,
    existing_domains: set,
    project_id: int = None,
    scoring_rules: dict = None,
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
        scraped_results = scrape_urls_parallel(urls_to_scrape, max_workers=8)

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

            scraper_ec_score = info.pop("ec_score", None)
            scraper_ec_flag = info.pop("ec_flag", None)

            company_data = {
                **info,
                "category_main": category_main,
                "category_sub": category_sub,
                **flags,
            }

            if scraper_ec_score is not None:
                company_data["ec_score"] = scraper_ec_score
            if scraper_ec_flag is not None:
                company_data["ec_flag"] = scraper_ec_flag

            escms_flag = bool(
                company_data.get("ec_flag") and
                cms_type and cms_type != "Shopify"
            )
            company_data["escms_target_flag"] = escms_flag

            score, rank = calculate_score(company_data, custom_rules=scoring_rules if scoring_rules else None, db=db if not scoring_rules else None)
            company_data["score_total"] = score
            company_data["score_rank"] = rank

            company_fields = {k: v for k, v in company_data.items() if hasattr(Company, k)}
            if project_id:
                company_fields["project_id"] = project_id
            company = Company(**company_fields)
            try:
                db.add(company)
                db.commit()
                db.refresh(company)
            except IntegrityError:
                db.rollback()
                existing_domains.add(domain)
                results[idx] = {
                    "url": url, "status": "duplicate",
                    "message": "既に登録済み（DB重複スキップ）",
                }
                continue
            except Exception as e:
                db.rollback()
                results[idx] = {
                    "url": url, "status": "error",
                    "message": f"DB保存エラー: {e}",
                }
                continue

            existing_domains.add(domain)

            if rank == "A":
                try:
                    from server.services.slack_notifier import notify_rank_a_company
                    notify_rank_a_company(db, company.company_name or domain, domain=domain)
                except Exception:
                    pass

            try:
                _upsert_company_master(db, company_data, domain, source="auto")
            except IntegrityError:
                db.rollback()
            except Exception:
                pass

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
