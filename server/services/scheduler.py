import threading
import time
import logging
from datetime import datetime, date

logger = logging.getLogger(__name__)

_scheduler_thread = None
_scheduler_running = False
_scheduler_lock = threading.Lock()


def _run_auto_collect():
    from server.database import SessionLocal
    from server.models import AppSetting, SearchKeyword
    from server.services.collector import collect_by_keyword

    db = SessionLocal()
    try:
        enabled = db.query(AppSetting).filter(AppSetting.setting_key == "auto_collect_enabled").first()
        if not enabled or enabled.setting_value != "true":
            return

        keywords = db.query(SearchKeyword).filter(SearchKeyword.is_active == True).all()
        if not keywords:
            logger.info("Auto-collect: No active keywords")
            return

        logger.info(f"Auto-collect: Starting collection for {len(keywords)} keywords")
        for kw in keywords:
            try:
                result = collect_by_keyword(kw.id, db)
                success = result.get("summary", {}).get("success", 0)
                logger.info(f"Auto-collect: '{kw.keyword}' - {success} new companies")
            except Exception as e:
                logger.error(f"Auto-collect error for '{kw.keyword}': {e}")

        logger.info("Auto-collect: Collection complete")
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


def _scheduler_loop():
    global _scheduler_running
    last_collect_date = None
    last_notify_date = None
    last_suspend_date = None

    while _scheduler_running:
        try:
            from server.database import SessionLocal
            from server.models import AppSetting

            db = SessionLocal()
            try:
                enabled = db.query(AppSetting).filter(AppSetting.setting_key == "auto_collect_enabled").first()
                schedule = db.query(AppSetting).filter(AppSetting.setting_key == "auto_collect_time").first()
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

            if now.hour == 9 and now.minute == 0 and last_notify_date != today:
                last_notify_date = today
                logger.info("Followup notify: Triggered at 09:00")
                _run_followup_notify()

            if now.hour == 2 and now.minute == 0 and last_suspend_date != today:
                last_suspend_date = today
                logger.info("Auto-suspend: Triggered at 02:00")
                _run_suspend_inactive_users()

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
