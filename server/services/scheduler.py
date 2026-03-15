import threading
import time
import random
import logging
from datetime import datetime, date

logger = logging.getLogger(__name__)

_scheduler_thread = None
_scheduler_running = False
_scheduler_lock = threading.Lock()


def _run_auto_collect():
    from server.database import SessionLocal
    from server.models import AppSetting, SearchKeyword, SystemSettings
    from server.services.collector import collect_by_keyword
    import os

    db = SessionLocal()
    try:
        enabled = db.query(AppSetting).filter(AppSetting.setting_key == "auto_collect_enabled").first()
        if not enabled or enabled.setting_value != "true":
            return

        keywords = db.query(SearchKeyword).filter(SearchKeyword.is_active == True).all()
        if not keywords:
            logger.info("Auto-collect: No active keywords")
            return

        # 使用する検索エンジンを確認してログ出力
        serper_env = os.environ.get("SERPER_API_KEY", "")
        serper_sys = db.query(SystemSettings).filter(SystemSettings.key == "serper_api_key").first()
        has_serper = bool(serper_env) or bool(serper_sys and serper_sys.value)

        if has_serper:
            logger.info(f"Auto-collect: Search engine = Serper API ({len(keywords)} keywords)")
        else:
            # Google CSEが設定済みか確認
            any_google = False
            for kw in keywords:
                if kw.project_id:
                    from server.models import Organization
                    proj_db_row = db.execute(
                        __import__("sqlalchemy").text("SELECT org_id FROM projects WHERE id=:pid"),
                        {"pid": kw.project_id}
                    ).fetchone()
                    if proj_db_row:
                        google_key = db.query(AppSetting).filter(
                            AppSetting.setting_key == "google_api_key",
                            AppSetting.org_id == proj_db_row[0]
                        ).first()
                        if google_key and google_key.setting_value:
                            any_google = True
                            break
            if any_google:
                logger.info(f"Auto-collect: Search engine = Google CSE ({len(keywords)} keywords)")
            else:
                logger.warning("Auto-collect: 検索APIが設定されていません。システム管理画面でSerper APIキーを設定してください。")

        logger.info(f"Auto-collect: Starting collection for {len(keywords)} keywords")
        total_success = 0
        for kw in keywords:
            try:
                result = collect_by_keyword(kw.id, db)
                if "error" in result:
                    logger.warning(f"Auto-collect: '{kw.keyword}' - {result['error']}")
                else:
                    success = result.get("summary", {}).get("success", 0)
                    total_success += success
                    logger.info(f"Auto-collect: '{kw.keyword}' (Google/Serper) - {success} new companies")
            except Exception as e:
                logger.error(f"Auto-collect error for '{kw.keyword}': {e}")

            if not kw.project_id:
                continue
            try:
                import sqlalchemy as _sa
                proj_row = db.execute(
                    _sa.text("SELECT org_id FROM projects WHERE id=:pid"),
                    {"pid": kw.project_id},
                ).fetchone()
                if not proj_row:
                    continue
                org_id = proj_row[0]
                gbiz_token = db.query(AppSetting).filter(
                    AppSetting.setting_key == "gbiz_token",
                    AppSetting.org_id == org_id,
                ).first()
                if not gbiz_token or not gbiz_token.setting_value:
                    continue
                import uuid as _uuid
                from server.services.collector import job_update
                from server.services.gbiz_collector import collect_from_gbiz
                gbiz_job_id = str(_uuid.uuid4())
                gbiz_db = SessionLocal()
                try:
                    gbiz_result = collect_from_gbiz(
                        job_id=gbiz_job_id,
                        project_id=kw.project_id,
                        org_id=org_id,
                        keyword=kw.keyword,
                        prefecture=kw.region or "",
                        max_results=20,
                        db=gbiz_db,
                    )
                    gbiz_success = gbiz_result.get("summary", {}).get("success", 0)
                    total_success += gbiz_success
                    logger.info(f"Auto-collect: '{kw.keyword}' (gBizINFO) - {gbiz_success} new companies")
                except Exception as ge:
                    logger.warning(f"Auto-collect gBizINFO skip '{kw.keyword}': {ge}")
                finally:
                    gbiz_db.close()
            except Exception as e:
                logger.error(f"Auto-collect gBizINFO outer error '{kw.keyword}': {e}")

        logger.info(f"Auto-collect: Collection complete — {total_success} total new companies")
    except Exception as e:
        logger.error(f"Auto-collect error: {e}")
    finally:
        db.close()


def _run_followup_notify():
    from server.database import SessionLocal
    from server.models import AppSetting, Company, User, Organization
    from server.services.mailer import get_smtp_settings, send_email
    from server.services.slack import send_slack_notification
    from sqlalchemy import and_

    db = SessionLocal()
    try:
        today = date.today()

        orgs = db.query(Organization).all()
        for org in orgs:
            enabled = db.query(AppSetting).filter(
                AppSetting.setting_key == "followup_notify_enabled",
                AppSetting.org_id == org.id,
            ).first()
            if not enabled or enabled.setting_value != "true":
                continue

            channel_setting = db.query(AppSetting).filter(
                AppSetting.setting_key == "followup_notify_channel",
                AppSetting.org_id == org.id,
            ).first()
            channel = channel_setting.setting_value if channel_setting else "email"

            companies = (
                db.query(Company)
                .filter(
                    Company.project_id.in_(
                        db.query(Company.project_id).distinct()
                    ),
                    Company.follow_up_date <= today,
                    Company.follow_up_date.isnot(None),
                )
                .all()
            )

            from server.models import Project
            org_project_ids = [p.id for p in db.query(Project).filter(Project.org_id == org.id).all()]
            companies = [c for c in companies if c.project_id in org_project_ids]

            if not companies:
                continue

            logger.info(f"Followup notify: {len(companies)} companies for org {org.id}")

            overdue = [c for c in companies if c.follow_up_date < today]
            due_today = [c for c in companies if c.follow_up_date == today]

            lines = []
            if due_today:
                lines.append(f"【本日が期限】{len(due_today)}件")
                for c in due_today[:10]:
                    lines.append(f"  ・{c.company_name or c.domain} ({c.status})")
            if overdue:
                lines.append(f"【期限超過】{len(overdue)}件")
                for c in overdue[:10]:
                    lines.append(f"  ・{c.company_name or c.domain} 期限:{c.follow_up_date} ({c.status})")

            summary_text = "\n".join(lines)

            if channel in ("slack", "both"):
                webhook = db.query(AppSetting).filter(
                    AppSetting.setting_key == "slack_webhook_url",
                    AppSetting.org_id == org.id,
                ).first()
                if webhook and webhook.setting_value:
                    from server.services.encryption import decrypt_value as _dv
                    slack_msg = f"📅 *LeadHive フォローアップ通知* ({today.strftime('%Y/%m/%d')})\n{summary_text}"
                    send_slack_notification(slack_msg, _dv(webhook.setting_value))

            if channel in ("email", "both"):
                admins = db.query(User).filter(
                    User.org_id == org.id,
                    User.role == "admin",
                ).all()
                smtp_cfg = get_smtp_settings(db, org.id)
                if smtp_cfg.get("smtp_host"):
                    html_lines = [
                        "<h2>LeadHive フォローアップ通知</h2>",
                        f"<p>{today.strftime('%Y年%m月%d日')} 時点のフォローアップ期限企業です。</p>",
                    ]
                    if due_today:
                        html_lines.append(f"<h3>本日が期限（{len(due_today)}件）</h3><ul>")
                        for c in due_today[:20]:
                            html_lines.append(f"<li>{c.company_name or c.domain} — ステータス: {c.status}</li>")
                        html_lines.append("</ul>")
                    if overdue:
                        html_lines.append(f"<h3>期限超過（{len(overdue)}件）</h3><ul>")
                        for c in overdue[:20]:
                            html_lines.append(f"<li>{c.company_name or c.domain} 期限:{c.follow_up_date} — ステータス: {c.status}</li>")
                        html_lines.append("</ul>")
                    html_body = "".join(html_lines)

                    for admin in admins:
                        if admin.email:
                            send_email(
                                to=admin.email,
                                subject=f"【LeadHive】フォローアップ期限通知 ({today.strftime('%Y/%m/%d')})",
                                html_body=html_body,
                                smtp_settings=smtp_cfg,
                                text_body=summary_text,
                            )

    except Exception as e:
        logger.error(f"Followup notify error: {e}")
    finally:
        db.close()


def _run_suspend_inactive_users():
    """30日間ログインなしのユーザーを自動停止（システム管理者は除外）"""
    from server.database import SessionLocal
    from server.models import User
    from datetime import timedelta

    db = SessionLocal()
    try:
        cutoff = datetime.utcnow() - timedelta(days=30)
        inactive_users = (
            db.query(User)
            .filter(
                User.is_active == True,
                User.is_system_admin == False,
                User.last_login_at < cutoff,
                User.last_login_at.isnot(None),
            )
            .all()
        )

        if not inactive_users:
            return

        logger.info(f"Auto-suspend: Found {len(inactive_users)} inactive users")

        for user in inactive_users:
            user.is_active = False
            logger.info(f"Auto-suspend: Deactivated user {user.email} (last login: {user.last_login_at})")

        db.commit()

        from server.services.mailer import get_smtp_settings, send_email
        for user in inactive_users:
            try:
                smtp_cfg = get_smtp_settings(db, user.org_id)
                if smtp_cfg.get("smtp_host"):
                    html_body = """
                    <p>LeadHiveのご利用ありがとうございます。</p>
                    <p>30日間ログインがなかったため、セキュリティ保護の観点からアカウントを一時停止しました。</p>
                    <p>アカウントを再開するには、管理者にお問い合わせください。</p>
                    <p style="color:#888;font-size:12px;">LeadHive 運営チーム</p>
                    """
                    send_email(
                        to=user.email,
                        subject="【LeadHive】アカウント停止のお知らせ",
                        html_body=html_body,
                        smtp_settings=smtp_cfg,
                    )
            except Exception as e:
                logger.error(f"Auto-suspend: Failed to send notification to {user.email}: {e}")

    except Exception as e:
        logger.error(f"Auto-suspend error: {e}")
    finally:
        db.close()


def _run_auto_master_collect(job_id: str = None):
    import json as _json
    import os as _os
    from server.database import SessionLocal
    from server.models import SystemSettings, CompanyMaster
    from server.services.gbiz_collector import search_gbiz, PREFECTURES
    from server.services.scraper import scrape_company_info
    from server.services.aggregator import normalize_domain, is_aggregator_site
    from server.services.categorizer import categorize_company, detect_flags
    from server.services.scorer import calculate_score
    from server.services.collector import _upsert_company_master, job_update

    def _sys_get(db, key, default=""):
        row = db.query(SystemSettings).filter(SystemSettings.key == key).first()
        return row.value if row and row.value else default

    def _sys_set(db, key, value):
        row = db.query(SystemSettings).filter(SystemSettings.key == key).first()
        if row:
            row.value = str(value)
        else:
            db.add(SystemSettings(key=key, value=str(value)))
        db.commit()

    # 市区町村データ読み込み
    _data_path = _os.path.join(_os.path.dirname(__file__), "..", "data", "municipalities.json")
    try:
        with open(_data_path, "r", encoding="utf-8") as _f:
            MUNICIPALITIES = _json.load(_f)
    except Exception as _e:
        logger.error(f"AutoMaster: municipalities.json 読み込み失敗: {_e}")
        MUNICIPALITIES = []
    TOTAL_CITIES = len(MUNICIPALITIES)
    if TOTAL_CITIES == 0:
        logger.error("AutoMaster: 市区町村データが空です")
        return

    AUTO_MASTER_KEYWORDS = [
        "株式会社", "合同会社", "有限会社", "医療法人", "社会福祉法人",
        "一般社団法人", "公益社団法人", "農業法人", "学校法人",
        "特定非営利活動法人", "財団法人", "特例有限会社",
    ]

    db = SessionLocal()
    try:
        from server.services.encryption import decrypt_value as _dv_enc
        _raw_token = _sys_get(db, "gbizinfo_api_token")
        token = (
            _os.environ.get("GbizAPIkey")
            or _os.environ.get("GBIZINFO_API_TOKEN")
            or _os.environ.get("GBIZ_API_TOKEN")
            or (_dv_enc(_raw_token) if _raw_token else None)
        )
        if not token:
            msg = "gBizINFO APIトークンが設定されていません"
            logger.warning(f"AutoMaster: {msg}")
            if job_id:
                job_update(job_id, type="error", message=msg)
            return

        city_idx = int(_sys_get(db, "auto_master_city_idx", "0")) % TOTAL_CITIES
        keyword_idx = int(_sys_get(db, "auto_master_keyword_idx", "0")) % len(AUTO_MASTER_KEYWORDS)
        start_page = max(1, int(_sys_get(db, "auto_master_page_idx", "1")))
        max_companies = max(100, min(50000, int(_sys_get(db, "auto_master_max_companies", "1000"))))
        max_enrich = max(0, min(50, int(_sys_get(db, "auto_master_max_enrich", "10"))))
        max_pages_per_combo = max(1, min(100, int(_sys_get(db, "auto_master_max_pages_per_combo", "10"))))

        logger.info(
            f"AutoMaster: Starting city_idx={city_idx}/{TOTAL_CITIES} "
            f"max_companies={max_companies} max_pages_per_combo={max_pages_per_combo}"
        )

        existing_corp_nums = set(
            row[0] for row in
            db.execute(
                __import__("sqlalchemy").text("SELECT corporate_number FROM company_master WHERE corporate_number IS NOT NULL")
            ).fetchall()
        )
        existing_domains = set(
            row[0] for row in
            db.execute(
                __import__("sqlalchemy").text("SELECT domain FROM company_master WHERE domain IS NOT NULL")
            ).fetchall()
        )
        logger.info(f"AutoMaster: Existing records — corp_nums={len(existing_corp_nums)}, domains={len(existing_domains)}")

        saved = 0
        skipped = 0
        enriched = 0
        enrich_count = 0
        total_fetched = 0
        resume_page = start_page
        next_label = ""

        def _advance_combo(ci, ki):
            new_ci = ci + 1
            new_ki = ki
            if new_ci >= TOTAL_CITIES:
                new_ci = 0
                new_ki = ki + 1
                if new_ki >= len(AUTO_MASTER_KEYWORDS):
                    new_ki = 0
                    logger.info("AutoMaster: Full cycle complete! Restarting from city=0, keyword=0")
            return new_ci, new_ki

        while saved < max_companies:
            current_city = MUNICIPALITIES[city_idx]
            current_keyword = AUTO_MASTER_KEYWORDS[keyword_idx]
            location_label = f"{current_city['pref_name']}・{current_city['city_name']}"

            logger.info(f"AutoMaster: Combo {location_label}/{current_keyword} p{start_page}〜 (max {max_pages_per_combo}p)")
            if job_id:
                job_update(job_id, type="progress", current=saved, total=max_companies,
                           message=f"{location_label}・{current_keyword}（p{start_page}〜）の収集中...",
                           status="running")

            combo_finished = False
            pages_this_combo = 0
            resume_page = start_page

            for page in range(start_page, start_page + 9999):
                if saved >= max_companies:
                    resume_page = page
                    break
                if pages_this_combo >= max_pages_per_combo:
                    combo_finished = True
                    break
                try:
                    result = search_gbiz(
                        token,
                        name_keyword=current_keyword,
                        pref_code=current_city["pref_code"],
                        city_code=current_city["city_code"],
                        page=page,
                    )
                    batch = result.get("companies", [])
                    if not batch:
                        combo_finished = True
                        break
                    total_fetched += len(batch)
                    pages_this_combo += 1
                    resume_page = page + 1

                    for company in batch:
                        if saved >= max_companies:
                            break
                        try:
                            corp_num = company.get("corporate_number") or None
                            if corp_num and corp_num in existing_corp_nums:
                                skipped += 1
                                continue

                            url = company.get("company_url", "") or ""
                            if not url and enrich_count < max_enrich:
                                from server.services.gbiz_collector import find_website_for_company
                                location = company.get("location", "") or ""
                                enrich_count += 1
                                url = find_website_for_company(company["name"], location, db=db, org_id=None)
                                if url:
                                    time.sleep(0.5)

                            loc = company.get("location", "") or ""
                            pref_name = current_city["pref_name"]
                            city_name = current_city["city_name"]
                            if loc:
                                for pref in PREFECTURES:
                                    if loc.startswith(pref):
                                        pref_name = pref
                                        city_name = loc[len(pref):].split("　")[0][:30]
                                        break

                            if not url:
                                company_data = {
                                    "company_name": company.get("name", ""),
                                    "prefecture": pref_name or None,
                                    "city": city_name or None,
                                    "corporate_number": corp_num,
                                    "score_total": 0,
                                    "score_rank": "D",
                                }
                                _upsert_company_master(db, company_data, domain=None, source="auto_master", corporate_number=corp_num)
                                if corp_num:
                                    existing_corp_nums.add(corp_num)
                                saved += 1
                                continue

                            from urllib.parse import urlparse as _up
                            domain = normalize_domain(_up(url).netloc)
                            if not domain or is_aggregator_site(url)[0]:
                                continue

                            if domain in existing_domains:
                                skipped += 1
                                continue

                            scraped = scrape_company_info(url) or {}
                            scraped["company_name"] = company.get("name", "")
                            scraped["website_url"] = url
                            scraped["domain"] = domain
                            scraped["corporate_number"] = corp_num
                            if not scraped.get("prefecture"):
                                scraped["prefecture"] = pref_name or None
                                scraped["city"] = city_name or None

                            full_text = scraped.get("full_text", "") or ""
                            cat_main, cat_sub = categorize_company(full_text)
                            cms_type = scraped.get("cms_type") or None
                            flags = detect_flags(full_text, cms_type=cms_type)
                            scraped.update({"category_main": cat_main, "category_sub": cat_sub, **flags})
                            score, rank = calculate_score(scraped, db=db)
                            scraped["score_total"] = score
                            scraped["score_rank"] = rank

                            _upsert_company_master(db, scraped, domain, source="auto_master", corporate_number=corp_num)
                            existing_domains.add(domain)
                            if corp_num:
                                existing_corp_nums.add(corp_num)
                            saved += 1
                            if not company.get("company_url"):
                                enriched += 1
                            time.sleep(random.uniform(2.0, 4.0))
                        except Exception as e:
                            logger.warning(f"AutoMaster: company error: {e}")
                            try:
                                db.rollback()
                            except Exception:
                                pass

                    if job_id:
                        job_update(job_id, current=saved, total=max_companies,
                                   message=f"p{page} — {location_label}・{current_keyword} 新規{saved}件 / スキップ{skipped}件")

                    if result.get("is_last_page"):
                        combo_finished = True
                        break
                    time.sleep(0.5)
                except Exception as e:
                    logger.warning(f"AutoMaster: page {page} fetch failed: {e}")
                    break

            if saved >= max_companies:
                # 目標件数達成 - 現在のページから再開
                _sys_set(db, "auto_master_page_idx", str(resume_page))
                break

            if combo_finished:
                # このコンボ完了 - 次のコンボへ
                city_idx, keyword_idx = _advance_combo(city_idx, keyword_idx)
                start_page = 1
                _sys_set(db, "auto_master_city_idx", str(city_idx))
                _sys_set(db, "auto_master_keyword_idx", str(keyword_idx))
                _sys_set(db, "auto_master_page_idx", "1")
            else:
                # エラー等で中断 - 現在のページを保存
                _sys_set(db, "auto_master_page_idx", str(resume_page))
                break

        next_city = MUNICIPALITIES[city_idx]
        next_label = f"{next_city['pref_name']}・{next_city['city_name']}/{AUTO_MASTER_KEYWORDS[keyword_idx]}（p{resume_page}〜）"

        _sys_set(db, "auto_master_last_run", datetime.utcnow().isoformat())
        _sys_set(db, "auto_master_last_count", str(saved))
        total_row = db.query(SystemSettings).filter(SystemSettings.key == "auto_master_total_collected").first()
        prev_total = int(total_row.value) if total_row and total_row.value else 0
        _sys_set(db, "auto_master_total_collected", str(prev_total + saved))

        msg = (
            f"{location_label}・{current_keyword}（p{start_page}〜） 完了: "
            f"取得{total_fetched}件 → 新規{saved}件保存 / 重複{skipped}件スキップ（URL補完: {enriched}件）"
            + (f" ※次回: {next_label}" if not combo_finished else f" ※{current_keyword}完了、次回: {next_label}")
        )
        logger.info(f"AutoMaster: {msg}")
        if job_id:
            job_update(job_id, type="done",
                       result={"location": location_label, "fetched": total_fetched, "saved": saved,
                               "skipped": skipped, "enriched": enriched, "next": next_label},
                       message=msg)

    except Exception as e:
        logger.error(f"AutoMaster error: {e}")
        if job_id:
            job_update(job_id, type="error", message=str(e))
    finally:
        db.close()


def _run_auto_generate_for_org(org_id: int):
    from server.database import SessionLocal
    from server.models import AppSetting, Company, SalesMessage, Organization, Project
    from server.services.ai_writer import generate_sales_message
    import json

    db = SessionLocal()
    try:
        def _get(key):
            row = db.query(AppSetting).filter(
                AppSetting.setting_key == key,
                AppSetting.org_id == org_id,
            ).first()
            return row.setting_value if row else None

        enabled = _get("auto_generate_enabled")
        if enabled != "true":
            return

        try:
            statuses = json.loads(_get("auto_generate_statuses") or '["未確認","アプローチ前"]')
        except Exception:
            statuses = ["未確認", "アプローチ前"]
        min_score = int(_get("auto_generate_min_score") or "0")
        max_per_run = int(_get("auto_generate_max_per_run") or "10")
        template_type = _get("auto_generate_template_type") or "shopify"
        project_id_raw = _get("auto_generate_project_id")
        project_id = int(project_id_raw) if project_id_raw else None

        score_order = {"A": 4, "B": 3, "C": 2, "D": 1}
        SCORE_LABELS = {"A": 4, "B": 3, "C": 2, "D": 1}

        project_ids = []
        if project_id:
            project_ids = [project_id]
        else:
            projects = db.query(Project).filter(
                Project.org_id == org_id,
                Project.is_active == True,
            ).all()
            project_ids = [p.id for p in projects]

        if not project_ids:
            logger.info(f"AutoGenerate org={org_id}: no projects found")
            return

        already_drafted = set(
            r[0] for r in db.query(SalesMessage.company_id).filter(
                SalesMessage.org_id == org_id,
                SalesMessage.status.in_(["draft", "ready"]),
            ).all()
        )

        candidates = db.query(Company).filter(
            Company.project_id.in_(project_ids),
            Company.status.in_(statuses),
        ).all()

        if min_score > 0:
            min_label = {4: "A", 3: "B", 2: "C", 1: "D"}.get(min_score, "D")
            allowed_scores = [lbl for lbl, val in SCORE_LABELS.items() if val >= min_score]
            candidates = [c for c in candidates if c.score_rank in allowed_scores]

        candidates = [c for c in candidates if c.id not in already_drafted]
        candidates.sort(key=lambda c: (-score_order.get(c.score_rank, 0), c.id))
        candidates = candidates[:max_per_run]

        if not candidates:
            logger.info(f"AutoGenerate org={org_id}: no eligible companies")
            _set_last_run(org_id, 0, db)
            return

        generated = 0
        for company in candidates:
            try:
                company_dict = {
                    "company_name": company.company_name,
                    "email": company.email or "",
                    "website": company.website or "",
                    "tel": company.tel or "",
                    "address": company.address or "",
                    "description": company.description or "",
                    "score_rank": company.score_rank or "D",
                    "score_total": company.score_total or 0,
                    "has_contact_form": company.has_contact_form or False,
                    "is_shopify": company.is_shopify or False,
                    "prefecture": company.prefecture or "",
                    "industry": company.industry or "",
                }
                result = generate_sales_message(company_dict, template_type)
                msg = SalesMessage(
                    org_id=org_id,
                    company_id=company.id,
                    project_id=company.project_id,
                    template_type=template_type,
                    subject=result["subject"],
                    body=result["body"],
                    ai_prompt_id=result["ai_prompt_id"],
                    status="draft",
                )
                db.add(msg)
                db.flush()
                generated += 1
                logger.info(f"AutoGenerate org={org_id}: generated for {company.company_name}")
            except Exception as e:
                logger.error(f"AutoGenerate org={org_id} company={company.id}: {e}")

        _set_last_run(org_id, generated, db)
        db.commit()
        logger.info(f"AutoGenerate org={org_id}: done — {generated} drafts created")
    except Exception as e:
        logger.error(f"AutoGenerate org={org_id} fatal: {e}")
    finally:
        db.close()


def _set_last_run(org_id: int, count: int, db):
    from server.models import AppSetting
    from datetime import datetime

    now_str = datetime.now().isoformat()
    for key, value in [("auto_generate_last_run_at", now_str), ("auto_generate_last_run_count", str(count))]:
        row = db.query(AppSetting).filter(
            AppSetting.setting_key == key,
            AppSetting.org_id == org_id,
        ).first()
        if row:
            row.setting_value = value
        else:
            db.add(AppSetting(org_id=org_id, setting_key=key, setting_value=value))


def _run_auto_enrich_all():
    from server.database import SessionLocal
    from server.models import Organization, Project, Company, AppSetting
    db = SessionLocal()
    try:
        orgs = db.query(Organization).all()
        for org in orgs:
            enrich_flag = db.query(AppSetting).filter(
                AppSetting.setting_key == "auto_enrich_enabled",
                AppSetting.org_id == org.id,
            ).first()
            if enrich_flag and enrich_flag.setting_value == "false":
                logger.info(f"AutoEnrich: org={org.id} は自動情報補完が無効のためスキップ")
                continue

            projects = db.query(Project).filter(Project.org_id == org.id).all()
            for project in projects:
                no_url_count = db.query(Company).filter(
                    Company.project_id == project.id,
                    (Company.website_url == None) | (Company.website_url == ""),
                ).count()
                if no_url_count == 0:
                    continue
                logger.info(f"AutoEnrich: org={org.id} project={project.id} ({no_url_count}社をURL補完)")
                import uuid as _uuid
                from server.services.collector import job_update
                job_id = str(_uuid.uuid4())
                job_update(job_id, type="progress", current=0, total=0, message="自動情報補完を開始...", status="running")
                new_db = SessionLocal()
                try:
                    from server.services.enrichment import enrich_companies_batch
                    enrich_companies_batch(
                        job_id=job_id,
                        project_id=project.id,
                        org_id=org.id,
                        db=new_db,
                        max_items=50,
                    )
                except Exception as e:
                    logger.warning(f"AutoEnrich error org={org.id} project={project.id}: {e}")
                finally:
                    new_db.close()
    except Exception as e:
        logger.error(f"AutoEnrich all error: {e}")
    finally:
        db.close()


def _run_auto_master_enrich(force: bool = False):
    from server.database import SessionLocal
    from server.models import SystemSettings, CompanyMaster
    from server.services.gbiz_collector import find_website_for_company
    from server.services.scraper import scrape_company_info
    from server.services.aggregator import normalize_domain, is_aggregator_site
    from server.services.categorizer import categorize_company, detect_flags
    from server.services.scorer import calculate_score
    from server.services.collector import _upsert_company_master
    import time as _time
    logger.info(f"AutoMasterEnrich: 開始 (force={force})")

    def _fresh_get(key, default=""):
        db = SessionLocal()
        try:
            row = db.query(SystemSettings).filter(SystemSettings.key == key).first()
            return row.value if row and row.value else default
        except Exception:
            return default
        finally:
            db.close()

    def _fresh_set(key, value):
        db = SessionLocal()
        try:
            row = db.query(SystemSettings).filter(SystemSettings.key == key).first()
            if row:
                row.value = str(value)
            else:
                db.add(SystemSettings(key=key, value=str(value)))
            db.commit()
        except Exception as e:
            logger.warning(f"AutoMasterEnrich _fresh_set error: {e}")
            try:
                db.rollback()
            except Exception:
                pass
        finally:
            db.close()

    enrich_enabled = _fresh_get("auto_master_enrich_enabled", "true")
    if enrich_enabled == "false" and not force:
        logger.info("AutoMasterEnrich: 無効のためスキップ (force=Falseにより)")
        return
    elif enrich_enabled == "false" and force:
        logger.info("AutoMasterEnrich: 無効設定だが force=True により強制実行")

    max_enrich = max(1, min(500, int(_fresh_get("auto_master_enrich_max", "100"))))

    db_init = SessionLocal()
    try:
        targets_raw = (
            db_init.query(
                CompanyMaster.id,
                CompanyMaster.company_name,
                CompanyMaster.prefecture,
                CompanyMaster.city,
                CompanyMaster.corporate_number,
            )
            .filter(
                (CompanyMaster.website_url == None) | (CompanyMaster.website_url == ""),
                CompanyMaster.company_name != None,
                CompanyMaster.company_name != "",
            )
            .order_by(CompanyMaster.id.asc())
            .limit(max_enrich)
            .all()
        )
    except Exception as e:
        logger.error(f"AutoMasterEnrich: ターゲット取得エラー: {e}")
        return
    finally:
        db_init.close()

    if not targets_raw:
        logger.info("AutoMasterEnrich: URLなし企業なし、処理スキップ")
        _fresh_set("auto_master_enrich_progress", "")
        return

    total_targets = len(targets_raw)
    logger.info(f"AutoMasterEnrich: {total_targets}社のURL補完を開始")
    _fresh_set("auto_master_enrich_progress", f"0/{total_targets} 処理中...")

    enriched = 0
    skipped = 0
    processed = 0
    DDG_FAIL_LIMIT = 5
    ddg_fail_counter = [0]
    PER_COMPANY_TIMEOUT = 30  # 1社あたりの壁時計タイムアウト（秒）

    import threading as _threading

    try:
        for company_id, company_name, prefecture, city, corporate_number in targets_raw:
            processed += 1
            ddg_disabled = ddg_fail_counter[0] >= DDG_FAIL_LIMIT
            if ddg_disabled and ddg_fail_counter[0] == DDG_FAIL_LIMIT:
                logger.warning(f"AutoMasterEnrich: DuckDuckGo連続失敗{DDG_FAIL_LIMIT}回 → 以降スキップ")
                ddg_fail_counter[0] += 1

            # 中止フラグチェック
            if _fresh_get("auto_master_enrich_abort", "0") == "1":
                logger.info(f"AutoMasterEnrich: 中止フラグ検出 ({processed-1}/{total_targets}) → ループ終了")
                _fresh_set("auto_master_enrich_abort", "0")
                break

            # 進捗をループ先頭で先に書き込む（hang中でも表示が進む）
            _fresh_set("auto_master_enrich_progress", f"{processed}/{total_targets} 処理中（URL発見:{enriched}件）")

            location = f"{prefecture or ''}{city or ''}"
            result_holder = {"url": None, "enriched": False, "error": None}

            def _process_company(
                _cid=company_id, _cname=company_name, _loc=location,
                _corp=corporate_number, _pref=prefecture, _city=city,
                _ddg_dis=ddg_disabled, _counter=ddg_fail_counter,
                _holder=result_holder, _proc=processed,
            ):
                db = SessionLocal()
                try:
                    url = find_website_for_company(
                        _cname, _loc, db=db, org_id=None,
                        ddg_disabled=_ddg_dis,
                        ddg_fail_counter=_counter,
                    )
                    if not url:
                        return

                    from urllib.parse import urlparse as _up2
                    domain = normalize_domain(_up2(url).netloc)
                    if not domain or is_aggregator_site(url)[0]:
                        return

                    existing = db.query(CompanyMaster).filter(CompanyMaster.domain == domain).first()
                    if existing and existing.id != _cid:
                        return

                    scraped = scrape_company_info(url) or {}
                    scraped["company_name"] = _cname
                    scraped["website_url"] = url
                    scraped["domain"] = domain
                    if _corp:
                        scraped["corporate_number"] = _corp
                    if not scraped.get("prefecture"):
                        scraped["prefecture"] = _pref
                        scraped["city"] = _city

                    full_text = scraped.get("full_text", "") or ""
                    cat_main, cat_sub = categorize_company(full_text)
                    cms_type = scraped.get("cms_type") or None
                    flags = detect_flags(full_text, cms_type=cms_type)
                    scraped.update({"category_main": cat_main, "category_sub": cat_sub, **flags})
                    score, rank = calculate_score(scraped, db=db)
                    scraped["score_total"] = score
                    scraped["score_rank"] = rank

                    _upsert_company_master(db, scraped, domain, source="auto_master_enrich", corporate_number=_corp)
                    _holder["url"] = url
                    _holder["enriched"] = True
                    logger.info(f"AutoMasterEnrich: [{_proc}/{total_targets}] {_cname} → {domain}")
                except Exception as e:
                    _holder["error"] = str(e)
                    logger.warning(f"AutoMasterEnrich: {_cname} error: {e}")
                finally:
                    try:
                        db.close()
                    except Exception:
                        pass

            # 壁時計タイムアウト付きで実行（DNS/ソケットハング対策）
            _t = _threading.Thread(target=_process_company, daemon=True)
            _t.start()
            _t.join(timeout=PER_COMPANY_TIMEOUT)
            if _t.is_alive():
                logger.warning(f"AutoMasterEnrich: {company_name} → {PER_COMPANY_TIMEOUT}秒タイムアウト、スキップ")

            if result_holder["enriched"]:
                enriched += 1
                _fresh_set("auto_master_enrich_progress", f"{processed}/{total_targets} 処理中（URL発見:{enriched}件）")
                _time.sleep(random.uniform(0.5, 1.0))
            else:
                skipped += 1

        prev_total = int(_fresh_get("auto_master_enrich_total", "0"))
        _fresh_set("auto_master_enrich_total", str(prev_total + enriched))
        _fresh_set("auto_master_enrich_last_run", datetime.now().strftime("%Y-%m-%d %H:%M"))
        _fresh_set("auto_master_enrich_last_run_date", datetime.now().strftime("%Y-%m-%d"))
        logger.info(f"AutoMasterEnrich: 完了 — URL発見{enriched}社 / スキップ{skipped}社 / 合計{total_targets}社")
    except Exception as _loop_err:
        logger.error(f"AutoMasterEnrich: ループ中に予期しないエラー: {_loop_err}", exc_info=True)
    finally:
        # 正常完了・例外・クラッシュどの場合でも必ずprogress をクリア
        _fresh_set("auto_master_enrich_progress", "")


def _write_sys_setting(key: str, value: str):
    from server.database import SessionLocal
    from server.models import SystemSettings
    db = SessionLocal()
    try:
        row = db.query(SystemSettings).filter(SystemSettings.key == key).first()
        if row:
            row.value = str(value)
        else:
            db.add(SystemSettings(key=key, value=str(value)))
        db.commit()
    except Exception as e:
        logger.warning(f"_write_sys_setting({key}) error: {e}")
        try:
            db.rollback()
        except Exception:
            pass
    finally:
        db.close()


def _scheduler_loop():
    global _scheduler_running
    last_collect_date = None
    last_notify_date = None
    last_suspend_date = None
    last_master_date = None
    last_enrich_date = None
    last_master_enrich_date = None
    last_auto_gen_dates: dict = {}
    last_auto_close_date = None
    last_usage_alert_date = None
    last_log_cleanup_date = None

    while _scheduler_running:
        try:
            from server.database import SessionLocal
            from server.models import AppSetting, SystemSettings

            db = SessionLocal()
            try:
                enabled = db.query(AppSetting).filter(AppSetting.setting_key == "auto_collect_enabled").first()
                schedule = db.query(AppSetting).filter(AppSetting.setting_key == "auto_collect_time").first()
                master_enabled_row = db.query(SystemSettings).filter(SystemSettings.key == "auto_master_enabled").first()
                master_hour_row = db.query(SystemSettings).filter(SystemSettings.key == "auto_master_schedule_hour").first()
                master_last_date_row = db.query(SystemSettings).filter(SystemSettings.key == "auto_master_last_run_date").first()
                enrich_hour_row = db.query(SystemSettings).filter(SystemSettings.key == "auto_master_enrich_schedule_hour").first()
                enrich_last_date_row = db.query(SystemSettings).filter(SystemSettings.key == "auto_master_enrich_last_run_date").first()
                enrich_all_date_row = db.query(SystemSettings).filter(SystemSettings.key == "auto_enrich_all_last_run_date").first()
                tz_row = db.query(SystemSettings).filter(SystemSettings.key == "scheduler_timezone").first()
                master_enabled = master_enabled_row and master_enabled_row.value == "true"
                master_hour = int(master_hour_row.value) if master_hour_row and master_hour_row.value else 3
                master_last_run_date = master_last_date_row.value if master_last_date_row and master_last_date_row.value else ""
                enrich_hour = int(enrich_hour_row.value) if enrich_hour_row and enrich_hour_row.value else 5
                enrich_last_run_date = enrich_last_date_row.value if enrich_last_date_row and enrich_last_date_row.value else ""
                enrich_all_last_run_date = enrich_all_date_row.value if enrich_all_date_row and enrich_all_date_row.value else ""
                tz_name = (tz_row.value if tz_row and tz_row.value else None) or "Asia/Tokyo"
            finally:
                db.close()

            try:
                from zoneinfo import ZoneInfo
                _tz = ZoneInfo(tz_name)
                now = datetime.now(_tz).replace(tzinfo=None)
            except Exception:
                now = datetime.now()
            today = now.date()
            today_str = today.isoformat()

            if enabled and enabled.setting_value == "true" and schedule and schedule.setting_value:
                try:
                    hour, minute = map(int, schedule.setting_value.split(":"))
                    if now.hour == hour and now.minute == minute and last_collect_date != today:
                        last_collect_date = today
                        logger.info(f"Auto-collect: Triggered at {now.strftime('%H:%M')}")
                        _run_auto_collect()
                except (ValueError, AttributeError):
                    pass

            _master_on_schedule = master_enabled and now.hour == master_hour and now.minute == 0
            _master_catchup = master_enabled and now.hour > master_hour and last_master_date != today
            if (_master_on_schedule or _master_catchup) and master_last_run_date != today_str and last_master_date != today:
                last_master_date = today
                _write_sys_setting("auto_master_last_run_date", today_str)
                logger.info(f"AutoMaster: Triggered at {now.strftime('%H:%M')} (scheduled={master_hour}:00)")
                threading.Thread(target=_run_auto_master_collect, daemon=True).start()

            if now.hour == 9 and now.minute == 0 and last_notify_date != today:
                last_notify_date = today
                logger.info("Followup notify: Triggered at 09:00")
                _run_followup_notify()

            if now.hour == 2 and now.minute == 0 and last_suspend_date != today:
                last_suspend_date = today
                logger.info("Auto-suspend: Triggered at 02:00")
                _run_suspend_inactive_users()

            if now.hour == 2 and now.minute == 30 and last_auto_close_date != today:
                last_auto_close_date = today
                logger.info("AutoCloseTickets: Triggered at 02:30")
                threading.Thread(target=_run_auto_close_tickets, daemon=True).start()

            _enrich_all_on_schedule = (now.hour == 4 and now.minute == 0)
            _enrich_all_catchup = (now.hour > 4 and last_enrich_date != today)
            if (_enrich_all_on_schedule or _enrich_all_catchup) and enrich_all_last_run_date != today_str and last_enrich_date != today:
                last_enrich_date = today
                _write_sys_setting("auto_enrich_all_last_run_date", today_str)
                logger.info(f"AutoEnrich: Triggered at {now.strftime('%H:%M')}")
                threading.Thread(target=_run_auto_enrich_all, daemon=True).start()

            _enrich_on_schedule = (now.hour == enrich_hour and now.minute < 2)
            _enrich_catchup = (now.hour > enrich_hour and last_master_enrich_date != today)
            if (_enrich_on_schedule or _enrich_catchup) and enrich_last_run_date != today_str and last_master_enrich_date != today:
                last_master_enrich_date = today
                logger.info(f"AutoMasterEnrich: Triggered at {now.strftime('%H:%M')} (scheduled={enrich_hour}:00)")
                threading.Thread(target=_run_auto_master_enrich, daemon=True).start()

            if now.hour == 8 and now.minute == 0 and last_usage_alert_date != today:
                last_usage_alert_date = today
                logger.info("UsageAlert: Triggered at 08:00")
                threading.Thread(target=_run_usage_alert, daemon=True).start()

            if now.hour == 3 and now.minute == 0 and last_log_cleanup_date != today:
                last_log_cleanup_date = today
                logger.info("LogCleanup: Triggered at 03:00")
                threading.Thread(target=_run_log_cleanup, daemon=True).start()

            from server.models import AppSetting, Organization
            db2 = SessionLocal()
            try:
                orgs = db2.query(Organization).all()
                for org in orgs:
                    ag_enabled = db2.query(AppSetting).filter(
                        AppSetting.setting_key == "auto_generate_enabled",
                        AppSetting.org_id == org.id,
                    ).first()
                    if not ag_enabled or ag_enabled.setting_value != "true":
                        continue
                    ag_hour_row = db2.query(AppSetting).filter(
                        AppSetting.setting_key == "auto_generate_hour",
                        AppSetting.org_id == org.id,
                    ).first()
                    ag_hour = int(ag_hour_row.setting_value) if ag_hour_row and ag_hour_row.setting_value else 8
                    _ag_on_schedule = (now.hour == ag_hour and now.minute == 0)
                    _ag_catchup = (now.hour > ag_hour and last_auto_gen_dates.get(org.id) != today)
                    if (_ag_on_schedule or _ag_catchup) and last_auto_gen_dates.get(org.id) != today:
                        last_auto_gen_dates[org.id] = today
                        logger.info(f"AutoGenerate: Triggered for org={org.id} at {now.strftime('%H:%M')} (scheduled={ag_hour}:00)")
                        threading.Thread(
                            target=_run_auto_generate_for_org,
                            args=(org.id,),
                            daemon=True,
                        ).start()
            finally:
                db2.close()

        except Exception as e:
            logger.error(f"Scheduler error: {e}")

        time.sleep(30)


def _run_auto_close_tickets():
    from server.database import SessionLocal
    from server.models import SupportTicket, SupportTicketMessage, SystemSettings, User
    from server.services.encryption import decrypt_value
    from datetime import timedelta

    db = SessionLocal()
    try:
        days_row = db.query(SystemSettings).filter(SystemSettings.key == "ticket_auto_close_days").first()
        days = int(decrypt_value(days_row.value)) if days_row and days_row.value else 7
        cutoff = datetime.now() - timedelta(days=days)

        tickets = db.query(SupportTicket).filter(
            SupportTicket.status.in_(["open", "in_progress", "resolved"]),
            SupportTicket.updated_at < cutoff,
        ).all()

        if not tickets:
            return

        logger.info(f"AutoCloseTickets: Found {len(tickets)} tickets to close")

        for ticket in tickets:
            ticket.status = "closed"
            ticket.resolved_at = datetime.now()
            db.flush()

            try:
                creator = db.query(User).filter(User.id == ticket.user_id).first()
                if creator:
                    from server.services.mailer import get_system_smtp_settings, send_email
                    smtp = get_system_smtp_settings(db)
                    if smtp.get("smtp_host"):
                        html = f"""
                        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
                          <div style="background:#64748b;padding:16px 20px;">
                            <h2 style="color:#fff;margin:0;font-size:16px;">サポートチケットが自動クローズされました</h2>
                          </div>
                          <div style="padding:20px;font-size:14px;color:#334155;">
                            <p>チケット <strong>{ticket.ticket_number}</strong>「{ticket.subject}」は、{days}日間応答がなかったため自動クローズされました。</p>
                            <p>引き続きお困りの場合は、新しいサポートチケットを作成してください。</p>
                            <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;">
                            <p style="font-size:12px;color:#94a3b8;">LeadHive / COOLWORKS株式会社</p>
                          </div>
                        </div>
                        """
                        send_email(
                            creator.email,
                            f"【LeadHive】チケット {ticket.ticket_number} が自動クローズされました",
                            html, smtp
                        )
            except Exception as e:
                logger.error(f"AutoClose notification error for ticket {ticket.id}: {e}")

        db.commit()
        logger.info(f"AutoCloseTickets: Closed {len(tickets)} tickets")
    except Exception as e:
        logger.error(f"AutoCloseTickets error: {e}")
        db.rollback()
    finally:
        db.close()


def _run_usage_alert():
    """プラン使用量が80%/100%に達した場合にアラートメールを送信する"""
    from server.database import SessionLocal
    from server.models import Organization, User, Plan, Company, Project, AppSetting
    from server.services.mailer import get_smtp_settings, send_email

    db = SessionLocal()
    try:
        orgs = db.query(Organization).all()
        for org in orgs:
            plan = db.query(Plan).filter(Plan.id == org.plan_id).first() if org.plan_id else None
            if not plan:
                continue

            projects = db.query(Project).filter(Project.org_id == org.id).all()
            project_ids = [p.id for p in projects]
            company_count = db.query(Company).filter(Company.project_id.in_(project_ids)).count() if project_ids else 0
            member_count = db.query(User).filter(User.org_id == org.id).count()

            alerts = []
            if plan.max_companies and plan.max_companies > 0:
                pct = company_count / plan.max_companies * 100
                if pct >= 100:
                    alerts.append(f"企業数が上限に達しました ({company_count}/{plan.max_companies}社 — 100%)")
                elif pct >= 80:
                    alerts.append(f"企業数が上限の{int(pct)}%に達しました ({company_count}/{plan.max_companies}社)")

            if plan.max_members and plan.max_members > 0:
                pct = member_count / plan.max_members * 100
                if pct >= 100:
                    alerts.append(f"メンバー数が上限に達しました ({member_count}/{plan.max_members}人 — 100%)")
                elif pct >= 80:
                    alerts.append(f"メンバー数が上限の{int(pct)}%に達しました ({member_count}/{plan.max_members}人)")

            if not alerts:
                continue

            admin = db.query(User).filter(User.org_id == org.id, User.role == "admin").first()
            if not admin:
                continue

            smtp_cfg = get_smtp_settings(db, org.id)
            if not smtp_cfg.get("smtp_host"):
                continue

            alert_items = "".join(f"<li>{a}</li>" for a in alerts)
            html_body = f"""
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
              <h2 style="color:#f59e0b">⚠ LeadHive 使用量アラート</h2>
              <p>ご利用の組織「{org.name}」の使用量が閾値に達しました。</p>
              <ul style="line-height:2">{alert_items}</ul>
              <p>プランのアップグレードをご検討ください。</p>
              <p>
                <a href="https://leadhive.work/settings?tab=plan"
                   style="background:#2563eb;color:white;padding:10px 20px;border-radius:6px;text-decoration:none">
                  プランを確認する
                </a>
              </p>
              <p style="color:#9ca3af;font-size:12px;margin-top:24px">LeadHive — COOLWORKS株式会社</p>
            </div>
            """
            try:
                send_email(admin.email, "【LeadHive】使用量アラート", html_body, smtp_cfg)
                logger.info(f"UsageAlert: Sent to {admin.email} (org={org.id})")
            except Exception as e:
                logger.warning(f"UsageAlert: Failed to send to org {org.id}: {e}")

    except Exception as e:
        logger.error(f"UsageAlert error: {e}")
    finally:
        db.close()


def _run_log_cleanup():
    from datetime import timedelta
    from server.database import SessionLocal
    from server.models import SecurityEvent, JobLog
    db = SessionLocal()
    try:
        cutoff = datetime.utcnow() - timedelta(days=90)
        deleted_events = db.query(SecurityEvent).filter(SecurityEvent.created_at < cutoff).delete()
        deleted_jobs = db.query(JobLog).filter(JobLog.started_at < cutoff).delete()
        db.commit()
        logger.info(f"LogCleanup: Deleted {deleted_events} security events, {deleted_jobs} job logs older than 90 days")
    except Exception as e:
        logger.error(f"LogCleanup error: {e}")
    finally:
        db.close()


def start_scheduler():
    global _scheduler_thread, _scheduler_running
    with _scheduler_lock:
        if _scheduler_running:
            return
        _scheduler_running = True
        _scheduler_thread = threading.Thread(target=_scheduler_loop, daemon=True)
        _scheduler_thread.start()
        logger.info("Scheduler started")


def stop_scheduler():
    global _scheduler_running
    with _scheduler_lock:
        _scheduler_running = False
        logger.info("Scheduler stopped")


def get_scheduler_status() -> dict:
    return {
        "running": _scheduler_running,
    }
