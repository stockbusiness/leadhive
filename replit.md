# LeadHive — 技術ドキュメント

## プロジェクト概要

**LeadHive** は COOLWORKS株式会社 が開発・運営する BtoB 営業先リスト自動化 SaaS。
ドメイン: `leadhive.work` / 本番URL: Replit Reserved VM でホスティング

Google検索・Googleマップ・gBizINFO など複数ソースから営業先を自動収集し、
スコアリング→AI分析→メール生成→パイプライン管理→チーム共有を一気通貫で行う。

---

## 技術スタック

| 層 | 技術 |
|---|---|
| フロントエンド | React 18 + TypeScript + Vite + Tailwind CSS + Recharts + Lucide Icons |
| バックエンド | FastAPI (Python 3.11) / Uvicorn / ポート 5000 |
| データベース | PostgreSQL 16 (Replit 内蔵) |
| 認証 | JWT + sha256_crypt |
| AIライター | Anthropic Claude-3-5-Sonnet (Anthropic API) |
| AI分析 | OpenAI GPT-4o-mini |
| 検索API | Serper API (優先) / Google Custom Search API (フォールバック) |
| 地図・企業情報 | Google Places API / gBizINFO API |
| 決済 | Stripe |
| 通知 | SMTP メール / Slack Incoming Webhook |
| スケジューラー | Python threading (30秒ループ) |

---

## ディレクトリ構造

```
/
├── server/
│   ├── main.py              # FastAPI エントリポイント・ライフサイクル
│   ├── models.py            # SQLAlchemy ORM モデル (全テーブル定義)
│   ├── database.py          # DB セッション管理
│   ├── auth.py              # JWT 認証ユーティリティ
│   ├── routes/
│   │   ├── auth.py          # ログイン・登録・パスワードリセット
│   │   ├── companies.py     # 企業 CRUD・フィルタ・パイプライン
│   │   ├── keywords.py      # キーワード管理・分析
│   │   ├── projects.py      # プロジェクト管理
│   │   ├── dashboard.py     # ダッシュボード集計・チーム統計
│   │   ├── scraper.py       # スクレイピングジョブ管理
│   │   ├── collector.py     # 収集実行ロジック
│   │   ├── sales_ai.py      # 営業文生成・送信・統計・自動生成スケジュール
│   │   ├── notifications.py # フォローアップ通知 API
│   │   ├── settings.py      # 組織設定 (SMTP/Slack/通知)
│   │   ├── templates.py     # メール・メモテンプレート
│   │   ├── master.py        # マスターDB 検索・インポート
│   │   ├── segments.py      # 検索条件セグメント
│   │   ├── users.py         # 組織ユーザー管理
│   │   ├── plans.py         # プラン管理
│   │   ├── payments.py      # Stripe 連携
│   │   ├── onboarding.py    # オンボーディング
│   │   ├── public.py        # 公開エンドポイント (配信停止等)
│   │   ├── rejected.py      # 除外URL管理
│   │   ├── admin_auto_master.py # システム管理: マスター自動収集
│   │   └── (admin routes)   # テナント・ユーザー・ログ・請求管理
│   └── services/
│       ├── scheduler.py     # バックグラウンドスケジューラー (常時稼働)
│       ├── collector.py     # 収集エンジン (Serper/Google/Maps/gBiz)
│       ├── scraper.py       # Webスクレイピング (BeautifulSoup4)
│       ├── ai_writer.py     # Claude による営業文生成
│       ├── ai_analyzer.py   # GPT-4o-mini による企業分析
│       ├── mailer.py        # SMTP メール送信
│       ├── slack.py         # Slack Webhook 通知
│       └── unsubscribe_token.py # HMAC-SHA256 配信停止トークン
├── frontend/
│   ├── src/
│   │   ├── pages/           # ページコンポーネント
│   │   ├── components/      # 共通コンポーネント
│   │   ├── api/index.ts     # axios API クライアント (全エンドポイント)
│   │   ├── contexts/        # React Context (Auth/Project/Theme)
│   │   └── types/           # TypeScript 型定義
│   └── vite.config.ts
└── replit.md
```

---

## データベース主要テーブル

| テーブル | 概要 |
|---------|------|
| `organizations` | テナント組織 |
| `users` | ユーザー (role: member/admin/system_admin, is_founder, is_system_admin) |
| `projects` | プロジェクト (org_id でテナント分離) |
| `companies` | 営業先企業 (project_id 経由で org 紐付け) |
| `company_master` | 全プロジェクト横断マスターDB |
| `search_keywords` | 収集キーワード |
| `sales_messages` | 営業文 (status: draft/reviewed/sent/failed) |
| `audit_logs` | 送信監査ログ |
| `opt_out_list` | 配信停止リスト |
| `app_settings` | 組織別設定 KV ストア |
| `system_settings` | システム管理者用 KV ストア |
| `plans` | サブスクリプションプラン |
| `status_history` | 企業ステータス変更履歴 |
| `collection_logs` | 収集ジョブログ |

**重要**: `Company` テーブルに `org_id` カラムはない。
`project_id` 経由でフィルタする (`_owned_projects(user, db)` 関数を使用)。

---

## 認証・認可

- JWT トークン (Bearer) / `get_current_user` で依存注入
- `role`: `member` / `admin` / `system_admin`
- `is_system_admin`: COOLWORKS 管理者専用フラグ (テナントを超えた全体管理)
- `is_founder`: 先着50名の特別ユーザーフラグ
- システム管理画面 (`/admin/*`) は `is_system_admin=True` のみアクセス可
- チームタブ等の一部機能: `admin` ロールまたは `is_system_admin` でアクセス可

---

## スケジューラー (server/services/scheduler.py)

`_scheduler_loop()` が 30秒ごとにポーリング。Reserved VM デプロイで常時稼働。

| ジョブ | 実行タイミング |
|-------|-------------|
| `_run_auto_collect()` | AppSetting `auto_collect_time` で指定した時刻 (org 共通) ＋ gBizINFOトークンがあれば追加収集 |
| `_run_auto_master_collect()` | SystemSetting `auto_master_schedule_hour` 指定時刻 |
| `_run_suspend_inactive_users()` | 毎朝 02:00 |
| `_run_auto_enrich_all()` | 毎朝 04:00 (AppSetting `auto_enrich_enabled` per org) |
| `_run_auto_master_enrich()` | 毎朝 05:00 (SystemSettings `auto_master_enrich_enabled`) |
| `_run_followup_notify()` | 毎朝 09:00 (メール or Slack) |
| `_run_auto_generate_for_org()` | org 別 `auto_generate_hour` 指定時刻 |

---

## 実装済み全機能一覧

### 収集・スコアリング
- Google検索 (Serper API / Google CSE)・Googleマップ・gBizINFO・ディレクトリ・Shopify パートナーから自動収集
- 100点スコアリング (問い合わせフォーム有無・Shopify/EC判定・所在地等)・A〜Dランク自動付与
- CMS自動検出 (Shopify/WordPress/BASE/MakeShop 等 11種)
- メール・SNS自動抽出、採用情報検出、robots.txt 遵守
- ドメイン正規化による重複排除・まとめサイト自動ブラックリスト

### 企業管理
- 企業一覧 (フィルタ・ソート・ページネーション)・詳細・編集
- タグ付け・スコア手動調整・担当者アサイン・フォローアップ日設定
- CSVインポート・エクスポート (プラン制限付き)
- マスターDB 横断検索・再活用

### 営業パイプライン
- カンバンボード (9ステータス: 未確認→代理店化/失注/除外)
- HTML5 ドラッグ&ドロップでのステータス変更
- ドロップダウンによるステータス変更、プロジェクトフィルター

### 営業AI (SalesAI)
- Claude-3-5-Sonnet による営業メール生成 (3テンプレート: Shopify/EC支援/代理店)
- 一括生成 (最大50件)、ドラフト保存・レビュー・SMTP送信
- 配信停止リスト管理 (自動 + 手動 + メール内ワンクリック配信停止)
- **半自動生成スケジューラー**: 毎日指定時刻に対象企業の営業文を自動生成→ドラフト保存→人間がレビュー・送信
- 送信統計ダッシュボード・監査ログ

### 通知・コミュニケーション
- アプリ内通知ベル (フォローアップ期限・超過、5分自動更新)
- 毎朝9時フォローアップ通知メール (担当者宛)
- Slack Webhook 通知 (収集完了・フォローアップ)
- 配信停止ページ (`/unsubscribe`) + List-Unsubscribe ヘッダー

### ダッシュボード・分析
- 組織ダッシュボード (収集件数・アプローチ率・成約率・スコア分布)
- チームダッシュボード (担当者別進捗・活動・期限超過) ※admin/system_admin
- キーワード分析 (成功率・重複率・収集効率ランキングカード)

### チーム管理
- 組織メンバー招待・権限管理・プロフィール
- 6ステップオンボーディングウィザード

### 管理者機能 (COOLWORKS 専用)
- テナント・ユーザー・プラン・請求管理
- APIキー一元管理 (Serper/Anthropic/gBizINFO)
- 機能フラグ管理
- マスターDB 自動収集スケジュール

---

## 重要な実装注意事項

### FastAPI ルート順序
`GET /api/companies/pipeline` などの固定パスは必ず `GET /api/companies/{id}` より**前**に定義する。
後ろに置くと `company_id` に `"pipeline"` が渡されて 422 エラーになる。

### org フィルタリング
`Company` テーブルに `org_id` はない。必ず `project_id` 経由でフィルタする。
```python
def _owned_projects(user, db):
    return db.query(Project).filter(Project.org_id == user.org_id).all()
```

### ダークモード
`ThemeContext` が `<html>` に `.dark` クラスを付与。Tailwind `dark:` バリアント使用。

### AppSetting パターン
組織別設定は `app_settings` テーブルに KV 形式で保存:
```python
row = db.query(AppSetting).filter(
    AppSetting.setting_key == key,
    AppSetting.org_id == org_id,
).first()
```

### 通知ベルの buttonClassName
`NotificationPanel` は `buttonClassName` プロップで親からスタイル上書き可能。
サイドバー (暗背景) では `"relative p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 ..."` を渡す。
`relative` クラスを必ず含めること (バッジの絶対配置に必要)。

---

## 開発コマンド

```bash
# フロントエンドビルド
npx vite build --config frontend/vite.config.ts

# 開発サーバー起動 (ポート 5000)
python server/main.py

# ポート解放 (起動失敗時)
fuser -k 5000/tcp
```

### テスト認証情報
- `admin@test.com` / `LeadHive2026!` (is_system_admin=True, org_id=2)

---

## デプロイ

- **プラットフォーム**: Replit Reserved VM
- **ビルドコマンド**: `bash -c "npx vite build --config frontend/vite.config.ts"`
- **起動コマンド**: `python server/main.py`
- **VM必須の理由**: バックグラウンドスケジューラーが常時稼働するため Autoscale 不可
- **ドメイン**: `leadhive.work` (カスタムドメイン設定済み)

---

## 実装フェーズ履歴

### Phase 1-3: コア機能
自動収集・スコアリング・企業管理・マスターDB・基本ダッシュボード・オンボーディング

### Phase 4a: SMTP メール送信 (2026-03)
`send_message` エンドポイントで SMTP 実送信。SendConfirmModal でレシピエント確認・SMTP状態表示・3送信方法選択。audit_logs に送信記録。

### Phase 4b: 配信停止自動化 (2026-03)
HMAC-SHA256 トークン生成・公開配信停止エンドポイント・メール内ワンクリック配信停止リンク・List-Unsubscribe ヘッダー・`/unsubscribe` 公開ページ。

### Phase 4c: 送信統計ダッシュボード (2026-03)
`GET /api/sales-ai/stats`・`GET /api/sales-ai/audit-logs`。SalesAI に「送信統計」タブ追加 (KPI カード・棒グラフ・監査ログテーブル)。

### Phase 4d: 半自動送信スケジューラー (2026-03)
`GET/PUT /api/sales-ai/auto-generate/settings`・`POST /api/sales-ai/auto-generate/run-now`。
`_run_auto_generate_for_org()` をスケジューラーに追加。SalesAI に「自動生成スケジュール」タブ追加。
設定: 有効化・実行時刻・対象ステータス・最低スコアランク・最大生成件数・テンプレート・プロジェクト。

### Phase 5: 営業パイプライン (2026-03)
`GET /api/companies/pipeline`・`PATCH /api/companies/{id}/status`。
`Pipeline.tsx`: 9列カンバンボード・HTML5 D&D・ステータス変更ドロップダウン・プロジェクトフィルター。

### Phase 6: フォローアップ通知ベル (2026-03)
`GET /api/notifications/follow-ups`。`NotificationPanel.tsx`: 赤バッジ付きベルアイコン・ドロップダウンパネル・5分自動更新。モバイルヘッダー + デスクトップサイドバーに設置。

### Phase 7: チームダッシュボード開放 (2026-03)
Dashboard.tsx: チームタブを `isSystemAdmin || user?.role === "admin"` に変更 (org admin にも開放)。

### Phase 8: 収集効率ランキングカード (2026-03)
Keywords.tsx 分析タブに「成功率 上位キーワード (緑)」「要改善キーワード (赤)」カード追加。フロントエンドのみ、API変更なし。

### Phase 9: サポート負担軽減機能 (2026-03)

**FAQページ + チケット前サジェスト**
- `faq_items` DBテーブル。`server/routes/faq.py`: `GET /api/faq`, `GET /api/faq/search`, CRUD `/api/admin/faq`。
- `Faq.tsx` (`/faq`): アコーディオン形式・カテゴリフィルター・全文検索。公開ページ。
- `AdminFaq.tsx` (`/admin/faq`): FAQ CRUD管理。
- `Support.tsx` 更新: 件名入力時400msデバウンスでFAQ候補をBlueboxで表示。
- LandingPageフッター・App.tsxサイドバーにFAQリンク追加。

**アプリ内ツールチップ**
- `components/HelpTooltip.tsx`: `?` アイコン・ホバー+クリックでテキスト表示。
- Dashboard.tsx / Keywords.tsx / Scraper.tsx / Settings.tsx の見出しに追加。

**ステータスページ**
- `status_incidents` DBテーブル (severity: minor/major/critical, status: investigating/identified/monitoring/resolved)。
- `server/routes/status_page.py`: `GET /api/status-page`, CRUD `/api/admin/status-incidents`。
- `Status.tsx` (`/status`): 稼働状況ヘッダー・インシデント一覧。公開ページ。
- `AdminStatus.tsx` (`/admin/status`): インシデント管理。

**チケット自動クローズ**
- `_run_auto_close_tickets()`: scheduler.pyに追加。毎日02:30実行。`ticket_auto_close_days`日間(デフォルト7日)返信なしのチケットを自動closed。クローズ時ユーザーへ通知メール送信。
- `GET/PUT /api/admin/support/settings`: 自動クローズ日数設定API (SystemSettingsに暗号化保存)。
- `AdminSupport.tsx` 更新: 歯車ボタン→設定モーダルで日数変更可能。
