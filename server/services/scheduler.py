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
                    continue
                success = result.get("summary", {}).get("success", 0)
                total_success += success
                logger.info(f"Auto-collect: '{kw.keyword}' - {success} new companies")
            except Exception as e:
                logger.error(f"Auto-collect error for '{kw.keyword}': {e}")

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
                    slack_msg = f"📅 *LeadHive フォローアップ通知* ({today.strftime('%Y/%m/%d')})\n{summary_text}"
                    send_slack_notification(slack_msg, webhook.setting_value)

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

    db = SessionLocal()
    try:
        import os
        token = (
            os.environ.get("GbizAPIkey")
            or os.environ.get("GBIZINFO_API_TOKEN")
            or os.environ.get("GBIZ_API_TOKEN")
            or _sys_get(db, "gbizinfo_api_token")
        )
        if not token:
            msg = "gBizINFO APIトークンが設定されていません"
            logger.warning(f"AutoMaster: {msg}")
            if job_id:
                job_update(job_id, type="error", message=msg)
            return

        AUTO_MASTER_KEYWORDS = ["株式会社", "合同会社", "有限会社", "医療法人", "社会福祉法人"]

        pref_idx = int(_sys_get(db, "auto_master_pref_idx", "0")) % len(PREFECTURES)
        keyword_idx = int(_sys_get(db, "auto_master_keyword_idx", "0")) % len(AUTO_MASTER_KEYWORDS)
        start_page = max(1, int(_sys_get(db, "auto_master_page_idx", "1")))
        max_companies = max(100, min(50000, int(_sys_get(db, "auto_master_max_companies", "1000"))))
        max_enrich = max(0, min(50, int(_sys_get(db, "auto_master_max_enrich", "10"))))

        prefecture = PREFECTURES[pref_idx]
        current_keyword = AUTO_MASTER_KEYWORDS[keyword_idx]

        logger.info(
            f"AutoMaster: Starting {prefecture}/{current_keyword} page={start_page} "
            f"max_companies={max_companies} max_enrich={max_enrich}"
        )
        if job_id:
            job_update(job_id, type="progress", current=0, total=max_companies,
                       message=f"{prefecture}・{current_keyword}（p{start_page}〜）の収集を開始しています...",
                       status="running")

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
        combo_finished = False
        next_page = start_page

        for page in range(start_page, start_page + 9999):
            if saved >= max_companies:
                break
            try:
                result = search_gbiz(token, name_keyword=current_keyword, prefecture=prefecture, page=page)
                batch = result.get("companies", [])
                if not batch:
                    combo_finished = True
                    break
                total_fetched += len(batch)
                next_page = page + 1

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
                        pref_name = ""
                        city_name = ""
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

                        domain = normalize_domain(url)
                        if not domain or is_aggregator_site(domain):
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
                        score, rank = calculate_score(scraped)
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
                               message=f"p{page} — {prefecture}・{current_keyword} 新規{saved}件 / スキップ{skipped}件")

                if result.get("is_last_page"):
                    combo_finished = True
                    break
                time.sleep(0.5)
            except Exception as e:
                logger.warning(f"AutoMaster: page {page} fetch failed: {e}")
                break

        if combo_finished:
            new_keyword_idx = keyword_idx + 1
            new_pref_idx = pref_idx
            if new_keyword_idx >= len(AUTO_MASTER_KEYWORDS):
                new_keyword_idx = 0
                new_pref_idx = (pref_idx + 1) % len(PREFECTURES)
            _sys_set(db, "auto_master_keyword_idx", str(new_keyword_idx))
            _sys_set(db, "auto_master_pref_idx", str(new_pref_idx))
            _sys_set(db, "auto_master_page_idx", "1")
            next_label = f"{PREFECTURES[new_pref_idx]}/{AUTO_MASTER_KEYWORDS[new_keyword_idx]}（p1〜）"
        else:
            _sys_set(db, "auto_master_page_idx", str(next_page))
            next_label = f"{prefecture}/{current_keyword}（p{next_page}〜）"

        _sys_set(db, "auto_master_last_run", datetime.utcnow().isoformat())
        _sys_set(db, "auto_master_last_count", str(saved))
        total_row = db.query(SystemSettings).filter(SystemSettings.key == "auto_master_total_collected").first()
        prev_total = int(total_row.value) if total_row and total_row.value else 0
        _sys_set(db, "auto_master_total_collected", str(prev_total + saved))

        msg = (
            f"{prefecture}・{current_keyword}（p{start_page}〜） 完了: "
            f"取得{total_fetched}件 → 新規{saved}件保存 / 重複{skipped}件スキップ（URL補完: {enriched}件）"
            + (f" ※次回: {next_label}" if not combo_finished else f" ※{current_keyword}完了、次回: {next_label}")
        )
        logger.info(f"AutoMaster: {msg}")
        if job_id:
            job_update(job_id, type="done",
                       result={"prefecture": prefecture, "fetched": total_fetched, "saved": saved,
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


def _scheduler_loop():
    global _scheduler_running
    last_collect_date = None
    last_notify_date = None
    last_suspend_date = None
    last_master_date = None
    last_auto_gen_dates: dict = {}

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
                master_enabled = master_enabled_row and master_enabled_row.value == "true"
                master_hour = int(master_hour_row.value) if master_hour_row and master_hour_row.value else 3
            finally:
                db.close()

            now = datetime.now()
            today = now.date()

            if enabled and enabled.setting_value == "true" and schedule and schedule.setting_value:
                try:
                    hour, minute = map(int, schedule.setting_value.split(":"))
                    if now.hour == hour and now.minute == minute and last_collect_date != today:
                        last_collect_date = today
                        logger.info(f"Auto-collect: Triggered at {now.strftime('%H:%M')}")
                        _run_auto_collect()
                except (ValueError, AttributeError):
                    pass

            if master_enabled and now.hour == master_hour and now.minute == 0 and last_master_date != today:
                last_master_date = today
                logger.info(f"AutoMaster: Triggered at {now.strftime('%H:%M')}")
                threading.Thread(target=_run_auto_master_collect, daemon=True).start()

            if now.hour == 9 and now.minute == 0 and last_notify_date != today:
                last_notify_date = today
                logger.info("Followup notify: Triggered at 09:00")
                _run_followup_notify()

            if now.hour == 2 and now.minute == 0 and last_suspend_date != today:
                last_suspend_date = today
                logger.info("Auto-suspend: Triggered at 02:00")
                _run_suspend_inactive_users()

            if now.minute == 0:
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
                        if now.hour == ag_hour and last_auto_gen_dates.get(org.id) != today:
                            last_auto_gen_dates[org.id] = today
                            logger.info(f"AutoGenerate: Triggered for org={org.id} at {now.strftime('%H:%M')}")
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
