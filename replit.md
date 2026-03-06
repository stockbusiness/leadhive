# ESCMS 代理店候補収集ツール

## Overview
EC/Shopify制作会社などの代理店候補企業を収集・評価・管理するWebアプリケーション。
Google Custom Search APIによる自動収集、またはURLの手動入力でスクレイピングし、会社情報を自動抽出。スコアリング・カテゴリ分類を行い、営業活動に活用できる状態に整理する。

## Architecture
- **Frontend**: React + TypeScript + Tailwind CSS + Recharts (Vite build, served as static files)
- **Backend**: FastAPI (Python) on port 5000
- **Database**: PostgreSQL (Replit built-in)
- **Scraping**: BeautifulSoup4 + Requests
- **Search API**: Google Custom Search API (APIキーは管理画面で設定)

## Project Structure
```
server/
  main.py              - FastAPI app entry point (port 5000)
  database.py          - SQLAlchemy database connection
  models.py            - SQLAlchemy models (Company, SearchKeyword, AppSetting, RejectedUrl, ApiUsageLog, CollectionLog, StatusHistory, MemoTemplate)
  routes/
    companies.py       - CRUD + CSV export + status history for companies
    keywords.py        - CRUD for search keywords
    dashboard.py       - Dashboard statistics (with API usage, recent companies, prefecture breakdown)
    scraper.py         - URL scraping endpoints
    settings.py        - API key settings management
    rejected.py        - Rejected URL/domain management
    collector.py       - Auto-collection endpoints + collection history
    templates.py       - Memo template CRUD
  services/
    scraper.py         - Web scraping logic (BeautifulSoup)
    scorer.py          - 100-point scoring system (with manual adjustment)
    categorizer.py     - Category classification + flag detection
    collector.py       - Auto-collection logic (Google Search API + aggregator detection + API usage tracking + collection logging)
frontend/
  src/
    App.tsx            - Router + sidebar layout
    pages/
      Dashboard.tsx    - Stats overview with charts (Recharts), API usage counter, recent companies
      Companies.tsx    - Company list with filters, detail edit modal, score adjustment, status history
      Keywords.tsx     - Search keyword management
      Scraper.tsx      - URL scraping + auto-collection interface
      Settings.tsx     - API key configuration
      RejectedList.tsx - Rejected domain management
      CollectionHistory.tsx - Collection log viewer
      Templates.tsx    - Memo template management
  dist/                - Built frontend (served by FastAPI)
```

## Key Features
- **Auto-collection**: Google Custom Search API で検索キーワードに基づく候補企業の自動収集
- **API usage tracking**: Daily API usage counter with visual progress bar (free tier: 100/day)
- **Collection history log**: Records of each collection run with success/duplicate/rejected/error counts
- **Aggregator detection**: まとめサイト・比較サイト等の自動判定と拒否リスト化
- **URL scraping**: company info extraction (name, phone, email, location, contact page)
- **Automatic categorization**: 9 categories (EC制作, Shopify支援, Amazon支援, etc.)
- **100-point scoring system**: Shopify+20, EC制作+15, 問い合わせフォーム+10, etc. + manual adjustment (-30~+30)
- **Detail edit modal**: Full company info editing with all fields, flags, category, score adjustment
- **Status change history**: Tracks all status changes with timestamps
- **Memo templates**: Reusable memo templates for quick note insertion
- **Sales status management**: 9 statuses from 未確認 to 代理店化
- **Dashboard charts**: Category pie chart, rank bar chart, status breakdown, prefecture distribution
- **CSV export** with filters
- **Duplicate detection** by domain
- **Rejected URL management**: まとめサイト等の手動・自動拒否リスト管理

## Database Tables
- `companies` - Company records with all business fields, flags, scores (incl. score_adjustment), and status
- `search_keywords` - Search keyword management
- `app_settings` - API key storage (Google API Key, Search Engine ID)
- `rejected_urls` - Rejected domains for auto-collection filtering
- `api_usage_logs` - Daily API usage counter
- `collection_logs` - Collection run history
- `status_history` - Status change audit trail
- `memo_templates` - Reusable memo templates

## Workflow
- `Start application` - `python server/main.py` (port 5000, webview)

## Build
Frontend build: `npx vite build --config frontend/vite.config.ts`
