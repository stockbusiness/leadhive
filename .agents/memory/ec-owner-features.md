---
name: ECサイトオーナー向け機能強化
description: LeadHive のECサイトオーナー向けリスト収集・スコアリング・キーワード・テンプレート・フィルタリング機能の全実装記録。
---

## 実装概要

ECサイトオーナー（Shopify/BASE/STORES 等のECプラットフォーム利用者）を営業ターゲットとして特定・収集・スコアリング・アプローチする機能群（A〜F）を実装。また、リスト品質管理（website_status 検出・クリーニング）も同時に実装。

---

## A+B+D: バックエンド強化（スクレイパー・スコアリング）

### プラットフォーム検出 (`server/services/scraper.py`)

`detect_cms_type()` / `detect_cms_type_advanced()` で以下を検出：

**国内 EC カート（主要）**: Shopify, BASE, STORES, MakeShop, futureshop, ecbeing, カラーミー, EC-CUBE, ロリポップEC, aishipR, ショップサーブ, カート365, メルカート, Welcart, WACA, TEMPOSTAR, Square Online, 独自EC  
**モール**: Yahoo!ショッピング, 楽天市場, Amazon, メルカリShops  
**海外系**: WooCommerce, BigCommerce, Magento, Shopline, PrestaShop, OpenCart, Cafe24  
**CMS**: WordPress, Wix, Squarespace, Jimdo  
**追加検出（後続実装）**: Canaly, CrossMall, Smaregi, 楽楽EC, Hamee, TikTokショップ, Shopify Hydrogen

### 検出シグナル (`server/services/scraper.py`)
- `og:type=product` メタタグ検出
- `robots.txt` EC パターン（`/products`, `/cart`, `/checkout` の Disallow）
- 特商法ページ (`tokushoho` / `commercial` / `法律に基づく`) の存在検出
- 決済ページ URL パターン検出

### EC スケール判定 (`server/services/categorizer.py`, `server/services/scraper.py`)

`calculate_ec_scale(soup, html_source, ec_score)` で `large` / `medium` / `small` を返す。  
`calculate_ec_score()` で 0〜100 の EC スコアを算出（商品ページ推定・決済ページ・特商法・og:type 等）。

### スコアリング追加 (`server/services/scorer.py`)

| フラグ | 加点 | 説明 |
|-------|------|------|
| `ec_scale_large` | +10 | EC規模「大規模」 |
| `ec_scale_medium` | +5 | EC規模「中規模」 |
| `instagram_shop` | +8 | Instagram ショッピング |
| `tiktok_shop` | +8 | TikTok Shop |

### ec_scale フィルター実装 (`server/routes/companies.py`)

`Company.ec_scale` はDBカラムではなく `ec_score` 閾値で範囲フィルター:
- `large`: ec_score >= 70
- `medium`: 50 ≤ ec_score < 70
- `small`: 30 ≤ ec_score < 50

---

## C: ECキーワードテンプレート (`server/routes/keywords.py`)

**エンドポイント**: `GET /api/keywords/ec-templates`

返却するプリセットセット：

| id | label |
|----|-------|
| apparel | アパレル・ファッションEC |
| food | 食品・飲料・産直EC |
| cosme | コスメ・美容・健康EC |
| btob | BtoB EC・資材・卸売 |
| interior | インテリア・家具EC |
| sport | スポーツ・アウトドアEC |
| pet | ペット用品EC |
| hobby | 趣味・ホビー・ゲームEC |
| digital | デジタル・ガジェットEC |
| platform_shopify | Shopify 利用ECサイト |
| platform_base | BASE 利用ECサイト |
| platform_stores | STORES 利用ECサイト |
| scale_large | 大規模ECサイト |
| scale_medium | 中規模ECサイト |
| scale_small | 小規模・スタートアップEC |

### フロントエンド (`frontend/src/pages/Keywords.tsx`)

- `showEcTemplates` トグル（ボタン）でパネル表示
- テンプレート選択 → `addEcTemplateKeywords()` で一括キーワード追加
- 追加済みのテンプレートには ✅ バッジを表示

---

## E: 外部ECリスト収集サービス

### `server/services/ec_collector.py` (285行)

EC 特化型の検索クエリ生成モジュール：
- `EC_PLATFORM_QUERY_MAP`: プラットフォーム別検索クエリリスト（Shopify/BASE/STORES/MakeShop 等）
- `generate_ec_platform_queries(platform)`: プラットフォーム向けクエリ生成
- `filter_by_ec_score(companies, min_score)`: EC スコアでフィルタリング
- `filter_by_platform(companies, platform)`: プラットフォームでフィルタリング
- `is_social_commerce(url)`: ソーシャルコマース判定
- `is_headless_shopify(html)`: ヘッドレス Shopify 判定
- `get_ec_priority_label(company)`: 優先度ラベル生成
- `build_ec_search_operators(keyword, platform)`: EC 検索オペレータ生成
- `select_ec_keyword_set(industry)`: 業種別キーワードセット選択

### エンドポイント (`server/routes/collector.py`)

| パス | 説明 |
|------|------|
| `POST /api/collect/ec-discovery` | EC サイト発見（業種・地域・プラットフォーム指定） |
| `POST /api/collect/ec-platform` | プラットフォーム別収集 |
| `POST /api/collect/ec-matrix` | 業種×プラットフォームのマトリクス収集 |
| `POST /api/collect/ec-similar` | 類似 EC サイト収集 |

### フロントエンド (`frontend/src/pages/EcCollector.tsx`)

`/ec-collector` ルートに EC 収集専用ページ。業種プリセット選択・プラットフォーム指定・ジョブ進捗表示を実装。

---

## F: ECアプローチメッセージテンプレートプリセット (`server/routes/templates.py`)

**エンドポイント**: `GET /api/templates/ec-presets`

ECプラットフォーム別・業種別のメール/フォーム文面テンプレートを返す。  
`is_email: bool` フラグでメール用/フォーム用を分類。

### フロントエンド (`frontend/src/pages/Templates.tsx`)

- `showEcPresets` トグルでパネル表示
- `selectedEcPreset` でプリセット選択 → テンプレートに適用
- `filteredEcPresets` で `isEmailTab`（メール/フォーム）に応じて絞り込み

---

## T005: フロントエンド統合（ECフィルター）

### `frontend/src/components/companies/CompanyFilterBar.tsx`

フィルターバーに以下を追加：

| フィルター | UI | パラメーター |
|-----------|-----|-------------|
| CMS/プラットフォーム | `<select>` (optgroup でカテゴリ分け) | `cms_type` |
| EC判定 | `<select>`: EC企業のみ | `ec_only=true` |
| EC規模 | `<select>`: 大規模/中規模/小規模 | `ec_scale` |

クイックバッジ（下部）：
- 「🛍️ ECサイト: N社」ボタン → `ec_only=true` 即時適用
- CMS 別ボタン（ダッシュボード集計 `by_cms_type` を元に生成）
- 上位5件 + 「その他N件 ▼」折りたたみ

`CMS_COLORS` 定数でプラットフォーム別カラーバッジを定義。

---

## website_status 機能（付随実装）

### 検出 (`server/services/scraper.py`)

`detect_website_status(status_code, soup, text, final_url, original_url)` 関数。  
値: `active` / `dead` / `closed` / `parking` / `under_construction` / `redirect_external`

### フィルター (`server/routes/companies.py`)

`list_companies` の `website_status` パラメーター。`"problem"` で死活・閉鎖・駐車・工事中・外部リダイレクトを一括フィルター。

### リストクリーニング API

| パス | 説明 |
|------|------|
| `POST /api/companies/list-clean/start` | バックグラウンドジョブ開始（ops: check_status/backfill_form/normalize） |
| `GET /api/companies/list-clean/{job_id}` | 進捗ポーリング |
| `GET /api/companies/website-status-summary` | ステータス別件数サマリー |

**重要**: `company_id: int` 型指定のため `/{company_id}` と固定パス（`/website-status-summary` 等）は競合しない。

---

## E2Eテスト確認済み機能（2026-06-04）

- `/companies`: CMS フィルタードロップダウン + EC判定 + EC規模フィルター + ECフィルター解除バナー ✅
- `/keywords`: ECテンプレートボタン → プリセット表示・一括追加 ✅
- `/templates`: EC プリセットセクション表示 ✅
- `/ec-collector`: EC収集UI（業種プリセット選択） ✅

**Why:** ECサイトオーナーは LeadHive の主要ターゲット顧客セグメント。プラットフォーム別の検出・スコアリング・収集・アプローチ文面の一気通貫により、EC特化の営業フローを自動化できる。
