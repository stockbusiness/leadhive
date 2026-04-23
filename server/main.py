import os
import sys
import threading
from pathlib import Path
from contextlib import asynccontextmanager

sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from server.routes import companies, keywords, dashboard, scraper, settings, rejected, collector, templates, projects, master
from server.routes import auth, users, plans, payments, onboarding, public
from server.routes import admin_auto_master, segments, sales_ai, notifications
from server.routes import security
from server.routes import contact
from server.routes import support
from server.routes import admin_hubsrev
from server.routes import admin_scoring
from server.routes import admin_commitrev
from server.routes import faq
from server.routes import status_page
from server.routes import webhooks
from server.routes import tracking
from server.routes import lp_inquiries, admin_imap, inbound_webhooks
from server.routes import lumiqbrain
from server.routes import email_campaigns
from server.services.scheduler import start_scheduler, stop_scheduler
from server.services.imap_poller import start_imap_polling, stop_imap_polling
from server.services.rate_limiter import limiter, _rate_limit_exceeded_handler, RateLimitExceeded


def _init_sentry():
    sentry_dsn = os.environ.get("SENTRY_DSN", "")
    if sentry_dsn:
        try:
            import sentry_sdk
            from sentry_sdk.integrations.fastapi import FastApiIntegration
            from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
            sentry_sdk.init(
                dsn=sentry_dsn,
                traces_sample_rate=0.1,
                integrations=[FastApiIntegration(), SqlalchemyIntegration()],
                environment=os.environ.get("APP_ENV", "production"),
            )
            print("[LeadHive] Sentry initialized")
        except Exception as e:
            print(f"[LeadHive] Sentry init failed: {e}")


_init_sentry()


DEFAULT_PLANS = [
    {
        "name": "フリー",
        "description": "個人利用・お試し向けの無料プラン",
        "price_monthly": 0,
        "max_members": 1,
        "max_projects": 1,
        "max_companies": 200,
        "max_ai_analyses_monthly": 3,
        "max_master_db_imports": 0,
        "max_csv_export": 50,
        "api_daily_limit": None,
        "is_active": True,
    },
    {
        "name": "スターター",
        "description": "小規模チーム・本格利用開始向けプラン",
        "price_monthly": 4980,
        "max_members": 3,
        "max_projects": 3,
        "max_companies": 1000,
        "max_ai_analyses_monthly": 20,
        "max_master_db_imports": 100,
        "max_csv_export": 1000,
        "api_daily_limit": None,
        "is_active": True,
    },
    {
        "name": "プロ",
        "description": "成長中のチーム・ヘビーユーザー向けプラン",
        "price_monthly": 14800,
        "max_members": 10,
        "max_projects": 10,
        "max_companies": 5000,
        "max_ai_analyses_monthly": 100,
        "max_master_db_imports": None,
        "max_csv_export": None,
        "api_daily_limit": None,
        "is_active": True,
    },
    {
        "name": "エンタープライズ",
        "description": "カスタム契約・大規模チーム向けプラン",
        "price_monthly": None,
        "max_members": None,
        "max_projects": None,
        "max_companies": None,
        "max_ai_analyses_monthly": None,
        "max_master_db_imports": None,
        "max_csv_export": None,
        "api_daily_limit": None,
        "is_active": True,
    },
    {
        "name": "Founder",
        "description": "先着50名限定 Founderプラン（全機能永久無料）",
        "price_monthly": 0,
        "max_members": None,
        "max_projects": None,
        "max_companies": None,
        "max_ai_analyses_monthly": None,
        "max_master_db_imports": None,
        "max_csv_export": None,
        "api_daily_limit": None,
        "is_active": True,
    },
]


def run_db_migrations():
    from server.database import engine, Base, SessionLocal
    from server import models  # noqa: F401 — ensure all models are registered
    import sqlalchemy as sa
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        for stmt in [
            "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan_id INTEGER REFERENCES plans(id)",
            "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS master_db_import_count INTEGER DEFAULT 0",
            "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS master_db_import_month VARCHAR(7)",
            "ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_master_db_imports INTEGER",
            "ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_csv_export INTEGER",
            "ALTER TABLE plans ADD COLUMN IF NOT EXISTS stripe_price_id VARCHAR(255)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_system_admin BOOLEAN DEFAULT FALSE",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_founder BOOLEAN DEFAULT FALSE",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS registration_number INTEGER",
            "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS phone VARCHAR(50)",
            "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS corporate_number VARCHAR(13)",
            "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS corporate_verified BOOLEAN DEFAULT FALSE",
            "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255)",
            "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255)",
            "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50)",
            "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMP",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 1",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret VARCHAR(255)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT FALSE",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS cms_type VARCHAR(50)",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS cms_detected_at TIMESTAMP",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS sns_links JSONB",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS has_recruitment BOOLEAN DEFAULT FALSE",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS employee_count INTEGER",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS escms_target_flag BOOLEAN DEFAULT FALSE",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS robots_disallow BOOLEAN DEFAULT FALSE",
            "ALTER TABLE company_master ADD COLUMN IF NOT EXISTS cms_type VARCHAR(50)",
            "ALTER TABLE company_master ADD COLUMN IF NOT EXISTS cms_detected_at TIMESTAMP",
            "ALTER TABLE company_master ADD COLUMN IF NOT EXISTS sns_links JSONB",
            "ALTER TABLE company_master ADD COLUMN IF NOT EXISTS has_recruitment BOOLEAN DEFAULT FALSE",
            "ALTER TABLE company_master ADD COLUMN IF NOT EXISTS employee_count INTEGER",
            "ALTER TABLE company_master ADD COLUMN IF NOT EXISTS escms_target_flag BOOLEAN DEFAULT FALSE",
            "ALTER TABLE company_master ADD COLUMN IF NOT EXISTS robots_disallow BOOLEAN DEFAULT FALSE",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS ec_score INTEGER DEFAULT 0",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS sns_instagram_url TEXT",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS sns_x_url TEXT",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS sns_facebook_url TEXT",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS sns_youtube_url TEXT",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS sns_tiktok_url TEXT",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS sns_line_url TEXT",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS sns_count INTEGER DEFAULT 0",
            "ALTER TABLE company_master ADD COLUMN IF NOT EXISTS ec_score INTEGER DEFAULT 0",
            "ALTER TABLE company_master ADD COLUMN IF NOT EXISTS sns_instagram_url TEXT",
            "ALTER TABLE company_master ADD COLUMN IF NOT EXISTS sns_x_url TEXT",
            "ALTER TABLE company_master ADD COLUMN IF NOT EXISTS sns_facebook_url TEXT",
            "ALTER TABLE company_master ADD COLUMN IF NOT EXISTS sns_youtube_url TEXT",
            "ALTER TABLE company_master ADD COLUMN IF NOT EXISTS sns_tiktok_url TEXT",
            "ALTER TABLE company_master ADD COLUMN IF NOT EXISTS sns_line_url TEXT",
            "ALTER TABLE company_master ADD COLUMN IF NOT EXISTS sns_count INTEGER DEFAULT 0",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS digital_maturity_score INTEGER DEFAULT 0",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS score_updated_at TIMESTAMP",
            "ALTER TABLE company_master ADD COLUMN IF NOT EXISTS digital_maturity_score INTEGER DEFAULT 0",
            "ALTER TABLE company_master ADD COLUMN IF NOT EXISTS score_updated_at TIMESTAMP",
            "ALTER TABLE status_history ADD COLUMN IF NOT EXISTS user_id INTEGER",
            "ALTER TABLE status_history ADD COLUMN IF NOT EXISTS user_name VARCHAR(255)",
            "ALTER TABLE status_history ADD COLUMN IF NOT EXISTS note TEXT",
            "ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS auto_status_on_open VARCHAR(50)",
            "ALTER TABLE email_campaigns ADD COLUMN IF NOT EXISTS auto_status_on_click VARCHAR(50)",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS base_flag BOOLEAN DEFAULT FALSE",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS makeshop_flag BOOLEAN DEFAULT FALSE",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS futureshop_flag BOOLEAN DEFAULT FALSE",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS stores_flag BOOLEAN DEFAULT FALSE",
            "ALTER TABLE company_master ADD COLUMN IF NOT EXISTS base_flag BOOLEAN DEFAULT FALSE",
            "ALTER TABLE company_master ADD COLUMN IF NOT EXISTS makeshop_flag BOOLEAN DEFAULT FALSE",
            "ALTER TABLE company_master ADD COLUMN IF NOT EXISTS futureshop_flag BOOLEAN DEFAULT FALSE",
            "ALTER TABLE company_master ADD COLUMN IF NOT EXISTS stores_flag BOOLEAN DEFAULT FALSE",
        ]:
            conn.execute(sa.text(stmt))

        conn.execute(sa.text("""
            CREATE TABLE IF NOT EXISTS sales_messages (
                id SERIAL PRIMARY KEY,
                org_id INTEGER NOT NULL REFERENCES organizations(id),
                company_id INTEGER NOT NULL,
                project_id INTEGER REFERENCES projects(id),
                template_type VARCHAR(30) NOT NULL,
                subject VARCHAR(500) NOT NULL,
                body TEXT NOT NULL,
                ai_prompt_id VARCHAR(100),
                status VARCHAR(20) DEFAULT 'draft',
                reviewed_by INTEGER REFERENCES users(id),
                reviewed_at TIMESTAMP,
                sent_at TIMESTAMP,
                sent_by INTEGER REFERENCES users(id),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """))
        conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_sales_messages_org_id ON sales_messages (org_id)"))
        conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_sales_messages_company_id ON sales_messages (company_id)"))
        conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_sales_messages_status ON sales_messages (status)"))

        conn.execute(sa.text("""
            CREATE TABLE IF NOT EXISTS audit_logs (
                id SERIAL PRIMARY KEY,
                sent_at TIMESTAMP DEFAULT NOW(),
                company_id INTEGER NOT NULL,
                send_method VARCHAR(20) NOT NULL,
                sent_by_user_id INTEGER REFERENCES users(id),
                message_id INTEGER REFERENCES sales_messages(id),
                ai_prompt_id VARCHAR(100),
                result VARCHAR(30) DEFAULT 'sent',
                note TEXT
            )
        """))
        conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_audit_logs_company_id ON audit_logs (company_id)"))
        conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_audit_logs_sent_at ON audit_logs (sent_at DESC)"))

        conn.execute(sa.text("""
            CREATE TABLE IF NOT EXISTS opt_out_list (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255),
                domain VARCHAR(255),
                company_id INTEGER,
                reason TEXT,
                added_by INTEGER REFERENCES users(id),
                added_at TIMESTAMP DEFAULT NOW()
            )
        """))
        conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_opt_out_list_email ON opt_out_list (email)"))
        conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_opt_out_list_domain ON opt_out_list (domain)"))

        conn.execute(sa.text("""
            CREATE TABLE IF NOT EXISTS segments (
                id SERIAL PRIMARY KEY,
                org_id INTEGER NOT NULL REFERENCES organizations(id),
                created_by INTEGER REFERENCES users(id),
                name VARCHAR(255) NOT NULL,
                description TEXT,
                filters JSONB NOT NULL DEFAULT '{}',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """))
        conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_segments_org_id ON segments (org_id)"))

        conn.execute(sa.text("""
            CREATE TABLE IF NOT EXISTS job_logs (
                id SERIAL PRIMARY KEY,
                job_id VARCHAR(100) UNIQUE NOT NULL,
                job_type VARCHAR(50),
                status VARCHAR(20) DEFAULT 'running',
                message TEXT,
                current INTEGER DEFAULT 0,
                total INTEGER DEFAULT 0,
                source_count INTEGER DEFAULT 0,
                saved_count INTEGER DEFAULT 0,
                error_count INTEGER DEFAULT 0,
                started_at TIMESTAMP DEFAULT NOW(),
                finished_at TIMESTAMP,
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """))
        conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_job_logs_job_id ON job_logs (job_id)"))
        conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_job_logs_started_at ON job_logs (started_at DESC)"))

        conn.execute(sa.text("""
            CREATE TABLE IF NOT EXISTS email_campaigns (
                id SERIAL PRIMARY KEY,
                org_id INTEGER NOT NULL REFERENCES organizations(id),
                project_id INTEGER REFERENCES projects(id),
                created_by INTEGER REFERENCES users(id),
                name VARCHAR(255),
                subject VARCHAR(500) NOT NULL,
                html_body TEXT NOT NULL,
                text_body TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                status VARCHAR(50) DEFAULT 'running',
                total_count INTEGER DEFAULT 0,
                sent_count INTEGER DEFAULT 0,
                failed_count INTEGER DEFAULT 0,
                auto_status_on_open VARCHAR(50),
                auto_status_on_click VARCHAR(50)
            )
        """))
        conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_email_campaigns_org_id ON email_campaigns (org_id)"))

        conn.execute(sa.text("""
            CREATE TABLE IF NOT EXISTS email_logs (
                id SERIAL PRIMARY KEY,
                campaign_id INTEGER NOT NULL REFERENCES email_campaigns(id),
                company_id INTEGER,
                to_email VARCHAR(255) NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                sent_at TIMESTAMP,
                opened_at TIMESTAMP,
                clicked_at TIMESTAMP,
                bounced_at TIMESTAMP,
                error_message TEXT,
                open_count INTEGER DEFAULT 0,
                click_count INTEGER DEFAULT 0
            )
        """))
        conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_email_logs_campaign_id ON email_logs (campaign_id)"))
        conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_email_logs_company_id ON email_logs (company_id)"))

        # app_settings の idx_settings_key を (setting_key) のみ→ (setting_key, org_id) に修正
        conn.execute(sa.text("""
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1 FROM pg_indexes
                    WHERE indexname = 'idx_settings_key'
                    AND tablename = 'app_settings'
                ) THEN
                    DROP INDEX idx_settings_key;
                END IF;
            END$$;
        """))
        conn.execute(sa.text(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_key_org ON app_settings(setting_key, org_id)"
        ))

        conn.commit()

    db = SessionLocal()
    try:
        from server.models import Plan, User, Organization
        from server.auth import hash_password

        for p in DEFAULT_PLANS:
            existing = db.query(Plan).filter(Plan.name == p["name"]).first()
            if existing:
                for key, value in p.items():
                    setattr(existing, key, value)
            else:
                db.add(Plan(**p))
        db.commit()

        if db.query(User).count() == 0:
            admin_email = os.environ.get("INITIAL_ADMIN_EMAIL", "admin@leadhive.work")
            admin_password = os.environ.get("INITIAL_ADMIN_PASSWORD", "LeadHive2026!")
            org = Organization(name="LeadHive管理")
            db.add(org)
            db.flush()
            enterprise_plan = db.query(Plan).filter(Plan.name == "エンタープライズ").first()
            if enterprise_plan:
                org.plan_id = enterprise_plan.id
            admin = User(
                org_id=org.id,
                email=admin_email,
                password_hash=hash_password(admin_password),
                role="admin",
                is_active=True,
                is_system_admin=True,
                registration_number=1,
            )
            db.add(admin)
            db.commit()
            print(f"[LeadHive] 初期管理者アカウントを作成しました: {admin_email}")
        else:
            admin_email = os.environ.get("INITIAL_ADMIN_EMAIL", "admin@leadhive.work")
            existing_admin = db.query(User).filter(User.email == admin_email).first()
            if existing_admin and not existing_admin.is_system_admin:
                existing_admin.is_system_admin = True
                existing_admin.is_active = True
                db.commit()
                print(f"[LeadHive] 初期管理者にシステム管理者権限を付与しました: {admin_email}")
    finally:
        db.close()


def _cleanup_stale_jobs():
    """サーバー起動時に「実行中」のまま残ったジョブレコードをエラーに更新する"""
    try:
        from server.database import SessionLocal
        from server.models import JobLog
        from datetime import datetime
        db = SessionLocal()
        try:
            stale = db.query(JobLog).filter(JobLog.status == "running").all()
            if stale:
                now = datetime.utcnow()
                for j in stale:
                    j.status = "error"
                    j.finished_at = now
                    j.message = (j.message or "") + "（サーバー再起動により強制終了）"
                db.commit()
                import logging
                logging.getLogger(__name__).info(f"Startup cleanup: {len(stale)}件の実行中ジョブをエラーに更新")
        finally:
            db.close()
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Startup cleanup failed: {e}")


def _schedule_periodic_restart(interval_hours: int = 24):
    """定期的にプロセスを終了してVMデプロイの自動再起動を促す"""
    def _restart_worker():
        import time
        secs = interval_hours * 3600
        print(f"[LeadHive] 定期再起動タイマー開始: {interval_hours}時間後に再起動します")
        time.sleep(secs)
        print(f"[LeadHive] 定期再起動: {interval_hours}時間経過のためプロセスを終了します")
        os._exit(0)
    t = threading.Thread(target=_restart_worker, daemon=True)
    t.start()


@asynccontextmanager
async def lifespan(app: FastAPI):
    _cleanup_stale_jobs()
    threading.Thread(target=run_db_migrations, daemon=True).start()
    start_scheduler()
    start_imap_polling()
    _schedule_periodic_restart(24)
    yield
    stop_scheduler()
    stop_imap_polling()


app = FastAPI(title="LeadHive", lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(GZipMiddleware, minimum_size=1024)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https://(leadhive\.work|.*\.leadhive\.work|.*\.replit\.dev|.*\.repl\.co)|http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_and_cache_headers(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path

    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"

    if path.startswith("/assets/"):
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    elif path in ("/favicon.svg", "/favicon.ico", "/robots.txt", "/sitemap.xml"):
        response.headers["Cache-Control"] = "public, max-age=86400"
    elif path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    else:
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"

    return response


@app.get("/api/health", tags=["system"])
def health_check():
    from datetime import datetime as _dt
    return {"status": "ok", "timestamp": _dt.utcnow().isoformat() + "Z"}

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(companies.router)
app.include_router(keywords.router)
app.include_router(dashboard.router)
app.include_router(scraper.router)
app.include_router(settings.router)
app.include_router(rejected.router)
app.include_router(collector.router)
app.include_router(templates.router)
app.include_router(projects.router)
app.include_router(master.router)
app.include_router(plans.router)
app.include_router(payments.router)
app.include_router(onboarding.router, prefix="/api/onboarding", tags=["onboarding"])
app.include_router(public.router)
app.include_router(admin_auto_master.router)
app.include_router(segments.router)
app.include_router(sales_ai.router)
app.include_router(notifications.router)
app.include_router(security.router)
app.include_router(contact.router)
app.include_router(support.router)
app.include_router(admin_hubsrev.router)
app.include_router(admin_scoring.router)
app.include_router(admin_commitrev.router)
app.include_router(faq.router)
app.include_router(status_page.router)
app.include_router(webhooks.router)
app.include_router(tracking.router)
app.include_router(lp_inquiries.router)
app.include_router(admin_imap.router)
app.include_router(inbound_webhooks.router)
app.include_router(lumiqbrain.router)
app.include_router(email_campaigns.router)

frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"

if frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        file_path = frontend_dist / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(frontend_dist / "index.html"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
