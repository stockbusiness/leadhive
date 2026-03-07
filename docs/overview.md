# LeadHive — 機能概要・仕様書

## 目次

1. [システム概要](#1-システム概要)
2. [技術スタック](#2-技術スタック)
3. [画面・機能一覧](#3-画面機能一覧)
4. [認証・マルチテナンシー](#4-認証マルチテナンシー)
5. [データ収集の仕組み](#5-データ収集の仕組み)
6. [スコアリング・ランク算出ロジック](#6-スコアリングランク算出ロジック)
7. [カテゴリ分類ロジック](#7-カテゴリ分類ロジック)
8. [AI機能（企業分析・メール生成）](#8-ai機能企業分析メール生成)
9. [キーワード分析](#9-キーワード分析)
10. [プラン管理・使用量制限](#10-プラン管理使用量制限)
11. [マスターデータベースの仕組み](#11-マスターデータベースの仕組み)
12. [SSEリアルタイム進捗の仕組み](#12-sseリアルタイム進捗の仕組み)
13. [通知の仕組み（Slack・メール・フォローアップ）](#13-通知の仕組みslackメールフォローアップ)
14. [データベース設計](#14-データベース設計)
15. [APIエンドポイント一覧](#15-apiエンドポイント一覧)
16. [設定値一覧](#16-設定値一覧)

---

## 1. システム概要

EC・Shopify支援の代理店候補企業を**自動収集・評価・管理**するBtoB営業支援SaaSプラットフォーム。複数の収集手法（Google API、ディレクトリスクレイピング、Googleマップ等）で企業情報を取得し、スコアリング・ステータス管理・AI分析を通じて営業活動を支援する。

### 主な特徴

- 複数プロジェクト・複数組織によるマルチテナント構成
- Google API / スクレイピング / Googleマップなど複数の収集手法
- 0〜100点のスコアリングとA〜Dランク自動付与
- OpenAI GPT-4o-miniによるAI企業分析・アウトリーチメール生成
- キーワード別の収集効率分析
- サブスクリプションプラン管理（フリー/スターター/プロ/エンタープライズ）
- チームメンバー招待・ロール管理（admin/member）
- Slack通知・メール通知・フォローアップアラート
- モバイル対応（レスポンシブUI）

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
| スケジューラ | APScheduler（自動収集・フォローアップ通知） |
| 認証 | JWT + sha256_crypt、BearerトークンによるAuthorizationヘッダー |
| キャッシュ | インメモリTTLキャッシュ（ダッシュボード・キーワード・テンプレート等） |
| AI | OpenAI GPT-4o-mini（企業分析・メール生成） |
| 外部API | Google Custom Search API, Google Places API |
| 通知 | Slack Incoming Webhook, SMTP（メール） |

---

## 3. 画面・機能一覧

### ダッシュボード (`/`)

- 総収集件数・重複除外後件数・未確認数・高スコア数・問い合わせあり件数の統計カード
- API使用量（残り回数）表示（無料枠100回/日）
- カテゴリ別円グラフ、スコアランク分布棒グラフ、ステータス別棒グラフ、都道府県別棒グラフ
- 直近30日の収集件数推移折れ線グラフ
- 最近追加された企業リスト（直近10件）
- 現在のプランバッジ（右上エリア）
- 全データは選択中プロジェクトにスコープ

### 候補企業一覧 (`/companies`)

- カテゴリ・ステータス・スコアランク・問い合わせ有無・キーワード・タグでの絞り込み
- ページネーション（50件/ページ）
- テーブルビュー / カードビュー切り替え（モバイル最適化）
- チェックボックスによる複数選択
  - 一括ステータス変更
  - プロジェクト間移動（重複ドメインは自動スキップ）
- 企業詳細ページへの遷移（URLベース）
- 重複検出・マージ
- 再スクレイピング
- CSVエクスポート（フィルタ状態を反映）
- CSVインポート（会社名・ドメイン・URLの一括登録）

### 企業詳細ページ (`/companies/:id`)

- 基本情報の閲覧・編集
- ステータス変更履歴タブ
- 活動ログタブ（電話/メール/フォーム/面談/その他）
- メモ・タグ管理
- AIサマリータブ
  - AI企業分析（事業内容・顧客層・強み・サービス・価格帯）
  - アウトリーチメール生成（フォーマル/カジュアル、追加指示対応）
- フォローアップ日時設定

### 検索条件管理 (`/keywords`)

- 検索キーワードのCRUD
- 「管理」タブ：キーワード・カテゴリ・地域・除外キーワード・アクティブ/非アクティブ管理
- 「分析」タブ：キーワード別収集効率の可視化
  - 棒グラフ（獲得企業数比較）
  - サマリーカード（合計獲得数・平均成功率）
  - 詳細テーブル（成功率・重複率・拒否率・効率バッジ）

### URL収集 (`/scraper`)

収集方法を5つのタブで切り替え：

| タブ | 手法 | APIキー |
|------|------|---------|
| Google API検索 | Google Custom Search API | 必要 |
| ディレクトリ収集 | 企業一覧ページのリンクを抽出 | 不要 |
| Google直接検索 | Google検索結果をスクレイピング | 不要 |
| Shopifyパートナー | Shopifyパートナーディレクトリ | 不要 |
| Googleマップ | Google Places API | 必要（Places API） |

- Google API検索のみSSEリアルタイム進捗表示
- 単一URL取得・複数URL一括取得も提供

### 収集履歴 (`/history`)

- 収集実行ログ一覧（キーワード・成功/重複/除外/エラー件数・日時）
- 選択プロジェクトにスコープ

### 拒否リスト (`/rejected`)

- 除外ドメイン管理（まとめサイト・競合等）
- 収集時に自動判定・自動登録
- 手動追加も可能

### メモテンプレート (`/templates`)

- メモ用テンプレートとメールテンプレートをタブで管理
- メールテンプレートは `{{company_name}}` 等の変数展開とmailto:リンク生成に対応

### マスターDB (`/master`)

- 全プロジェクト横断の企業プール（`company_master`テーブル）
- キーワード・カテゴリ・都道府県・最低スコアでの検索
- 「現在のプロジェクトに登録済み」フラグ表示
- 複数選択 → 現在のプロジェクトにインポート

### プロジェクト管理 (`/projects`)

- プロジェクトのCRUD
- カテゴリ定義・フラグ定義・スコアリングルールをプロジェクトごとにカスタマイズ

### ユーザー管理 (`/users`) ※管理者のみ

- 組織メンバーの一覧・招待・ロール変更（admin/member）・削除
- メール招待（トークン付きURLを送信）

### プラン管理 (`/admin/plans`) ※管理者のみ

- プランの一覧・作成・編集・削除
- 組織へのプラン割り当て・解除
- 現在の組織のプランと使用量確認

### 設定 (`/settings`)

- Google Custom Search API Key / Search Engine ID (cx)
- Google Places API Key
- OpenAI API Key（AI分析・メール生成用）
- SMTPメール設定（ホスト・ポート・ユーザー・パスワード・送信元）
- Slack Webhook URL
- 自動収集スケジュール（有効/無効・実行時刻）
- フォローアップ通知設定（有効/無効・Slack/メール切替）
- プラン・使用量セクション（プログレスバー付き）

---

## 4. 認証・マルチテナンシー

### 認証フロー

```
POST /api/auth/register → ユーザー作成 + 組織作成 → JWT発行
POST /api/auth/login    → JWT発行
リクエストヘッダー: Authorization: Bearer {token}
```

### 組織モデル

- ユーザー登録時に組織（`organizations`）が自動作成される
- 各組織は独立したプロジェクト・企業・設定・テンプレートを持つ
- 1ユーザーは1組織に所属（`organization_id` で全データをスコープ）

### ロール

| ロール | 権限 |
|--------|------|
| `admin` | 全機能 + ユーザー管理 + プラン管理 |
| `member` | 収集・企業管理・閲覧（プラン管理・ユーザー管理は不可） |

### メンバー招待

```
管理者: POST /api/users/invite → メールでトークン付きURLを送信
招待者: GET /accept-invite/:token → パスワード設定 → 組織に参加
```

### パスワードリセット

```
POST /api/auth/forgot-password → リセット用メールを送信
POST /api/auth/reset-password  → トークン検証 → 新パスワード設定
```

---

## 5. データ収集の仕組み

### 収集フロー

```
キーワード/URL入力
    ↓
プラン上限チェック（organizations.planの企業数上限）
    ↓ ※上限超過 → HTTP 402
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

## 6. スコアリング・ランク算出ロジック

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

各企業の詳細編集から −30〜+30 点の手動調整が可能。調整値は再スクレイピング後も保持される。

### プロジェクト別カスタマイズ

プロジェクト設定でスコアリングルール（各フラグの点数）をプロジェクトごとに上書き可能。

---

## 7. カテゴリ分類ロジック

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

## 8. AI機能（企業分析・メール生成）

### 前提条件

- 設定画面にOpenAI APIキーが登録済みであること
- プランのAI分析回数上限に達していないこと（超過するとHTTP 402）

### AI企業分析

**エンドポイント**: `POST /api/companies/{id}/analyze`

**処理フロー**:
```
企業URLのWebサイトをスクレイピング（全文テキスト取得）
    ↓
OpenAI GPT-4o-mini に以下のJSON構造で回答を要求：
    - 事業内容
    - 顧客層
    - 強み
    - サービス
    - 価格帯
    ↓
結果をcompanies.ai_summary (JSON) に保存
    ↓
organizations.ai_analysis_count をインクリメント（月次カウンタ）
```

**ai_summary JSONスキーマ**:
```json
{
  "事業内容": "...",
  "顧客層": "...",
  "強み": "...",
  "サービス": "...",
  "価格帯": "...",
  "generated_at": "2025-01-01T00:00:00"
}
```

### AIアウトリーチメール生成

**エンドポイント**: `POST /api/companies/{id}/generate-email`

**リクエストボディ**:
```json
{
  "tone": "formal" | "casual",
  "custom_note": "追加指示テキスト（任意）"
}
```

**処理フロー**:
```
ai_summaryデータを取得（事前にAI分析済みが必要）
    ↓
OpenAI GPT-4o-mini でメール件名・本文を生成
    ↓
レスポンス: { "subject": "...", "body": "..." }
```

**トーン**:
| トーン | 説明 |
|--------|------|
| `formal` | ビジネスライクで丁寧な文体 |
| `casual` | 親しみやすいカジュアルな文体 |

---

## 9. キーワード分析

**エンドポイント**: `GET /api/keywords/analytics?project_id={id}`

**集計ロジック**:
```
collection_logsテーブルから各キーワードの履歴を集計：
    - total_collected: 獲得企業数の合計
    - total_attempts: 収集試行回数
    - success_rate: 成功件数 / 試行回数 × 100
    - duplicate_rate: 重複件数 / 試行回数 × 100
    - rejected_rate: 除外件数 / 試行回数 × 100
```

**効率バッジ算出ロジック**:
| 判定 | 条件 |
|------|------|
| 高効率 | 成功率 >= 50% かつ総獲得数 >= 10 |
| 中効率 | 成功率 >= 20% または 総獲得数 >= 5 |
| 低効率 | 上記以外 |

---

## 10. プラン管理・使用量制限

### プラン構成（自動シード）

サーバー起動時に `plans` テーブルが空の場合、以下の4プランが自動投入される：

| プラン | 月額 | メンバー | プロジェクト | 企業数 | AI分析/月 |
|--------|------|---------|------------|--------|----------|
| フリー | ¥0 | 1名 | 1件 | 200件 | 3回 |
| スターター | ¥4,980 | 3名 | 3件 | 1,000件 | 20回 |
| プロ | ¥14,800 | 10名 | 10件 | 5,000件 | 100回 |
| エンタープライズ | 要相談 | 無制限 | 無制限 | 無制限 | 無制限 |

### 使用量チェック

**関数**: `check_plan_limit(org_id, resource, db)`

| resource値 | チェック対象 |
|-----------|-------------|
| `members` | `users`テーブルの組織メンバー数 |
| `projects` | `projects`テーブルのプロジェクト数 |
| `companies` | 全プロジェクト合計の企業数 |
| `ai_analyses` | `organizations.ai_analysis_count`（月次） |

上限超過時: HTTP 402 レスポンス

### フロントエンドの上限超過UI

axiosのresponseインターセプター（`frontend/src/api/index.ts`）が HTTP 402 を検知すると：

```
window.dispatchEvent(
  new CustomEvent("plan-limit-exceeded", { detail: { message: ... } })
)
```

App.tsx の `AppContent` コンポーネントがそのイベントをリッスンし、`PlanLimitModal` を表示する。

**PlanLimitModalの内容**:
- エラーメッセージ（何の上限か）
- フリー〜エンタープライズのプラン比較表
- 管理者：「プラン管理へ」ボタン → `/admin/plans` へ遷移
- メンバー：「管理者にご相談ください」案内

---

## 11. マスターデータベースの仕組み

### 目的

複数プロジェクトにまたがる「企業プール」として機能する。一度収集した企業を捨てずに横断検索・再利用できる。

### データの流れ

```
収集処理
    ↓
companiesテーブルに保存（project_id あり）
    ↓（同時に）
company_masterテーブルにUPSERT（domain = 主キー）
    ※同一ドメインが存在する場合は情報を上書き更新
    ※新規ドメインの場合は新規挿入
```

### インポートの流れ

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

## 12. SSEリアルタイム進捗の仕組み

Google API収集（単一キーワード/全キーワード一括）ではSSEでリアルタイム進捗を表示する。

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
{ "type": "progress", "current": 2, "total": 5, "message": "(2/5) 処理中..." }
{ "type": "done", "result": { "keywords_processed": 5, "total_success": 12 }, "message": "収集完了" }
{ "type": "error", "message": "エラーメッセージ" }
```

---

## 13. 通知の仕組み（Slack・メール・フォローアップ）

### Slack通知

収集処理（`collect_by_keyword` / `process_urls_to_companies`）完了後、**成功件数 >= 1** の場合にのみ送信。

```
✅ 収集完了: [プロジェクト名] / [キーワードまたはソース名]
新規 {n}件  除外 {m}件  重複 {k}件
```

### メール通知（SMTP）

以下のタイミングでメール送信：

| タイミング | 内容 |
|-----------|------|
| メンバー招待 | 招待URLを含むメール |
| パスワードリセット | リセットURLを含むメール |
| フォローアップアラート | 期限超過・当日の企業一覧 |

### フォローアップ通知

**スケジュール**: 毎朝9時（APScheduler）

```
APScheduler 毎朝9時起動
    ↓
フォローアップ日が「今日以前」の企業を検索
    ↓
通知チャンネルに応じて送信：
    - Slack: Webhook URLにメッセージ送信
    - メール: 管理者アドレスにメール送信
```

---

## 14. データベース設計

### テーブル一覧

| テーブル名 | 用途 | 主なカラム |
|-----------|------|-----------|
| `organizations` | テナント（組織）定義 | name, plan_id, ai_analysis_count |
| `users` | ユーザー | organization_id, email, display_name, role, password_hash, invite_token |
| `plans` | サブスクリプションプラン | name, description, price_monthly, max_members, max_projects, max_companies, max_ai_analyses_monthly, api_daily_limit, is_active |
| `projects` | プロジェクト定義 | organization_id, name, categories(JSON), category_keywords(JSON), flag_definitions(JSON), scoring_rules(JSON) |
| `companies` | 企業レコード（プロジェクト別） | project_id, domain, company_name, website_url, contact_url, prefecture, flags×7, score_total, score_rank, status, ai_summary(JSON), follow_up_date |
| `company_master` | 全プロジェクト横断企業プール | domain(UNIQUE), company_name, website_url, source, search_text, last_scraped_at |
| `search_keywords` | 検索キーワード | project_id, keyword, category, region, exclude_keywords, is_active |
| `app_settings` | 設定値（APIキー等） | organization_id, setting_key, setting_value |
| `rejected_urls` | 拒否ドメイン | organization_id, domain, reason |
| `api_usage_logs` | API使用量（日次） | organization_id, usage_date, request_count |
| `collection_logs` | 収集実行ログ | project_id, keyword_text, success_count, duplicate_count, rejected_count, error_count |
| `status_history` | ステータス変更履歴 | company_id, old_status, new_status, changed_at |
| `memo_templates` | メモ・メールテンプレート | organization_id, title, content, is_email_template |
| `company_tags` | 企業タグ | company_id, tag_name（複合UNIQUE） |
| `activity_logs` | 営業アクティビティ記録 | company_id, action_type, description, logged_at |

### 主要インデックス

- `companies`: `(project_id, status)`, `(project_id, score_rank)`, `(project_id, category_main)`, `(website_url, project_id)` UNIQUE
- `company_master`: `domain` UNIQUE, `category_main`, `score_rank`, `prefecture`
- `plans`: `is_active`
- `organizations`: `plan_id` (FK)

---

## 15. APIエンドポイント一覧

### 認証

| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/auth/register` | 新規登録（組織も同時作成） |
| POST | `/api/auth/login` | ログイン・JWT発行 |
| GET | `/api/auth/me` | 現在のユーザー情報取得 |
| PUT | `/api/auth/me` | プロフィール・パスワード更新 |
| POST | `/api/auth/forgot-password` | パスワードリセットメール送信 |
| POST | `/api/auth/reset-password` | トークン検証・パスワード変更 |

### ユーザー管理

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/users` | 組織メンバー一覧 |
| POST | `/api/users/invite` | メンバー招待（メール送信） |
| PUT | `/api/users/{id}/role` | ロール変更 |
| DELETE | `/api/users/{id}` | メンバー削除 |
| POST | `/api/users/accept-invite` | 招待受諾・パスワード設定 |

### プラン管理

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/plans` | プラン一覧 |
| POST | `/api/plans` | プラン作成 |
| PUT | `/api/plans/{id}` | プラン更新 |
| DELETE | `/api/plans/{id}` | プラン削除 |
| POST | `/api/plans/{id}/assign` | 組織にプランを割り当て |
| DELETE | `/api/plans/{id}/unassign` | 割り当て解除 |
| GET | `/api/plans/current` | 現在の組織のプラン取得 |
| GET | `/api/plans/organizations` | 全組織のプラン割り当て一覧 |

### ダッシュボード

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/dashboard` | 統計データ（daily_collection_trendを含む） |

### 企業

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/companies` | 一覧取得（フィルタ・ページネーション） |
| POST | `/api/companies` | 新規作成 |
| GET | `/api/companies/{id}` | 企業詳細取得 |
| PUT | `/api/companies/{id}` | 更新 |
| DELETE | `/api/companies/{id}` | 削除 |
| GET | `/api/companies/{id}/history` | ステータス変更履歴 |
| PUT | `/api/companies/bulk-status` | 一括ステータス変更 |
| POST | `/api/companies/move-project` | プロジェクト間移動 |
| GET | `/api/companies/duplicates` | 重複グループ取得 |
| POST | `/api/companies/merge` | 重複マージ |
| GET | `/api/companies/csv` | CSVエクスポート |
| POST | `/api/companies/import-csv` | CSVインポート |
| GET | `/api/companies/tags/all` | 全タグ取得 |
| GET | `/api/companies/{id}/tags` | 企業タグ取得 |
| POST | `/api/companies/{id}/tags` | タグ追加 |
| DELETE | `/api/companies/{id}/tags/{name}` | タグ削除 |
| GET | `/api/companies/{id}/activities` | 活動ログ取得 |
| POST | `/api/companies/{id}/activities` | 活動ログ追加 |
| POST | `/api/companies/{id}/rescrape` | 再スクレイピング |
| POST | `/api/companies/{id}/analyze` | AI企業分析実行 |
| POST | `/api/companies/{id}/generate-email` | アウトリーチメール生成 |

### キーワード

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/keywords` | キーワード一覧 |
| POST | `/api/keywords` | キーワード追加 |
| PUT | `/api/keywords/{id}` | キーワード更新 |
| DELETE | `/api/keywords/{id}` | キーワード削除 |
| GET | `/api/keywords/analytics` | キーワード別収集効率分析 |

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
| GET | `/api/master/search` | 企業検索 |
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

## 16. 設定値一覧

| キー | 説明 | マスク |
|------|------|--------|
| `google_api_key` | Google Custom Search API Key | あり |
| `google_cx` | Google Search Engine ID | なし |
| `google_places_api_key` | Google Places API Key | あり |
| `openai_api_key` | OpenAI API Key（AI分析・メール生成） | あり |
| `slack_webhook_url` | Slack Incoming Webhook URL | あり |
| `smtp_host` | SMTPサーバーホスト | なし |
| `smtp_port` | SMTPポート番号 | なし |
| `smtp_user` | SMTPユーザー名 | なし |
| `smtp_password` | SMTPパスワード | あり |
| `smtp_from` | 送信元メールアドレス | なし |
| `auto_collect_enabled` | 自動収集の有効/無効 | なし |
| `auto_collect_time` | 自動収集の実行時刻（HH:MM） | なし |
| `followup_notification_enabled` | フォローアップ通知の有効/無効 | なし |
| `followup_notification_channel` | 通知チャンネル（`slack` / `email`） | なし |
