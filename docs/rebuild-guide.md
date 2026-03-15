# LeadHive — ゼロからの再構築ガイド

> このドキュメントは、コードやデータが完全に失われた場合でも LeadHive を再構築できるよう、  
> 設計思想・技術スタック・ビジネスロジック・外部サービス設定を網羅的に記録したものです。  
> 作成日: 2026年3月 / 運営: COOLWORKS株式会社（代表: 田中 智一郎）

---

## 目次

1. [サービス概要](#1-サービス概要)
2. [技術スタック](#2-技術スタック)
3. [ディレクトリ構成](#3-ディレクトリ構成)
4. [外部サービス一覧と設定](#4-外部サービス一覧と設定)
5. [環境変数一覧](#5-環境変数一覧)
6. [データベース設計](#6-データベース設計)
7. [コアビジネスロジック](#7-コアビジネスロジック)
8. [認証・認可の設計](#8-認証認可の設計)
9. [プラン・課金設計](#9-プランと課金設計)
10. [スコアリングロジック](#10-スコアリングロジック)
11. [自動収集フロー](#11-自動収集フロー)
12. [ゼロからの再構築手順](#12-ゼロからの再構築手順)
13. [初期データの投入](#13-初期データの投入)
14. [管理者アカウント作成](#14-管理者アカウント作成)
15. [重要な設計判断と注意事項](#15-重要な設計判断と注意事項)

---

## 1. サービス概要

**LeadHive**（leadhive.work）は BtoB 営業向けの見込み客収集・リスト自動化 SaaS です。

### 主要機能

| 機能 | 説明 |
|---|---|
| 自動収集 | Google検索・Google Maps・gBizINFO から企業を自動収集 |
| スコアリング | 100点満点・A〜Dランクの自動スコアリング |
| マスターDB | 収集済み企業の全社共有データベース |
| パイプライン | カンバン形式の営業ステータス管理 |
| Sales AI | Claude AI によるメール文章自動生成 |
| チーム管理 | 組織・メンバー・権限管理 |
| トラッキング | メール開封トラッキングピクセル |
| Webhook | 外部サービスへのリアルタイム通知 |

### 対象ユーザー

- BtoB 企業の営業担当者
- 代理店・マーケティング会社
- SaaS セールスチーム

---

## 2. 技術スタック

### バックエンド

| 項目 | 技術 |
|---|---|
| 言語 | Python 3.11 |
| フレームワーク | FastAPI 0.135 |
| サーバー | Uvicorn（ポート 5000） |
| ORM | SQLAlchemy 2.0 |
| DB | PostgreSQL 16 |
| 認証 | JWT (python-jose) + bcrypt パスワードハッシュ |
| 暗号化 | Fernet（cryptography ライブラリ、SESSION_SECRET から鍵導出） |
| スケジューラー | Python threading（30秒ポーリング） |
| レート制限 | slowapi（ログイン・登録・パスワードリセットに適用） |
| エラー監視 | Sentry SDK |

### フロントエンド

| 項目 | 技術 |
|---|---|
| 言語 | TypeScript |
| フレームワーク | React 18 |
| ビルドツール | Vite |
| スタイリング | Tailwind CSS |
| グラフ | Recharts |
| アイコン | Lucide React |
| HTTP クライアント | axios |
| ルーティング | React Router v6 |
| 状態管理 | React Context (Auth, Project, Theme) |

### Python 主要依存関係

```
fastapi==0.135.1          # Webフレームワーク
uvicorn==0.41.0           # ASGIサーバー
sqlalchemy==2.0.48        # ORM
python-jose==3.5.0        # JWT
passlib==1.7.4            # パスワードハッシュ
cryptography==46.0.5      # Fernet暗号化
anthropic==0.84.0         # Claude AI
openai==2.26.0            # GPT-4o-mini
stripe==14.4.1            # Stripe決済
slowapi==0.1.9            # レート制限
sentry-sdk==2.54.0        # エラー監視
beautifulsoup4==4.14.3    # スクレイピング
trafilatura==2.0.0        # テキスト抽出
requests==2.32.5          # HTTP
pyotp==2.9.0              # 2FA TOTP
qrcode==8.2               # QRコード生成
openpyxl==3.1.5           # Excel出力
pandas==3.0.1             # CSV/データ処理
```

---

## 3. ディレクトリ構成

```
leadhive/
├── server/
│   ├── main.py              # FastAPI アプリ・ルーター登録・起動
│   ├── database.py          # SQLAlchemy エンジン・セッション設定
│   ├── models.py            # 全DBモデル定義（35テーブル）
│   ├── schemas.py           # Pydantic スキーマ・company_to_dict()
│   ├── auth.py              # JWT 発行・検証・依存関係
│   ├── routes/
│   │   ├── auth.py          # 登録・ログイン・パスワードリセット・2FA
│   │   ├── companies.py     # 企業 CRUD・スコアリング・Excel出力
│   │   ├── collector.py     # 収集 API（非同期ジョブ）
│   │   ├── master.py        # マスターDB API
│   │   ├── scraper.py       # 単体スクレイピング API
│   │   ├── keywords.py      # 検索キーワード管理
│   │   ├── projects.py      # プロジェクト管理
│   │   ├── dashboard.py     # ダッシュボード集計
│   │   ├── settings.py      # 組織設定（API Key・SMTP・Slack等）
│   │   ├── users.py         # ユーザー管理・招待
│   │   ├── plans.py         # プラン上限チェック・使用量集計
│   │   ├── payments.py      # Stripe 決済・Webhook
│   │   ├── sales_ai.py      # AI メール生成
│   │   ├── templates.py     # メールテンプレート管理
│   │   ├── tracking.py      # メール開封トラッキングピクセル
│   │   ├── webhooks.py      # Outbound Webhook 管理・発火
│   │   ├── notifications.py # フォローアップ通知
│   │   ├── segments.py      # セグメント管理
│   │   ├── admin_scoring.py # スコアリングルール管理（システム管理者）
│   │   ├── admin_auto_master.py # 自動マスターDB収集管理
│   │   ├── security.py      # セキュリティイベントログ
│   │   ├── support.py       # サポートチケット
│   │   ├── rejected.py      # 除外ドメイン管理
│   │   ├── contact.py       # お問い合わせフォーム
│   │   ├── faq.py           # FAQ管理
│   │   ├── status_page.py   # ステータスページ管理
│   │   └── public.py        # 公開API（認証不要）
│   └── services/
│       ├── scorer.py        # スコアリングロジック
│       ├── collector.py     # 収集コアサービス
│       ├── scraper.py       # スクレイピング処理
│       ├── scheduler.py     # 自動収集・通知スケジューラー
│       ├── gbiz_collector.py # gBizINFO API収集
│       ├── google_search.py # Google検索
│       ├── google_places.py # Google Maps API
│       ├── enrichment.py    # 企業情報補完
│       ├── categorizer.py   # 企業カテゴリ分類
│       ├── ai_writer.py     # Claude AI 文章生成
│       ├── ai_analyzer.py   # OpenAI GPT 分析
│       ├── mailer.py        # SMTP メール送信
│       ├── slack.py         # Slack Webhook送信
│       ├── slack_notifier.py # Slack通知トリガー管理
│       ├── encryption.py    # Fernet暗号化・復号
│       ├── cache.py         # インメモリキャッシュ
│       ├── rate_limiter.py  # slowapi 設定
│       └── aggregator.py    # ドメイン正規化
├── frontend/
│   ├── src/
│   │   ├── App.tsx          # ルーティング定義
│   │   ├── pages/           # 40+ページコンポーネント
│   │   ├── components/      # 共通UIコンポーネント
│   │   ├── api/             # API クライアント定義
│   │   ├── contexts/        # Auth・Project・Theme Context
│   │   ├── hooks/           # カスタムフック
│   │   └── types.ts         # TypeScript 型定義
│   ├── dist/                # Vite ビルド出力（本番用）
│   └── vite.config.ts       # Vite 設定
├── docs/                    # 本ドキュメント等
├── pyproject.toml           # Python 依存関係
└── package.json             # Node.js 依存関係
```

---

## 4. 外部サービス一覧と設定

### 必須サービス

| サービス | 用途 | 設定場所 |
|---|---|---|
| **PostgreSQL** | メインDB | `DATABASE_URL` 環境変数 |
| **SESSION_SECRET** | 暗号化・JWT署名 | 環境変数 |

### オプションサービス（管理画面から設定）

| サービス | 用途 | 管理画面の場所 |
|---|---|---|
| Google Custom Search API | 企業検索収集 | 設定 > Google API |
| Google Custom Search Engine ID (CX) | 同上 | 設定 > Google API |
| Google Places API | Google Maps収集 | 設定 > Google API |
| gBizINFO APIトークン | 法人番号DB収集 | 設定 > gBizINFO |
| Anthropic API Key | Claude AI メール生成 | 設定 > AI設定 |
| OpenAI API Key | GPT-4o-mini 企業分析 | 設定 > AI設定 |
| Stripe Secret Key | 決済処理 | 管理 > Stripe設定 |
| Stripe Publishable Key | 決済フォーム | 管理 > Stripe設定 |
| Stripe Webhook Secret | 決済イベント受信 | 管理 > Stripe設定 |
| SMTP設定 | 営業メール・通知送信 | 設定 > メール設定 |
| Slack Webhook URL | 収集完了・開封通知 | 設定 > Slack設定 |
| Sentry DSN | エラー監視 | `SENTRY_DSN` 環境変数 |

### Stripe Webhook エンドポイント

Stripe ダッシュボードで以下を設定：

```
URL: https://leadhive.work/api/payments/stripe-webhook
受信イベント:
  - customer.subscription.created
  - customer.subscription.updated
  - customer.subscription.deleted
  - invoice.payment_succeeded
  - invoice.payment_failed
  - checkout.session.completed
```

---

## 5. 環境変数一覧

`.env` ファイルまたはサーバーの環境変数として設定：

```bash
# 必須
DATABASE_URL=postgresql://user:password@host:5432/leadhive
SESSION_SECRET=<32文字以上のランダム英数字>

# 任意
SENTRY_DSN=https://xxx@sentry.io/xxx
APP_ENV=production
```

> **注意**: Google API・Stripe・Anthropic などの APIキーは全て DB の `app_settings` テーブルに Fernet 暗号化して保存されます。環境変数への設定は不要で、管理画面から入力します。

---

## 6. データベース設計

### 主要テーブル

#### organizations（組織）
```sql
id, name, plan_id, stripe_customer_id, stripe_subscription_id,
subscription_status, plan_started_at, plan_expires_at,
terms_accepted_at, is_active, created_at
```

#### users（ユーザー）
```sql
id, org_id, email, password_hash, name, role(member/admin),
is_active, is_system_admin, is_founder, email_verified,
totp_enabled, totp_secret, token_version,
last_login_at, failed_login_count, locked_until, created_at
```

#### projects（プロジェクト）
```sql
id, org_id, name, description, scoring_rules(JSON),
is_active, created_at
```

#### companies（企業 - プロジェクト紐付け）
```sql
id, project_id, assignee_id, company_name, website_url, domain,
contact_url, prefecture, city, phone, email,
category_main, category_sub,
shopify_flag, ec_flag, amazon_flag, rakuten_flag,
consulting_flag, operation_flag, production_flag,
ec_score, score_total, score_adjustment, score_rank,
status, contact_name, contact_title, notes, follow_up_date,
ai_summary(JSON), cms_type, cms_detected_at,
sns_links(JSON), sns_count, has_recruitment,
employee_count, escms_target_flag, robots_disallow,
created_at, updated_at
```

#### company_master（企業マスターDB - 全組織共有）
```sql
id, domain(unique), corporate_number(unique),
company_name, website_url, contact_url, phone, email,
prefecture, city, category_main, category_sub,
全フラグ列, score_total, score_rank,
source, last_scraped_at, created_at, updated_at
```

#### plans（プラン定義）
```sql
id, name, price_monthly, price_yearly,
max_members, max_projects, max_companies,
max_ai_analyses_monthly, max_master_db_imports,
allow_smtp_send, allow_slack_notify,
allow_webhook, allow_export,
stripe_price_id_monthly, stripe_price_id_yearly,
is_active, display_order
```

#### app_settings（組織設定 - 暗号化）
```sql
id, org_id, setting_key, setting_value(encrypted), created_at, updated_at
```

暗号化対象キー（`encryption.py` の `ENCRYPTED_KEYS` リスト参照）:
```
google_api_key, google_cx, google_places_api_key,
slack_webhook_url, smtp_password, openai_api_key,
stripe_secret_key, stripe_publishable_key,
stripe_webhook_secret, gBizINFO_api_token
```

#### system_settings（システム全体設定）
```sql
key(PK), value, updated_at
```

重要なキー:
- `scoring_rules`: JSON形式のスコアリングルール
- `slack_notification_triggers`: Slack通知トリガー設定

#### sales_messages（営業メール）
```sql
id, org_id, company_id, project_id, template_type, subject, body,
status(draft/approved/sent), reviewed_by, sent_at, sent_by,
tracking_token(unique), opened_at, open_count, created_at
```

### 全テーブル一覧（35テーブル）

```
activity_logs        ai_usage_logs       announcements
api_usage_logs       app_settings        audit_logs
collection_logs      companies           company_master
company_tags         email_send_logs     email_verification_tokens
faq_items            hubsrev_event_logs  job_logs
memo_templates       opt_out_list        org_invitations
organizations        outbound_webhooks   password_reset_tokens
plans                projects            rejected_urls
sales_messages       search_keywords     security_events
segments             status_history      status_incidents
support_ticket_messages  support_tickets  system_logs
system_settings      users
```

---

## 7. コアビジネスロジック

### マルチテナント設計

- データは `org_id` で組織ごとに分離
- `companies` は `project_id` 経由で間接的に組織に紐付く
- `_owned_projects(user, db)` で自組織のプロジェクトIDリストを取得
- 全クエリで `project_id.in_(owned_project_ids)` フィルタを適用

### テナント分離パターン（例）

```python
def _owned_projects(user: User, db: Session) -> list[int]:
    return [p.id for p in db.query(Project.id)
            .filter(Project.org_id == user.org_id).all()]

# 企業取得時は必ず owned projects でフィルタ
companies = db.query(Company).filter(
    Company.project_id.in_(_owned_projects(user, db))
).all()
```

### FastAPI ルート順序の注意点

固定パスは動的パスより前に定義すること（FastAPI は上から順にマッチング）:

```python
# NG: /{company_id} が /export.xlsx にマッチしてしまう
@router.get("/{company_id}")
@router.get("/export.xlsx")

# OK: 固定パスを先に定義
@router.get("/export.xlsx")
@router.get("/{company_id}")
```

---

## 8. 認証・認可の設計

### JWT の構成

```python
# トークンペイロード
{
    "sub": str(user.id),
    "org_id": user.org_id,
    "role": user.role,
    "is_system_admin": user.is_system_admin,
    "token_version": user.token_version,  # 強制ログアウト用
    "exp": datetime.utcnow() + timedelta(days=30)
}
```

### 権限レベル

| 権限 | 説明 |
|---|---|
| `member` | 一般メンバー（閲覧・営業操作） |
| `admin` | 組織管理者（設定・メンバー管理） |
| `is_system_admin=True` | COOLWORKS社員専用（全組織管理） |
| `is_founder=True` | 創業者特権（上限なし） |

### 依存関係

```python
get_current_user      # 認証済みユーザー取得
require_phase0_unlock # 一般ユーザー（unlock後）
require_admin         # 組織 admin 以上
# is_system_admin は各エンドポイントで個別チェック
```

### パスワード暗号化

```python
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt", "sha256_crypt"], deprecated="auto")
# sha256_crypt は旧データ互換のため残存
```

---

## 9. プランと課金設計

### プラン上限チェック

```python
# server/routes/plans.py
check_plan_limit(org_id, "companies", db)   # 企業数
check_plan_limit(org_id, "projects", db)    # プロジェクト数
check_plan_limit(org_id, "members", db)     # メンバー数
check_plan_limit(org_id, "ai_analyses", db) # AI分析月次
check_plan_limit(org_id, "master_db_imports", db) # マスターDB取込
```

### Stripe 連携フロー

1. `POST /api/payments/create-checkout-session` → Stripe Checkout
2. Stripe Webhook → `POST /api/payments/stripe-webhook` でサブスクリプション反映
3. `organization.subscription_status` で有効性を管理

---

## 10. スコアリングロジック

### デフォルトスコアリングルール（`server/services/scorer.py`）

```python
DEFAULT_SCORING_RULES = {
    "ec_flag": 25,          # ECサイト判定
    "escms_target_flag": 20, # ESCMS対象
    "shopify_flag": 20,      # Shopify利用
    "production_flag": 15,   # 制作系
    "consulting_flag": 15,   # コンサル系
    "operation_flag": 15,    # 運用系
    "contact_url": 15,       # 問い合わせURL有り
    "multi_platform": 10,    # 複数ECモール
    "sns_count_3": 10,       # SNS 3件以上
    "has_recruitment": 5,    # 採用情報
    "sns_count_1": 5,        # SNS 1件以上
    "phone": 5,              # 電話番号
    "location": 5,           # 所在地情報
    "info_missing_penalty": -10,      # 情報不足
    "no_contact_penalty": -15,        # 問合せ先なし
    "not_ec_related_penalty": -20,    # EC無関係
}
```

### ランク基準

```
A: 80点以上
B: 60〜79点
C: 40〜59点
D: 39点以下
```

### ルールの優先順位

1. プロジェクト独自ルール（`project.scoring_rules`）
2. システム共通ルール（DB の `system_settings.scoring_rules`）
3. デフォルトルール（`DEFAULT_SCORING_RULES`）

---

## 11. 自動収集フロー

### スケジューラー（`server/services/scheduler.py`）

30秒ポーリングで以下を管理：

| ジョブ | 条件 | 説明 |
|---|---|---|
| 自動収集 | `auto_collect_enabled=true` かつ設定時刻 | キーワードで Google 検索・収集 |
| 自動補完 | 毎日 AM 4:00 | URL未取得企業を gBizINFO・Google で補完 |
| マスターDB収集 | 別途設定 | 全キーワードで定期収集 |
| フォローアップ通知 | 毎日AM10:00 | 期日迫った企業をメール/Slack通知 |

### 収集パイプライン

```
キーワード入力
  → Google検索（Serper API / Google Custom Search）
  → ドメイン正規化（aggregator.py）
  → 重複・除外チェック
  → スクレイピング（scraper.py）
    → 企業名・電話・メール・住所抽出
    → CMS判定（Shopify/WordPress等）
    → EC/SNS/採用情報検出
    → フルテキスト取得
  → カテゴリ分類（categorizer.py）
  → スコアリング（scorer.py）
  → Company テーブルへ保存
  → CompanyMaster テーブルへ upsert
  → Webhook 発火（company.created）
  → Slack 通知（Aランクの場合）
```

---

## 12. ゼロからの再構築手順

### Step 1: リポジトリの準備

```bash
# 新しいリポジトリ作成またはコードの再入力
mkdir leadhive && cd leadhive
git init
```

### Step 2: Python 環境のセットアップ

```bash
python3.11 -m venv .venv
source .venv/bin/activate

# pyproject.toml に依存関係を記述後
pip install uv
uv sync
# または
pip install -r requirements.txt
```

### Step 3: PostgreSQL データベースの作成

```bash
createdb leadhive
createuser leadhive_user
psql -c "ALTER USER leadhive_user PASSWORD 'your_password';"
psql -c "GRANT ALL PRIVILEGES ON DATABASE leadhive TO leadhive_user;"
```

### Step 4: 環境変数の設定

```bash
export DATABASE_URL="postgresql://leadhive_user:your_password@localhost/leadhive"
export SESSION_SECRET="your-random-64-char-string-here"
```

### Step 5: テーブルの作成

```bash
# SQLAlchemy の Base.metadata.create_all() でテーブル作成
# server/main.py の lifespan でテーブルが自動作成される
python server/main.py
# または
python -c "
from server.database import engine
from server.models import Base
Base.metadata.create_all(bind=engine)
print('Tables created.')
"
```

### Step 6: フロントエンドのビルド

```bash
npm install
npx vite build --config frontend/vite.config.ts
```

### Step 7: サーバー起動確認

```bash
python server/main.py
# http://localhost:5000 でアクセス確認
```

---

## 13. 初期データの投入

### プランデータ

`server/main.py` の `DEFAULT_PLANS` リストに初期プランが定義されています。
サーバー起動時に `plans` テーブルが空の場合、自動で投入されます。

```python
DEFAULT_PLANS = [
    {"name": "Free", "price_monthly": 0, "max_companies": 50, ...},
    {"name": "Starter", "price_monthly": 9800, ...},
    {"name": "Pro", "price_monthly": 29800, ...},
    {"name": "Founder", "price_monthly": 0, ...},  # 運営者専用
]
```

---

## 14. 管理者アカウント作成

データが完全に失われた場合、以下のスクリプトでシステム管理者を作成します。

```python
# スクリプト例（python シェルで実行）
from server.database import SessionLocal
from server.models import User, Organization
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
db = SessionLocal()

# 組織作成
org = Organization(name="COOLWORKS株式会社", is_active=True)
db.add(org)
db.flush()

# 管理者ユーザー作成
user = User(
    org_id=org.id,
    email="admin@coolworks.jp",
    password_hash=pwd_context.hash("StrongPassword123!"),
    name="田中 智一郎",
    role="admin",
    is_active=True,
    is_system_admin=True,
    is_founder=True,
    email_verified=True,
)
db.add(user)
db.commit()
print(f"Created admin user: {user.email} (org_id={org.id})")
db.close()
```

---

## 15. 重要な設計判断と注意事項

### 1. SESSION_SECRET の不変性

`SESSION_SECRET` は以下の目的で使用されています：

- JWT署名（変更するとすべてのトークンが無効化）
- `app_settings` テーブルの API キー暗号化（変更すると既存データが復号不能）

**絶対に変更しないこと。変更する場合は全ユーザーに通知し、全 APIキーを再入力してもらう必要があります。**

### 2. スケジューラーの単一インスタンス要件

`scheduler.py` は `threading` ベースで動作するため、**複数プロセスを起動しないこと**。
複数インスタンスを立ち上げると、スケジューラーが重複実行されます。
スケーリングが必要な場合は、スケジューラーとAPIサーバーを別プロセスに分離することを推奨します。

### 3. FastAPI ルート定義順序

固定パス（`/export.xlsx`, `/bulk-status` 等）は動的パス（`/{id}` 等）より**必ず前**に定義すること。
後に定義すると固定パスが `{id}` にマッチしてしまい、404 や意図しない挙動になります。

### 4. マルチテナントの漏洩防止

全てのクエリで必ず `org_id` または `project_id.in_(owned_projects)` でフィルタすること。
フィルタを忘れると他組織のデータが見えてしまうセキュリティ問題が発生します。

### 5. 暗号化キーの設定

`server/services/encryption.py` の `ENCRYPTED_KEYS` リストに含まれるキーは自動的に暗号化されます。
新たに機密データを `app_settings` に追加する場合は必ずこのリストに追加してください。

### 6. データベース接続プール設定

```python
engine = create_engine(
    DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_timeout=5,
    pool_pre_ping=True,
)
```

本番環境では `pool_pre_ping=True` が必須（接続切断後の自動再接続）。

### 7. CORS 設定

```python
allow_origin_regex=r"https://(leadhive\.work|.*\.leadhive\.work|.*\.replit\.dev|.*\.repl\.co)|http://(localhost|127\.0\.0\.1)(:\d+)?"
```

本番では `replit.dev` / `repl.co` パターンを削除し、`leadhive.work` のみ許可することを推奨。

---

## 緊急連絡先

| 担当 | 連絡先 |
|---|---|
| 運営会社 | COOLWORKS株式会社 |
| 代表 | 田中 智一郎 |
| 所在地 | 〒651-0084 兵庫県神戸市中央区磯辺通１丁目１番１８号 カサベラ国際プラザビル707号室 |
| ドメイン | leadhive.work |

---

*最終更新: 2026年3月 — COOLWORKS株式会社*
