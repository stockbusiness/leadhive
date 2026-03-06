# ESCMS 代理店候補収集ツール

## Overview
EC/Shopify制作会社などの代理店候補企業を収集・評価・管理するWebアプリケーション。
Google Custom Search APIによる自動収集、またはURLの手動入力でスクレイピングし、会社情報を自動抽出。スコアリング・カテゴリ分類を行い、営業活動に活用できる状態に整理する。

## Architecture
- **Frontend**: React + TypeScript + Tailwind CSS (Vite build, served as static files)
- **Backend**: FastAPI (Python) on port 5000
- **Database**: PostgreSQL (Replit built-in)
- **Scraping**: BeautifulSoup4 + Requests
- **Search API**: Google Custom Search API (APIキーは管理画面で設定)

## Project Structure
```
server/
  main.py              - FastAPI app entry point (port 5000)
  database.py          - SQLAlchemy database connection
  models.py            - SQLAlchemy models (Company, SearchKeyword, AppSetting, RejectedUrl)
  routes/
    companies.py       - CRUD + CSV export for companies
    keywords.py        - CRUD for search keywords
    dashboard.py       - Dashboard statistics
    scraper.py         - URL scraping endpoints
    settings.py        - API key settings management
    rejected.py        - Rejected URL/domain management
    collector.py       - Auto-collection endpoints (Google Search → scrape → register)
  services/
    scraper.py         - Web scraping logic (BeautifulSoup)
    scorer.py          - 100-point scoring system
    categorizer.py     - Category classification + flag detection
    collector.py       - Auto-collection logic (Google Search API + aggregator detection)
frontend/
  src/
    App.tsx            - Router + sidebar layout
    pages/
      Dashboard.tsx    - Stats overview
      Companies.tsx    - Company list with filters
      Keywords.tsx     - Search keyword management
      Scraper.tsx      - URL scraping + auto-collection interface
      Settings.tsx     - API key configuration
      RejectedList.tsx - Rejected domain management
  dist/                - Built frontend (served by FastAPI)
```

## Key Features
- **Auto-collection**: Google Custom Search API で検索キーワードに基づく候補企業の自動収集
- **Aggregator detection**: まとめサイト・比較サイト等の自動判定と拒否リスト化
- **URL scraping**: company info extraction (name, phone, email, location, contact page)
- **Automatic categorization**: 9 categories (EC制作, Shopify支援, Amazon支援, etc.)
- **100-point scoring system**: Shopify+20, EC制作+15, 問い合わせフォーム+10, etc.
- **Sales status management**: 9 statuses from 未確認 to 代理店化
- **CSV export** with filters
- **Duplicate detection** by domain
- **Rejected URL management**: まとめサイト等の手動・自動拒否リスト管理

## Database Tables
- `companies` - Company records with all business fields, flags, scores, and status
- `search_keywords` - Search keyword management
- `app_settings` - API key storage (Google API Key, Search Engine ID)
- `rejected_urls` - Rejected domains for auto-collection filtering

## Workflow
- `Start application` - `python server/main.py` (port 5000, webview)

## Build
Frontend build: `npx vite build --config frontend/vite.config.ts`
