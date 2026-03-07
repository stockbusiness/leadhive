import os
import sys
from pathlib import Path
from contextlib import asynccontextmanager

sys.path.insert(0, str(Path(__file__).parent.parent))

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from server.routes import companies, keywords, dashboard, scraper, settings, rejected, collector, templates, projects, master
from server.routes import auth, users, plans, payments
from server.services.scheduler import start_scheduler, stop_scheduler


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
        ]:
            conn.execute(sa.text(stmt))
        conn.commit()

    db = SessionLocal()
    try:
        from server.models import Plan
        for p in DEFAULT_PLANS:
            existing = db.query(Plan).filter(Plan.name == p["name"]).first()
            if existing:
                for key, value in p.items():
                    setattr(existing, key, value)
            else:
                db.add(Plan(**p))
        db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    run_db_migrations()
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(title="LeadHive", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
