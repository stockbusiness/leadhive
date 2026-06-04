---
name: ECサイトオーナー向け機能強化
description: LeadHive のECサイトオーナー向けリスト収集・スコアリング・キーワード機能、およびwebsite_status/リストクリーニング機能の実装記録。
---

## 実装概要

ECサイトオーナー（BASEやShopify等のECプラットフォーム利用者）を営業ターゲットとして特定・収集・スコアリングする機能を強化した。
またリストの品質管理としてwebsite_status（サイト稼働状態）の検出・フィルタリング・クリーニング機能を追加した。

## プラットフォーム検出 (`server/services/scraper.py`)

以下の7プラットフォームを追加検出対応：
- Canaly, CrossMall, Smaregi, 楽楽EC, Hamee, TikTokショップ, Shopify Hydrogen

## website_status 検出 (`server/services/scraper.py`)

`detect_website_status(status_code, soup, text, final_url, original_url)` 関数を追加。
値: `active` / `dead` / `closed` / `parking` / `under_construction` / `redirect_external`

**重要:** `company_id: int` 型指定により、`/{company_id}` は非整数パスと競合しない。
固定パスを `/{company_id}` より後に定義しても安全（"website-status-summary", "csv" 等）。

## スコアリング強化 (`server/services/scorer.py`)

| フラグ | 加点 | 説明 |
|-------|------|------|
| `instagram_shop` | +8 | Instagram ショッピング機能検出 |
| `tiktok_shop` | +8 | TikTok Shop 検出 |

## ec_scale フィルターバグ修正 (`server/routes/companies.py`)

`Company.ec_scale` はDBカラムではなく、`ec_score` の閾値で範囲フィルター：
- large: ec_score >= 70
- medium: 50 <= ec_score < 70
- small: 30 <= ec_score < 50

## website_status フィルター (`server/routes/companies.py`)

`list_companies` エンドポイントに `website_status` クエリパラメータを追加。
`"problem"` 指定時は dead/closed/parking/under_construction/redirect_external を一括フィルター。

## リストクリーニングAPI (`server/routes/companies.py`)

- `POST /api/companies/list-clean/start` — バックグラウンドジョブ開始
- `GET /api/companies/list-clean/{job_id}` — 進捗ポーリング
- `GET /api/companies/website-status-summary` — ステータス別件数サマリー

ops: `check_status` / `backfill_form` / `normalize` の3種類を選択可能。

## キーワードテンプレート追加 (`server/routes/keywords.py`)

ECサイトオーナー向けに3テンプレートを追加：
- ECプラットフォーム別（Shopify/BASE/STORES）
- EC規模別（小規模・中規模・大規模）
- EC業種別（アパレル・食品・コスメ等）

## EC専用サービスモジュール (`server/services/ec_collector.py`)

`generate_ec_platform_queries()`, `filter_by_ec_score()`, `filter_by_platform()`,
`is_social_commerce()`, `is_headless_shopify()`, `get_ec_priority_label()`,
`build_ec_search_operators()`, `select_ec_keyword_set()` を実装。

## フロントエンド

- `frontend/src/pages/ECDiscovery.tsx` — ECサイト発見専用ページ（`/ec-discovery`）
- `CompanyFilterBar.tsx` — `website_status` フィルタードロップダウン追加
- `Companies.tsx` — website_status バナー・リストクリーニングモーダル・クリーンジョブポーリング追加

**Why:** ECサイトオーナーは LeadHive の主要ターゲット顧客セグメント。プラットフォーム別に検出・スコアリングすることで、アプローチ優先度を自動判定できる。
リストクリーニングは収集済みリストの品質劣化（閉鎖サイト・電話番号表記ゆれ）を一括修正する運用機能。
