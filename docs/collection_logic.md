# LeadHive 収集ロジック 技術資料

**対象読者:** バックエンドエンジニア・インフラ担当者  
**最終更新:** 2026年3月

---

## 目次

1. [システム全体構成](#1-システム全体構成)
2. [収集モードの種類](#2-収集モードの種類)
3. [gBizINFO APIインターフェース](#3-gbizinfo-apiインターフェース)
4. [マスターDB自動収集（AutoMaster）](#4-マスターdb自動収集automaster)
5. [プロジェクト向け手動収集](#5-プロジェクト向け手動収集)
6. [企業情報スクレイピング](#6-企業情報スクレイピング)
7. [業種分類・フラグ検出](#7-業種分類フラグ検出)
8. [スコアリングロジック](#8-スコアリングロジック)
9. [重複排除ロジック](#9-重複排除ロジック)
10. [DBスキーマ（収集関連）](#10-dbスキーマ収集関連)
11. [スケジューラー・バックグラウンド処理](#11-スケジューラーバックグラウンド処理)
12. [SystemSettings キー一覧](#12-systemsettings-キー一覧)
13. [収集フロー完全図](#13-収集フロー完全図)

---

## 1. システム全体構成

```
┌─────────────────────────────────────────────────────────────┐
│                        LeadHive                             │
│                                                             │
│  ┌──────────────┐     ┌──────────────┐    ┌─────────────┐  │
│  │  React SPA   │────▶│  FastAPI     │───▶│ PostgreSQL  │  │
│  │  (Vite)      │     │  (Python)    │    │             │  │
│  └──────────────┘     └──────┬───────┘    └─────────────┘  │
│                              │                              │
│                    ┌─────────▼─────────┐                   │
│                    │  Services Layer    │                   │
│                    │                   │                   │
│                    │ gbiz_collector.py │──▶ gBizINFO API   │
│                    │ scraper.py        │──▶ 各企業サイト    │
│                    │ categorizer.py    │                   │
│                    │ scorer.py         │                   │
│                    │ scheduler.py      │                   │
│                    └───────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

**ファイル構成（収集関連）:**

| ファイル | 役割 |
|---|---|
| `server/services/gbiz_collector.py` | gBizINFO APIラッパー・企業URL検索 |
| `server/services/collector.py` | プロジェクト向け収集ロジック・job管理・UpsertMaster |
| `server/services/scheduler.py` | AutoMaster夜間スケジューラー |
| `server/services/scraper.py` | Webスクレイピング |
| `server/services/categorizer.py` | 業種分類・フラグ検出 |
| `server/services/scorer.py` | スコア算出 |
| `server/services/aggregator.py` | ドメイン正規化・アグリゲーター判定 |
| `server/routes/admin_auto_master.py` | AutoMaster管理API |

---

## 2. 収集モードの種類

LeadHiveには2つの独立した収集モードがある。

| 項目 | AutoMaster（全国DB自動収集） | プロジェクト収集（手動） |
|---|---|---|
| 目的 | 全国企業マスターDB構築 | 特定プロジェクトへの見込み客追加 |
| トリガー | 夜間スケジューラー / 管理画面 | ユーザー操作 |
| 保存先 | `company_master` テーブル | `company` テーブル |
| 対象 | 全47都道府県×5キーワード | ユーザー設定のキーワード・地域 |
| スクレイピング | URL補完のみ（オプション） | 全社フルスクレイピング |

---

## 3. gBizINFO APIインターフェース

### エンドポイント

```
GET https://info.gbiz.go.jp/hojin/v1/hojin
```

### 認証

```python
headers = {
    "X-hojinInfo-api-token": "<APIトークン>",
    "Accept": "application/json",
}
```

APIトークンの参照優先順位（`gbiz_collector.py:42-49`）:

```
1. 環境変数 GbizAPIkey
2. 環境変数 GBIZINFO_API_TOKEN
3. 環境変数 GBIZ_API_TOKEN
4. SystemSettings.key = "gbizinfo_api_token"（DB設定）
```

### クエリパラメータ

| パラメータ | 型 | 説明 |
|---|---|---|
| `name` | string | 法人名キーワード（例: "株式会社"） |
| `prefecture` | string | **都道府県コード（数値2桁）** ※"北海道"ではなく"01" |
| `page` | int | ページ番号（1始まり） |

> **重要:** `prefecture` は日本語名ではなく数値コード（`PREFECTURE_CODES` 辞書で変換）。
> 誤って `area=北海道` パラメータを使用すると、無関係な東京企業が返るバグが存在したため修正済み。

### 都道府県コード対応表

```python
PREFECTURE_CODES = {
    "北海道": "01", "青森県": "02", ... , "沖縄県": "47"
}
```

### レスポンス構造

```json
{
  "total_page_count": 10,
  "hojin-infos": [
    {
      "name": "株式会社サンプル",
      "corporate_number": "1234567890123",
      "location": "北海道札幌市中央区...",
      "company_url": "https://example.com",
      "business_summary": "..."
    }
  ]
}
```

> **注意:** `hojin-infos` キーが `null` の場合がある → `data.get("hojin-infos") or []` で安全処理。

### ページネーション仕様

- 1ページ = 最大1,000件
- `total_page_count` で全ページ数を確認
- `is_last_page` フラグ（内部）: `len(companies) == 0` または `page >= total_page_count`
- 404 レスポンスは「データなし」として扱う（例外ではない）

### 実測データ規模（2026年3月時点）

| 条件 | ページ数 | 件数 |
|---|---|---|
| 北海道 / 株式会社 | 10ページ | 約10,000社 |
| 全国 / 株式会社 | 数百ページ | 数十万社 |
| 全組み合わせ合計 | - | **推定230万社以上** |

---

## 4. マスターDB自動収集（AutoMaster）

### 概要

`scheduler.py` の `_run_auto_master_collect()` が核心。管理者が「今すぐ実行」または夜間スケジューラーから呼び出す。

### 収集状態管理（SystemSettings）

収集の進捗はDBの `system_settings` テーブルに Key-Value で保持する。

```
auto_master_pref_idx    = 現在の都道府県インデックス（0-46）
auto_master_keyword_idx = 現在のキーワードインデックス（0-4）
auto_master_page_idx    = 現在の開始ページ番号（1始まり）
auto_master_max_companies = 1回の実行で保存する目標件数
auto_master_max_enrich    = URL補完の最大実行件数
```

### 収集キーワード一覧

```python
AUTO_MASTER_KEYWORDS = ["株式会社", "合同会社", "有限会社", "医療法人", "社会福祉法人"]
```

### 収集フロー（詳細）

```
_run_auto_master_collect()
│
├─ 1. SystemSettingsから状態読み込み
│      pref_idx, keyword_idx, page_idx, max_companies, max_enrich
│
├─ 2. 既存レコードをメモリにロード（重複排除用）
│      existing_corp_nums = SET { 全corporate_number }   ← 一括クエリ
│      existing_domains   = SET { 全domain }             ← 一括クエリ
│
├─ 3. ページループ（start_page から最大9999ページ）
│   │
│   ├─ search_gbiz(token, keyword, prefecture, page)
│   │       ↓ 最大1,000件/ページ
│   │
│   ├─ 各企業を処理:
│   │   ├─ corp_num が existing_corp_nums に存在 → skipped++, continue
│   │   ├─ company_url あり → domain = normalize_domain(url)
│   │   │       domain が existing_domains に存在 → skipped++, continue
│   │   │       is_aggregator_site(domain) → continue
│   │   │       → scrape_company_info(url) でスクレイピング
│   │   │       → categorize_company(), detect_flags(), calculate_score()
│   │   │       → _upsert_company_master() で保存
│   │   │       → existing_domains.add(domain)
│   │   ├─ company_url なし AND enrich_count < max_enrich
│   │   │       → find_website_for_company() でURL検索
│   │   │       → （成功した場合）スクレイピングパスへ
│   │   └─ company_url なし AND 補完なし → 企業名・住所のみ保存（score=0, rank=D）
│   │
│   ├─ saved >= max_companies → ループ終了（目標達成）
│   └─ is_last_page == True  → combo_finished = True, ループ終了
│
└─ 4. 状態保存
       combo_finished == True:
           keyword_idx++（全keyword消化でpref_idx++、page_idx=1にリセット）
       combo_finished == False:
           page_idx = next_page（同じpref/keywordの次ページから再開）
```

### 次回再開の仕組み

```
実行1: 北海道/株式会社 p1〜p5 → 1000社保存 → page_idx=6 で停止
実行2: 北海道/株式会社 p6〜p10 → 1000社保存 → p10が最終→ keyword_idx++ → 北海道/合同会社 p1 へ
実行3: 北海道/合同会社 p1〜 → 1000社保存 → page_idx=... で停止
...
実行N: 沖縄県/社会福祉法人 全ページ完了 → pref_idx=0, keyword_idx=0, page_idx=1 に戻る
```

47都道府県 × 5キーワード = **235の組み合わせ**を順番に網羅。

### URL補完（Enrich）

gBizINFOのデータにURLが含まれない場合（約60〜80%）、Google検索で公式サイトを探す。

```python
def find_website_for_company(company_name, location, db, org_id):
    city = location から市区町村名を抽出
    query = f'"{company_name}" {city} 公式サイト'

    # 優先1: Google Custom Search API（org_idのAPI設定を使用）
    if org_id かつ google_api_key設定あり:
        → search_google(api_key, cx, query)

    # フォールバック: Google検索直接スクレイピング
    → scrape_google_search(query, num=3)

    # アグリゲーターサイト（hotpepper等）を除外
    → is_aggregator_site(domain) == True なら skip
```

> `max_enrich`（デフォルト10件/回）でAPI消費を制限。Google APIの429エラーを防ぐため設定。

---

## 5. プロジェクト向け手動収集

`collector.py` の `collect_from_gbiz()` が担当。`company` テーブルに保存する（`company_master` とは別）。

### フロー

```
collect_from_gbiz(job_id, project_id, org_id, keyword, prefecture, max_results, db)
│
├─ 1. gBizINFOから最大max_results×3件を取得（フィルタ後に十分な数が残るよう）
│
├─ 2. 各企業を処理:
│   ├─ URLなし → find_website_for_company() でURL探索
│   ├─ ドメイン正規化 → normalize_domain(url)
│   ├─ 重複チェック → project内の既存domain/rejected_domain
│   ├─ アグリゲーター判定 → is_aggregator_site()
│   ├─ スクレイピング → scrape_company_info(url)
│   ├─ 分類 → categorize_company(), detect_flags()
│   ├─ スコア → calculate_score()
│   └─ DB保存 → company テーブル + _upsert_company_master()
│
└─ 3. summary返却 {success, duplicate, skipped, error}
```

---

## 6. 企業情報スクレイピング

`scraper.py` の `scrape_company_info(url)` が担当。

### 取得フィールド

| フィールド | 取得方法 |
|---|---|
| `company_name` | `og:site_name`, `title`, 各種メタタグ |
| `phone` | 正規表現（固定電話・携帯）|
| `email` | 正規表現 |
| `contact_url` | `/contact`, `/inquiry` 等のリンクをたどる |
| `prefecture` / `city` | テキスト中の都道府県・市区町村名 |
| `full_text` | ページ全文（分類・フラグ検出に使用） |
| `website_url` | 入力URL |
| `domain` | normalize_domain(url) |

### リトライ・タイムアウト

```python
scrape_company_info(url, max_retries=3)
```
- 3回リトライ、指数バックオフ
- User-Agentランダム切替でボット対策

---

## 7. 業種分類・フラグ検出

### 業種分類（`categorize_company`）

スクレイピングした `full_text` をキーワードマッチングで分類。

```python
CATEGORY_KEYWORDS = {
    "Shopify支援":   ["shopify", "ショッピファイ"],
    "EC制作":        ["ec制作", "ecサイト制作", "ecサイト構築", ...],
    "ECコンサル":    ["ecコンサル", "ec支援", ...],
    "EC運営代行":    ["ec運営代行", "ec運用代行", ...],
    "EC広告代理店":  ["ec広告", "ec集客", ...],
    "Amazon支援":    ["amazon", "アマゾン"],
    "楽天支援":      ["楽天", "rakuten"],
    "Web制作":       ["web制作", "ウェブ制作", ...],
}
```

- マッチした最初のカテゴリ → `category_main`
- 2番目 → `category_sub`
- 未マッチ → `"その他"`

### フラグ検出（`detect_flags`）

```python
DEFAULT_FLAG_KEYWORDS = {
    "shopify_flag":    ["shopify", "ショッピファイ"],
    "ec_flag":         ["ec", "eコマース", "ネットショップ", "通販"],
    "amazon_flag":     ["amazon", "アマゾン"],
    "rakuten_flag":    ["楽天", "rakuten"],
    "consulting_flag": ["コンサル", "支援", "戦略"],
    "operation_flag":  ["運営代行", "運用代行"],
    "production_flag": ["制作", "構築", "開発"],
}
```

戻り値は `{フラグ名: bool}` の辞書。

---

## 8. スコアリングロジック

`scorer.py` の `calculate_score(company_data)` が担当。

### デフォルトルール

| 条件 | 点数 |
|---|---|
| `shopify_flag` = True | +20 |
| `production_flag` = True | +15 |
| `consulting_flag` = True | +15 |
| `operation_flag` = True | +15 |
| `contact_url` あり | +10 |
| `amazon_flag` AND `rakuten_flag` | +10（マルチプラットフォーム）|
| `phone` あり | +5 |
| `prefecture` or `city` あり | +5 |
| 基本情報2項目未満 | -10 |
| `contact_url` なし | -15 |
| EC関連フラグ全てFalse | -20 |

### ランク基準

| スコア | ランク |
|---|---|
| 80〜100 | **A** |
| 60〜79 | **B** |
| 40〜59 | **C** |
| 0〜39 | **D** |

スコアは 0〜100 にクランプ。カスタムルールはOrg設定で上書き可能。

---

## 9. 重複排除ロジック

### AutoMasterでの重複排除（実行単位）

```python
# 実行開始時に一括ロード（O(n)）
existing_corp_nums = SET( SELECT corporate_number FROM company_master WHERE ... )
existing_domains   = SET( SELECT domain FROM company_master WHERE ... )

# 各企業の処理前にO(1)チェック
if corp_num in existing_corp_nums: skipped++; continue
if domain in existing_domains:     skipped++; continue

# 保存後にセットに追加（同一実行内の重複も防止）
existing_corp_nums.add(corp_num)
existing_domains.add(domain)
```

> **理由:** 企業数が数万件に増えても、DBクエリ1本 + メモリ上のset検索でO(1)。1社ずつDBに問い合わせると数十万回のクエリが発生するため不採用。

### `_upsert_company_master` のUpsertロジック

```python
def _upsert_company_master(db, company_data, domain, source, corporate_number):
    # 1. domainで既存レコードを検索
    existing = db.query(CompanyMaster).filter(CompanyMaster.domain == domain).first()
    # 2. なければcorporate_numberで検索
    if not existing and corp_num:
        existing = db.query(CompanyMaster).filter(...corporate_number == corp_num).first()

    if existing:
        # 既存レコードを更新（フィールドをマージ）
        existing.company_name = ...
        existing.last_scraped_at = now()
    else:
        # 新規INSERT
        db.add(CompanyMaster(...))

    db.commit()
```

### プロジェクト収集での重複排除

```python
existing_domains = SET( project内の全company.domain )
rejected_domains = SET( project内の全rejected_url.domain )

# 各企業処理時:
if domain in existing_domains: duplicate++; continue
if domain in rejected_domains: skipped++;   continue
```

---

## 10. DBスキーマ（収集関連）

### `company_master` テーブル

全ユーザー共通の企業マスターDB。

```sql
CREATE TABLE company_master (
    id               SERIAL PRIMARY KEY,
    domain           VARCHAR(255) UNIQUE,        -- NULL許容（URL不明企業用）
    corporate_number VARCHAR(14)  UNIQUE,        -- 法人番号 13桁+チェックディジット
    company_name     VARCHAR(255),
    website_url      TEXT,
    contact_url      TEXT,
    phone            VARCHAR(50),
    email            VARCHAR(255),
    prefecture       VARCHAR(50),
    city             VARCHAR(100),
    category_main    VARCHAR(100),
    category_sub     VARCHAR(100),
    shopify_flag     BOOLEAN DEFAULT FALSE,
    ec_flag          BOOLEAN DEFAULT FALSE,
    amazon_flag      BOOLEAN DEFAULT FALSE,
    rakuten_flag     BOOLEAN DEFAULT FALSE,
    consulting_flag  BOOLEAN DEFAULT FALSE,
    operation_flag   BOOLEAN DEFAULT FALSE,
    production_flag  BOOLEAN DEFAULT FALSE,
    score_total      INTEGER DEFAULT 0,
    score_rank       VARCHAR(1) DEFAULT 'D',
    source           VARCHAR(100),               -- 'auto_master', 'gbiz', 'manual' 等
    search_text      TEXT,                       -- 全文検索用（lower化済み）
    last_scraped_at  TIMESTAMP,
    created_at       TIMESTAMP DEFAULT NOW()
);
```

### `company` テーブル

プロジェクト別の企業リスト（company_masterとは独立）。

```sql
CREATE TABLE company (
    id               SERIAL PRIMARY KEY,
    project_id       INTEGER REFERENCES project(id),
    corporate_number VARCHAR(13),
    domain           VARCHAR(255) INDEX,
    company_name     VARCHAR(255),
    -- ... company_masterと同様のフィールド群
    status           VARCHAR(50) DEFAULT 'new',   -- new/contacted/replied/rejected
    notes            TEXT,
    follow_up_date   DATE,
    score_adjustment INTEGER DEFAULT 0,
    score_total      INTEGER DEFAULT 0,
    score_rank       VARCHAR(1) DEFAULT 'D',
    created_at       TIMESTAMP DEFAULT NOW()
);
```

### `system_settings` テーブル

AutoMaster進捗管理用。

```sql
CREATE TABLE system_settings (
    id    SERIAL PRIMARY KEY,
    key   VARCHAR(255) UNIQUE NOT NULL,
    value TEXT
);
```

---

## 11. スケジューラー・バックグラウンド処理

### スレッド構成

```python
# server/main.py（起動時）
scheduler_thread = threading.Thread(target=_scheduler_loop, daemon=True)
scheduler_thread.start()

def _scheduler_loop():
    while True:
        time.sleep(60)  # 1分ごとにチェック
        hour = datetime.now().hour
        if hour == schedule_hour and enabled:
            _run_auto_master_collect()
```

### Jobストア（非同期ジョブ管理）

```python
_job_store: dict[str, dict] = {}  # インメモリ（プロセスローカル）

def job_update(job_id, **kwargs):
    _job_store[job_id].update(kwargs)

# ジョブ状態フィールド:
# type:    "progress" | "done" | "error"
# current: 現在処理件数
# total:   目標件数
# message: 表示メッセージ
# result:  完了時の集計結果
```

> **注意:** `_job_store` はインメモリのため、Autoscaleデプロイ環境ではプロセス間で共有されない。
> ポーリング方式（フロントが3秒ごとに `/api/admin/auto-master/status` を叩く）で完了検知しているため、実用上は問題ない。
> SSEはAutoscale環境での長時間接続非対応のため不使用。

### 管理APIエンドポイント

```
GET  /api/admin/auto-master/status        現在の収集進捗・設定を返す
POST /api/admin/auto-master/settings      設定更新（max_companies等）
POST /api/admin/auto-master/run-now       手動実行トリガー（別スレッド起動）
POST /api/admin/auto-master/reset-progress 進捗リセット（北海道p1から）
POST /api/admin/auto-master/clear-master-data 自動収集データ全削除
```

---

## 12. SystemSettings キー一覧

| Key | デフォルト | 説明 |
|---|---|---|
| `auto_master_enabled` | `"false"` | 夜間自動実行ON/OFF |
| `auto_master_pref_idx` | `"0"` | 現在の都道府県インデックス（0=北海道） |
| `auto_master_keyword_idx` | `"0"` | 現在のキーワードインデックス |
| `auto_master_page_idx` | `"1"` | 現在の組み合わせの開始ページ |
| `auto_master_max_companies` | `"1000"` | 1回の実行で保存する目標新規件数 |
| `auto_master_max_enrich` | `"10"` | 1回の実行でURL補完する最大件数 |
| `auto_master_schedule_hour` | `"3"` | 夜間実行の時刻（0-23、JST基準） |
| `auto_master_last_run` | `""` | 最終実行日時（UTC ISO形式） |
| `auto_master_last_count` | `"0"` | 最終実行での新規保存件数 |
| `auto_master_total_collected` | `"0"` | 累計保存件数 |
| `gbizinfo_api_token` | `""` | gBizINFO APIトークン（環境変数優先） |

---

## 13. 収集フロー完全図

```
[管理者 / スケジューラー]
        │
        ▼
_run_auto_master_collect(job_id)
        │
        ├─ API Token 取得
        │   GbizAPIkey(env) > GBIZINFO_API_TOKEN(env) > GBIZ_API_TOKEN(env) > DB設定
        │
        ├─ 状態読み込み
        │   pref_idx=N, keyword_idx=M, start_page=P, max_companies=K
        │
        ├─ 既存法人番号・ドメイン一括ロード（重複排除SET）
        │
        ├─ ページループ（P, P+1, P+2, ...）
        │   │
        │   ├─ gBizINFO API コール
        │   │   GET /hojin/v1/hojin?name=<keyword>&prefecture=<code>&page=<N>
        │   │   → 最大1,000件/page
        │   │
        │   └─ 各企業処理
        │       │
        │       ├─ [重複チェック] corp_num in SET → SKIP
        │       │
        │       ├─ [URLあり]
        │       │   ├─ domain正規化
        │       │   ├─ [重複チェック] domain in SET → SKIP
        │       │   ├─ [アグリゲーター] is_aggregator_site() → SKIP
        │       │   ├─ scrape_company_info(url)
        │       │   │       ↓ 取得: name, phone, email, contact_url, full_text, ...
        │       │   ├─ categorize_company(full_text) → category_main, category_sub
        │       │   ├─ detect_flags(full_text) → shopify_flag, ec_flag, ...
        │       │   ├─ calculate_score(data) → score(0-100), rank(A/B/C/D)
        │       │   └─ _upsert_company_master(db, data, domain, "auto_master")
        │       │
        │       ├─ [URLなし & enrich可]
        │       │   ├─ find_website_for_company(name, location)
        │       │   │   ├─ Google Custom Search API（org設定あり）
        │       │   │   └─ Google直接スクレイピング（フォールバック）
        │       │   └─ → URLありパスへ
        │       │
        │       └─ [URLなし & enrich不可 or 補完失敗]
        │           └─ 企業名・住所のみ保存（score=0, rank=D）
        │
        ├─ saved >= max_companies → ページ途中停止
        │   page_idx = 現在ページ+1 を保存（次回ここから再開）
        │   pref_idx, keyword_idx は変更なし
        │
        └─ is_last_page → 組み合わせ完了
            keyword_idx++ （全keyword消化でpref_idx++, page_idx=1）

[フロントエンド: 3秒ポーリング]
    GET /api/admin/auto-master/status
    → pref_idx / keyword_idx / page_idx の変化で完了検知
```

---

*LeadHive — COOLWORKS株式会社*
