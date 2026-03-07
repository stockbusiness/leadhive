# ESCMS 代理店候補収集ツール

## Overview
EC/Shopify制作会社などの代理店候補企業を収集・評価・管理するWebアプリケーション。
Google Custom Search APIによる自動収集、またはURLの手動入力でスクレイピングし、会社情報を自動抽出。スコアリング・カテゴリ分類を行い、営業活動に活用できる状態に整理する。

## Architecture
- **Frontend**: React + TypeScript + Tailwind CSS + Recharts (Vite build, served as static files)
- **Backend**: FastAPI (Python) on port 5000
- **Database**: PostgreSQL (Replit built-in)
- **Auth**: JWT (python-jose) + sha256_crypt (passlib) — Bearer token in Authorization header
- **Multi-tenancy**: Organization-based — each org has isolated projects, companies, settings, templates
- **Scraping**: BeautifulSoup4 + Requests (parallel via ThreadPoolExecutor)
- **Search API**: Google Custom Search API (APIキーは管理画面で設定)
- **Caching**: In-memory TTL cache for API responses

## Project Structure (Modular)
```
server/
  main.py              - FastAPI app entry point (port 5000) + scheduler start
  database.py          - SQLAlchemy database connection
  models.py            - SQLAlchemy models (Project, Company, SearchKeyword, AppSetting, RejectedUrl, ApiUsageLog, CollectionLog, StatusHistory, MemoTemplate, CompanyTag, ActivityLog)
  schemas.py           - Shared serialization (company_to_dict with tags)
  routes/
    projects.py        - Project CRUD API (list, get, create, update, delete)
    companies.py       - CRUD + CSV export + status history + bulk-status + duplicates + merge + tags + activities + rescrape + move-project (project_id scoped)
    keywords.py        - CRUD for search keywords (with cache, project_id scoped)
    dashboard.py       - Dashboard statistics including daily_collection_trend (30-day) (with cache, project_id scoped)
    scraper.py         - URL scraping endpoints (single + parallel bulk, project_id scoped)
    settings.py        - API key + auto-collect scheduler settings + slack_webhook_url + /slack-test endpoint
    rejected.py        - Rejected URL/domain management (project_id scoped)
    collector.py       - Auto-collection endpoints + directory/Google scrape/Shopify partner collection + history + SSE progress (/async + /progress/{job_id}) (project_id scoped)
    templates.py       - Memo + email template CRUD (with cache)
    master.py          - CompanyMaster CRUD (/search, /stats, /import)
  services/
    scraper.py         - Web scraping logic (BeautifulSoup) + scrape_urls_parallel
    scorer.py          - 100-point scoring system (with manual adjustment, supports custom scoring_rules per project)
    categorizer.py     - Category classification + flag detection (supports custom category_keywords and flag_definitions per project)
    collector.py       - Auto-collection orchestration (parallel scraping, project_id aware) + job_store for SSE progress + _upsert_company_master + _send_collection_slack
    slack.py           - Slack Incoming Webhook notification (send_slack_notification)
    aggregator.py      - Aggregator/matome site detection
    google_search.py   - Google Custom Search API client + daily usage tracking
    google_scrape.py   - Google search results direct scraping (API-free)
    directory_scraper.py - Directory/listing page scraper with pagination
    shopify_partners.py  - Shopify partner directory scraper
    google_places.py     - Google Places API client (Text Search + Place Details)
    cache.py           - Thread-safe in-memory TTL cache (cache_get, cache_set, cache_invalidate)
    scheduler.py       - Auto-collection scheduler (daily at configured time)
frontend/
  src/
    types/index.ts     - Shared TypeScript interfaces (Company, Project, ActivityLogEntry, etc.)
    constants/index.ts - Shared constants (CATEGORIES, STATUSES, RANKS, colors)
    api/index.ts       - Centralized API client with typed endpoints (including projects CRUD)
    contexts/
      ProjectContext.tsx - Project context provider (current project state, axios interceptor for project_id injection)
    hooks/
      useDebounce.ts   - Search debounce hook (300ms)
    components/
      common/          - Reusable UI components (ScoreBadge, FlagBadge, StatCard, Pagination, ResultRow)
      companies/       - Company-specific components
        CompanyFilterBar.tsx  - Filter bar (category, status, rank, contact, tag)
        CompanyEditModal.tsx  - Full detail edit modal with status history, templates, tags, activities, email, rescrape
        CompanyTable.tsx      - Company list table with checkbox, inline actions, rescrape
    pages/
      Dashboard.tsx    - Stats overview with charts (Recharts) + 30-day trend LineChart
      Companies.tsx    - Company list with bulk status, duplicate check/merge, project move modal
      Keywords.tsx     - Search keyword management
      Scraper.tsx      - URL scraping + multi-source collection (API w/ SSE real-time progress/directory/Google scrape/Shopify/Google Maps)
      Settings.tsx     - API key + auto-collect schedule + Google Places API key + Slack Webhook URL
      RejectedList.tsx - Rejected domain management
      CollectionHistory.tsx - Collection log viewer
      Templates.tsx    - Memo + email template management (tabbed)
      Projects.tsx     - Project management (create/edit/delete, category/flag/scoring customization)
      MasterDB.tsx     - Cross-project company master DB search + import to current project
    App.tsx            - Router + sidebar layout (lazy-loaded pages) + ProjectProvider + project selector
  dist/                - Built frontend (served by FastAPI)
```

## Module Dependencies (Frontend)
```
types → constants → api → hooks → components/common → components/companies → pages
```

## Module Dependencies (Backend)
```
models → schemas → services/{aggregator,google_search,scorer,categorizer,scraper,cache} → services/{collector,scheduler} → routes
```

## Key Features
- **Multi-project management**: プロジェクトごとに収集対象業種・カテゴリ・フラグ・スコアリング基準をカスタマイズ。サイドバーでプロジェクト切替可能
- **Master database**: 全プロジェクト横断の企業プール（company_master）。収集時に自動UPSERT。キーワード/カテゴリ/都道府県/スコアで検索して現在のプロジェクトにインポート可能
- **SSE real-time progress**: Google API収集を非同期化（/api/collect/async）し、EventSourceで進捗リアルタイム表示（プログレスバー）
- **Dashboard trend chart**: 直近30日の収集件数推移をLineChartで表示
- **Slack notifications**: 収集完了時にIncoming Webhook通知（成功件数>=1時）。設定画面からテスト送信可能
- **Cross-project company move**: 候補企業一覧で複数選択→プロジェクト間移動（重複ドメインはスキップ）
- **Auto-collection**: Google Custom Search API で検索キーワードに基づく候補企業の自動収集
- **Directory scraping**: 企業一覧ページ・ディレクトリサイトからの外部リンク収集（ページネーション対応）
- **Google direct scraping**: Google検索結果の直接スクレイピングによる収集（API不要）
- **Shopify partner collection**: Shopifyパートナーディレクトリおよび関連検索からの収集
- **Google Maps collection**: Google Places APIによるGoogleマップ上の企業収集（住所・電話・レビュー情報の補完あり）
- **Scheduled auto-collection**: 毎日指定時刻に自動収集実行（scheduler.py）
- **Parallel scraping**: ThreadPoolExecutor による最大5並列のスクレイピング
- **API response caching**: ダッシュボード60秒、キーワード/テンプレート30秒のTTLキャッシュ
- **API usage tracking**: Daily API usage counter with visual progress bar (free tier: 100/day)
- **Collection history log**: Records of each collection run with success/duplicate/rejected/error counts
- **Aggregator detection**: まとめサイト・比較サイト等の自動判定と拒否リスト化
- **URL scraping**: company info extraction (name, phone, email, location, contact page)
- **Re-scraping**: 既存企業の情報を最新に更新（score_adjustment維持）
- **Automatic categorization**: 9 categories (EC制作, Shopify支援, Amazon支援, etc.)
- **100-point scoring system**: Shopify+20, EC制作+15, 問い合わせフォーム+10, etc. + manual adjustment (-30~+30)
- **Detail edit modal**: Full company info editing with all fields, flags, category, score adjustment
- **Bulk status change**: 複数企業のステータスを一括変更
- **Duplicate detection & merge**: ドメイン正規化による重複検出とマージ
- **Tags/labels**: 企業にタグ付け + タグフィルタリング
- **Activity logs**: 営業アクティビティ記録（電話、メール、フォーム送信、面談等）
- **Email templates**: 変数展開付きメールテンプレート + mailto:リンク生成
- **Status change history**: Tracks all status changes with timestamps
- **Memo templates**: Reusable memo templates for quick note insertion
- **Sales status management**: 9 statuses from 未確認 to 代理店化
- **Dashboard charts**: Category pie chart, rank bar chart, status breakdown, prefecture distribution
- **CSV export** with filters
- **Search debounce**: 300ms debounce on filter search input
- **Code splitting**: React.lazy + Suspense for page-level code splitting
- **Rejected URL management**: まとめサイト等の手動・自動拒否リスト管理

## Database Tables
- `projects` - Project definitions with JSON fields: categories, category_keywords, flag_definitions, scoring_rules
- `companies` - Company records with all business fields, flags, scores (composite UNIQUE: website_url+project_id, compound indexes: project_id+status/rank/category), project_id FK
- `company_master` - Cross-project company pool (domain UNIQUE, indexes on category_main/score_rank/prefecture). Auto-UPSERTed on collection.
- `search_keywords` - Search keyword management, project_id FK
- `app_settings` - API key storage + auto-collect settings
- `rejected_urls` - Rejected domains for auto-collection filtering, project_id FK
- `api_usage_logs` - Daily API usage counter
- `collection_logs` - Collection run history, project_id FK
- `status_history` - Status change audit trail
- `memo_templates` - Reusable memo/email templates (is_email_template flag)
- `company_tags` - Tags/labels per company
- `activity_logs` - Sales activity log per company

## Workflow
- `Start application` - `python server/main.py` (port 5000, webview)

## Build
Frontend build: `npx vite build --config frontend/vite.config.ts`
