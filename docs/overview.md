# ESCMS 代理店候補収集ツール — 機能概要・仕様書

## 目次

1. [システム概要](#1-システム概要)
2. [技術スタック](#2-技術スタック)
3. [画面・機能一覧](#3-画面機能一覧)
4. [データ収集の仕組み](#4-データ収集の仕組み)
5. [スコアリング・ランク算出ロジック](#5-スコアリングランク算出ロジック)
6. [カテゴリ分類ロジック](#6-カテゴリ分類ロジック)
7. [マスターデータベースの仕組み](#7-マスターデータベースの仕組み)
8. [SSEリアルタイム進捗の仕組み](#8-sseリアルタイム進捗の仕組み)
9. [Slack通知の仕組み](#9-slack通知の仕組み)
10. [データベース設計](#10-データベース設計)
11. [APIエンドポイント一覧](#11-apiエンドポイント一覧)
12. [設定値一覧](#12-設定値一覧)

---

## 1. システム概要

EC・Shopify支援の代理店候補企業を**自動収集・評価・管理**するための社内ツール。複数の収集手法（Google API、ディレクトリスクレイピング、Googleマップ等）で企業情報を取得し、スコアリング・ステータス管理を通じて営業活動を支援する。

### 主な用途

- Shopify・ECコンサル・EC制作会社などのパートナー候補の発掘
- 収集した企業の評価・絞り込み・営業管理
- 複数プロジェクト（業種・地域等）を横断した候補企業プールの管理

---

## 2. 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | React 18 + TypeScript + Tailwind CSS + Vite |
| グラフ | Recharts（棒・円・折れ線グラフ） |
| バックエンド | FastAPI (Python) + Uvicorn、ポート5000 |
| データベース | PostgreSQL（Replit内蔵） |
| ORM | SQLAlchemy |
| スクレイピング | BeautifulSoup4 + Requests（最大5並列） |
| リアルタイム通信 | Server-Sent Events (SSE) |
| スケジューラ | APScheduler（自動収集） |
| 外部API | Google Custom Search API, Google Places API |
| 通知 | Slack Incoming Webhook |

---

## 3. 画面・機能一覧

### ダッシュボード (`/`)

- 総収集件数・重複除外後件数・未確認数・高スコア数・問い合わせあり件数の統計カード
- API使用量（残り回数）表示（無料枠100回/日）
- カテゴリ別円グラフ、スコアランク分布棒グラフ、ステータス別棒グラフ、都道府県別棒グラフ
- **直近30日の収集件数推移折れ線グラフ**（最新収集トレンドを可視化）
- 最近追加された企業リスト（直近10件）
- 全データは選択中プロジェクトにスコープ

### 候補企業一覧 (`/companies`)

- カテゴリ・ステータス・スコアランク・問い合わせ有無・キーワード・タグでの絞り込み
- ページネーション（50件/ページ）
- チェックボックスによる複数選択
  - **一括ステータス変更**（選択企業のステータスをまとめて変更）
  - **プロジェクト間移動**（別プロジェクトに企業を移動、重複ドメインは自動スキップ）
- 企業詳細編集モーダル（全フィールド編集、タグ、活動ログ、メールテンプレート）
- **重複検出・マージ**（ドメイン正規化による重複グループ化、マージ機能）
- 再スクレイピング（既存企業の情報を最新に更新）
- CSVエクスポート（フィルタ状態を反映）

### 検索条件管理 (`/keywords`)

- 検索キーワードのCRUD
- キーワード・カテゴリ・地域・除外キーワードを設定
- アクティブ/非アクティブの切り替え
- 各キーワードはプロジェクトに紐付け

### URL収集 (`/scraper`)

収集方法を5つのタブで切り替え：

| タブ | 手法 | APIキー |
|------|------|---------|
| Google API検索 | Google Custom Search API | 必要 |
| ディレクトリ収集 | 企業一覧ページのリンクを抽出 | 不要 |
| Google直接検索 | Google検索結果をスクレイピング | 不要 |
| Shopifyパートナー | Shopifyパートナーディレクトリ | 不要 |
| Googleマップ | Google Places API | 必要（Places API） |

- **Google API検索のみSSEリアルタイム進捗表示**（プログレスバー・状態メッセージ）
- 単一URL取得・複数URL一括取得（スクレイピング）も別セクションで提供

### 収集履歴 (`/history`)

- 各収集実行のログ一覧（キーワード、成功/重複/除外/エラー件数、日時）
- 選択プロジェクトにスコープ

### 拒否リスト (`/rejected`)

- まとめサイト・競合サイト等の除外ドメイン管理
- 収集時に自動判定されたドメインも自動登録
- 手動追加も可能

### メモテンプレート (`/templates`)

- メモ用テンプレートとメールテンプレートをタブで管理
- メールテンプレートは `{{company_name}}` 等の変数展開とmailto:リンク生成に対応

### マスターDB (`/master`)

- 全プロジェクト横断の企業プール（`company_master`テーブル）
- キーワード・カテゴリ・都道府県・最低スコアでの検索
- 検索結果に「現在のプロジェクトに登録済み」フラグ表示
- チェックボックスで複数選択 → 現在のプロジェクトにインポート
- 総登録件数・収集元別件数の統計カード

### プロジェクト管理 (`/projects`)

- プロジェクトのCRUD
- プロジェクトごとに以下をカスタマイズ可能：
  - カテゴリ一覧と各カテゴリの判定キーワード
  - フラグ定義（Shopify判定のキーワード等）
  - スコアリングルール（各フラグの点数）

### 設定 (`/settings`)

- Google Custom Search API Key
- Google Custom Search Engine ID (cx)
- Google Places API Key
- **Slack Webhook URL**（収集完了時の通知）＋テスト送信ボタン
- 自動収集スケジュール（有効/無効、実行時刻）

---

## 4. データ収集の仕組み

### 収集フロー

```
キーワード/URL入力
    ↓
検索 or スクレイピング（URL一覧を取得）
    ↓
各URLに対して並列スクレイピング（最大5並列）
    ↓ ※拒否リストに一致するドメインはスキップ
    ↓ ※まとめサイト判定に引っかかった場合は拒否リストに追加してスキップ
    ↓ ※既存ドメイン（プロジェクト内）はスキップ
カテゴリ分類・フラグ検出・スコアリング
    ↓
companiesテーブルに保存（project_idに紐付け）
    ↓
company_masterテーブルにUPSERT（全プロジェクト横断）
    ↓
CollectionLogに実行記録を保存
    ↓
Slack通知（成功件数 >= 1 かつWebhook URL設定済みの場合）
```

### スクレイピングで取得する情報

- 会社名（`<title>`、OGPタグ等から抽出）
- WebサイトURL、ドメイン
- 問い合わせページURL（`/contact`, `/inquiry` 等のパスを探索）
- 電話番号（正規表現でサイト全体から検索）
- メールアドレス（正規表現）
- 都道府県・市区町村
- 全文テキスト（カテゴリ・フラグ判定に使用）

### 収集元（source）の種類

| source値 | 説明 |
|---------|------|
| `auto` | Google Custom Search API・各種スクレイピング |
| `google_api` | Google Custom Search API |
| `directory` | ディレクトリサイト収集 |
| `shopify` | Shopifyパートナーディレクトリ |
| `maps` | Google Places API |
| `manual` | 手動入力 |

---

## 5. スコアリング・ランク算出ロジック

スコアは0〜100点の範囲で計算される。

### デフォルトスコアリングルール

| 条件 | 点数 |
|------|------|
| Shopifyフラグあり | +20 |
| 制作フラグあり | +15 |
| コンサルフラグあり | +15 |
| 運営代行フラグあり | +15 |
| 問い合わせURLあり | +10 |
| Amazon + 楽天の両フラグあり（マルチプラットフォーム） | +10 |
| 電話番号あり | +5 |
| 所在地（都道府県/市区町村）あり | +5 |
| 情報が2項目未満（会社名・電話・メール・所在地） | -10 |
| 問い合わせURLなし | -15 |
| EC関連フラグが一つもなし | -20 |

### スコアランク

| ランク | スコア範囲 | 意味 |
|--------|-----------|------|
| A | 80〜100点 | 優先アプローチ対象 |
| B | 60〜79点 | 積極検討 |
| C | 40〜59点 | 要確認 |
| D | 0〜39点 | 優先度低 |

### 手動スコア調整

各企業の詳細編集モーダルから −30〜+30 点の手動調整が可能。調整値は再スクレイピング後も保持される。

### プロジェクト別カスタマイズ

プロジェクト設定画面でスコアリングルール（各フラグの点数）をプロジェクトごとに上書きできる。

---

## 6. カテゴリ分類ロジック

スクレイピングしたサイトの全文テキストを解析し、以下の9カテゴリに分類する。

| カテゴリ | 代表判定キーワード |
|---------|-----------------|
| EC制作 | ECサイト制作、ネットショップ構築、カート構築 |
| Shopify支援 | Shopify、ショッピファイ |
| ECコンサル | ECコンサルティング、EC戦略、EC改善 |
| EC運営代行 | EC運営代行、ネットショップ運営、モール運用 |
| Amazon支援 | Amazon、アマゾン、FBA |
| 楽天支援 | 楽天、楽天市場、楽天出店 |
| EC広告代理店 | EC広告、リスティング広告、フィード広告 |
| Web制作 | Web制作、ホームページ制作、Webデザイン |
| その他 | 上記に該当しない場合 |

フラグ（Shopify/EC/Amazon/楽天/コンサル/運営代行/制作）も同様にキーワードマッチで検出。

---

## 7. マスターデータベースの仕組み

### 目的

複数プロジェクトにまたがる「企業プール」として機能する。一度収集した企業を捨てずに横断検索・再利用できる。

### データの流れ

```
収集処理
    ↓
companiesテーブルに保存（project_id あり）
    ↓（同時に）
company_masterテーブルにUPSERT（domain = 主キー、project_id なし）
    ※同一ドメインが存在する場合は情報を上書き更新
    ※新規ドメインの場合は新規挿入
```

### 検索・インポートの流れ

```
マスターDBページでキーワード検索
    ↓
already_in_projectフラグで「現プロジェクトに登録済み」を可視化
    ↓
未登録企業をチェックボックスで選択
    ↓
「インポート」ボタン押下
    ↓
domain一致でcompaniesテーブルにコピー作成（project_id = 現在のプロジェクト）
    ↓ ※対象プロジェクトに同ドメインが既にある場合はスキップ
完了：成功/重複スキップ/エラー件数を表示
```

---

## 8. SSEリアルタイム進捗の仕組み

Google API収集（単一キーワード/全キーワード一括）ではSSE（Server-Sent Events）でリアルタイムの進捗を画面に表示する。

### 処理フロー

```
フロントエンド: POST /api/collect/async → job_id を受け取る
フロントエンド: EventSource /api/collect/progress/{job_id} を購読開始
バックエンド: 別スレッドで収集処理を実行
    ↓ 処理中
バックエンド: job_storeに進捗を書き込み（current, total, message）
    ↓ SSEストリームが定期的にpoll（500ms間隔）
フロントエンド: プログレスバー・メッセージをリアルタイム更新
    ↓ 完了
バックエンド: type="done" イベントを送信、job_storeをクリーンアップ
フロントエンド: 結果を表示
```

### イベント形式

```json
// 進捗中
{ "type": "progress", "current": 2, "total": 5, "message": "(2/5) 「Shopify 制作会社」を処理中..." }

// 完了
{ "type": "done", "result": { "keywords_processed": 5, "total_success": 12, ... }, "message": "収集完了" }

// エラー
{ "type": "error", "message": "エラーメッセージ" }
```

---

## 9. Slack通知の仕組み

### 通知タイミング

収集処理（`collect_by_keyword` / `process_urls_to_companies`）完了後、**成功件数 >= 1** の場合にのみ送信。

### 通知メッセージ形式

```
✅ 収集完了: [プロジェクト名] / [キーワードまたはソース名]
新規 {n}件  除外 {m}件  重複 {k}件
```

### 設定方法

1. 設定画面で Slack Incoming Webhook URL を入力・保存
2. 「テスト送信」ボタンで疎通確認
3. 以降、収集完了時に自動送信

---

## 10. データベース設計

### テーブル一覧

| テーブル名 | 用途 | 主なカラム |
|-----------|------|-----------|
| `projects` | プロジェクト定義 | name, categories(JSON), category_keywords(JSON), flag_definitions(JSON), scoring_rules(JSON) |
| `companies` | 企業レコード（プロジェクト別） | project_id, domain, company_name, website_url, contact_url, prefecture, flags×7, score_total, score_rank, status |
| `company_master` | 全プロジェクト横断企業プール | domain(UNIQUE), company_name, website_url, source, search_text, last_scraped_at |
| `search_keywords` | 検索キーワード | project_id, keyword, category, region, exclude_keywords, is_active |
| `app_settings` | 設定値（APIキー等） | setting_key, setting_value |
| `rejected_urls` | 拒否ドメイン | project_id, domain, reason |
| `api_usage_logs` | API使用量（日次） | usage_date, request_count |
| `collection_logs` | 収集実行ログ | project_id, keyword_text, success_count, duplicate_count, rejected_count |
| `status_history` | ステータス変更履歴 | company_id, old_status, new_status, changed_at |
| `memo_templates` | メモ・メールテンプレート | title, content, is_email_template |
| `company_tags` | 企業タグ | company_id, tag_name（複合UNIQUE） |
| `activity_logs` | 営業アクティビティ記録 | company_id, action_type, description |

### 主要インデックス

- `companies`: `(project_id, status)`, `(project_id, score_rank)`, `(project_id, category_main)`, `(website_url, project_id)` UNIQUE
- `company_master`: `domain` UNIQUE, `category_main`, `score_rank`, `prefecture`

---

## 11. APIエンドポイント一覧

### ダッシュボード
| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/dashboard` | 統計データ（daily_collection_trendを含む） |

### 企業
| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/companies` | 一覧取得（フィルタ・ページネーション） |
| POST | `/api/companies` | 新規作成 |
| PUT | `/api/companies/{id}` | 更新 |
| DELETE | `/api/companies/{id}` | 削除 |
| GET | `/api/companies/{id}/history` | ステータス変更履歴 |
| PUT | `/api/companies/bulk-status` | 一括ステータス変更 |
| POST | `/api/companies/move-project` | プロジェクト間移動 |
| GET | `/api/companies/duplicates` | 重複グループ取得 |
| POST | `/api/companies/merge` | 重複マージ |
| GET | `/api/companies/csv` | CSVエクスポート |
| GET | `/api/companies/tags/all` | 全タグ取得 |
| GET | `/api/companies/{id}/tags` | 企業タグ取得 |
| POST | `/api/companies/{id}/tags` | タグ追加 |
| DELETE | `/api/companies/{id}/tags/{name}` | タグ削除 |
| GET | `/api/companies/{id}/activities` | 活動ログ取得 |
| POST | `/api/companies/{id}/activities` | 活動ログ追加 |
| POST | `/api/companies/{id}/rescrape` | 再スクレイピング |

### 収集
| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/collect` | キーワード収集（同期） |
| POST | `/api/collect/all` | 全キーワード収集（同期） |
| POST | `/api/collect/async` | キーワード収集（非同期、job_id返却） |
| GET | `/api/collect/progress/{job_id}` | SSE進捗ストリーム |
| GET | `/api/collect/history` | 収集ログ一覧 |
| POST | `/api/collect/directory` | ディレクトリ収集 |
| POST | `/api/collect/google-scrape` | Google直接検索収集 |
| POST | `/api/collect/shopify-partners` | Shopifyパートナー収集 |
| POST | `/api/collect/google-maps` | Googleマップ収集 |

### マスターDB
| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/master/stats` | 統計（総件数・カテゴリ別・収集元別） |
| GET | `/api/master/search` | 企業検索（q/category/prefecture/min_score） |
| POST | `/api/master/import` | プロジェクトにインポート |

### 設定
| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/settings` | 設定取得（マスク済み） |
| PUT | `/api/settings` | 設定更新 |
| POST | `/api/settings/test` | Google API接続テスト |
| POST | `/api/settings/slack-test` | Slackテスト通知 |
| GET | `/api/settings/scheduler` | スケジューラ状態取得 |

---

## 12. 設定値一覧

| キー | 説明 | マスク |
|------|------|--------|
| `google_api_key` | Google Custom Search API Key | あり（APIキー扱い） |
| `google_cx` | Google Search Engine ID | なし |
| `google_places_api_key` | Google Places API Key | あり |
| `slack_webhook_url` | Slack Incoming Webhook URL | あり（webhook扱い） |
| `auto_collect_enabled` | 自動収集の有効/無効 | なし |
| `auto_collect_time` | 自動収集の実行時刻（HH:MM） | なし |
