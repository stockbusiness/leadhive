# LeadHive — 機能一覧・開放ロジック仕様書

> 最終更新: 2026-03  /  対象バージョン: Phase 8 + セキュリティ強化 + 特定商取引法対応 完了時点

---

## 1. ユーザーロール定義

| ロール | 対象 | 権限範囲 |
|--------|------|---------|
| `member` | 一般ユーザー | 自org内の担当企業のみ操作可 |
| `admin` | 組織管理者 | 自org内の全データ + チームダッシュボード + 自動生成スケジュール設定 |
| `system_admin` | COOLWORKS管理者 | 全テナント + システム設定全般 |
| `is_founder` | 先着50名 | Founderプラン (全機能永久無料) + バッジ表示 |
| `is_system_admin` | COOLWORKSスタッフ | 管理画面 (`/admin/*`) へのアクセス |

> **注意**: `system_admin` ロールと `is_system_admin` フラグは別物。
> - `role = "system_admin"` → 組織ロール (通常は未使用)
> - `is_system_admin = True` → COOLWORKS専用フラグ。管理画面アクセスに使用。

---

## 2. プランと数量制限

| 項目 | フリー | スターター | プロ | エンタープライズ | Founder |
|------|:------:|:----------:|:----:|:----------------:|:-------:|
| 月額 | ¥0 | ¥4,980 | ¥14,800 | 要問合せ | ¥0 (永久) |
| メンバー上限 | 1 | 3 | 10 | 無制限 | 無制限 |
| プロジェクト上限 | 1 | 3 | 10 | 無制限 | 無制限 |
| 企業登録上限 | 200 | 1,000 | 5,000 | 無制限 | 無制限 |
| AI分析 (月) | 3 | 20 | 100 | 無制限 | 無制限 |
| マスターDBインポート | 0 | 100 | 無制限 | 無制限 | 無制限 |
| CSVエクスポート | 50件 | 1,000件 | 無制限 | 無制限 | 無制限 |

> **Founderプラン**: 先着50名限定。新規登録時に自動判定し `is_founder = True` を付与。サイドバーに金のバッジ表示。

---

## 3. 機能別アクセス制御一覧

### 3-1. 企業収集

| 機能 | 開放条件 | 備考 |
|------|---------|------|
| キーワード登録・編集 | ログイン済み全員 | プロジェクト内 |
| 手動収集実行 | ログイン済み全員 | |
| 自動収集スケジュール | ログイン済み全員 (AppSetting) | 設定はSettings画面 |
| Googleマップ収集 | `feature_google_maps = ON` | システム管理者がテナント単位でON/OFF |
| gBizINFO法人DB収集 | `feature_gbizinfo = ON` | システム管理者がテナント単位でON/OFF |
| マスターDBインポート | `feature_master_db = ON` + プランのインポート上限 > 0 | フリープランは0件制限 |

### 3-2. 企業管理

| 機能 | 開放条件 | 備考 |
|------|---------|------|
| 企業一覧・検索・フィルター | ログイン済み全員 | |
| 企業詳細表示 | ログイン済み全員 | |
| 企業編集・ステータス変更 | ログイン済み全員 | |
| タグ付け | ログイン済み全員 | |
| 担当者アサイン | ログイン済み全員 | |
| フォローアップ日設定 | ログイン済み全員 | |
| AI企業分析 | `feature_ai_analysis = ON` + 月次AI分析残数 > 0 | 残数はプラン制限に基づく |
| CSVエクスポート | `feature_csv_export = ON` + エクスポート可能件数 > 0 | プランのmax_csv_exportに基づく |
| CSVインポート | ログイン済み全員 | |
| メモ記録 | ログイン済み全員 | |
| テンプレート利用 | ログイン済み全員 | |

### 3-3. 営業パイプライン

| 機能 | 開放条件 | 備考 |
|------|---------|------|
| カンバン表示 | ログイン済み全員 | `/pipeline` |
| ドラッグ&ドロップ移動 | ログイン済み全員 | |
| ステータス変更ドロップダウン | ログイン済み全員 | |

### 3-4. 営業AI (SalesAI)

| 機能 | 開放条件 | 備考 |
|------|---------|------|
| 営業文生成 (単体・一括) | Anthropic APIキー設定済み | 未設定時は警告バナー表示 |
| ドラフトレビュー・編集 | ログイン済み全員 | |
| SMTPメール送信 | SMTP設定済み **+ `plan.allow_smtp_send = True`** | フリープランは不可（HTTP 402）。未設定時は400エラー |
| 問い合わせフォーム送信 | ログイン済み全員 (URLが必要) | |
| 配信停止リスト管理 | ログイン済み全員 | |
| 送信統計ダッシュボード | ログイン済み全員 | |
| **自動生成スケジュール設定** | `role = "admin"` または `is_system_admin = True` | org admin 以上 |

### 3-5. 通知

| 機能 | 開放条件 | 備考 |
|------|---------|------|
| 通知ベル (in-app) | ログイン済み全員 | モバイルヘッダー + デスクトップサイドバー |
| フォローアップ通知範囲 | admin/system_admin → org全体  /  member → 自分担当分のみ | |
| フォローアップ通知メール | `followup_notify_enabled = true` + `channel = email or both` + SMTP設定済み | Settings画面でON/OFF |
| フォローアップ通知Slack | `followup_notify_enabled = true` + `channel = slack or both` + Slack Webhook設定済み | `feature_slack_notify = ON` も必要 |

### 3-6. ダッシュボード

| 機能 | 開放条件 | 備考 |
|------|---------|------|
| 個人ダッシュボード (マイページ) | ログイン済み全員 | |
| 組織ダッシュボード | ログイン済み全員 | |
| **チームダッシュボード** | `role = "admin"` または `is_system_admin = True` | フリープラン・member はロック画面 |
| キーワード分析タブ | ログイン済み全員 | |
| 収集効率ランキングカード | 収集実績データが存在する場合のみ表示 | データなし時はプレースホルダー |

### 3-7. 設定 (`/settings`)

| 機能 | 開放条件 | 備考 |
|------|---------|------|
| 基本設定 (SMTP・Slack・通知) | `role = "admin"` 以上 | Settings画面 |
| チームメンバー招待・管理 | `role = "admin"` 以上 | プランのmax_members制限あり |
| プランアップグレード | `feature_self_upgrade = ON` | Stripe連携 |
| APIキー設定 (Serper・Anthropic・gBizINFO) | `is_system_admin = True` のみ | SystemSettings テーブル (org_id = NULL) |
| **2FA TOTP** | ログイン済み全員 | pyotp + qrcode。有効化/無効化可。有効化時はJWT token_versionをインクリメント |
| **Customer Portal** | 有料プラン（Stripeサブスクリプションあり） | Stripeカスタマーポータルへのリダイレクト |
| **全デバイスログアウト** | ログイン済み全員 | token_version+1 → 全既存JWTを無効化 |
| **データエクスポート** | ログイン済み全員 | GDPR対応。アカウント情報・組織・APIキー・企業数をJSON出力 |
| **アカウント削除** | ログイン済み全員 | Stripeサブスクリプション解約 + DBレコード削除 + JWT無効化 |

### 3-8. 管理画面 (/admin/*)

**すべて `is_system_admin = True` 専用。**

| ページ | URL | 機能 |
|--------|-----|------|
| 管理ダッシュボード | `/admin/dashboard` | テナント数・ユーザー数・AI利用コスト・**MRR/ARR/チャーン率** |
| テナント管理 | `/admin/tenants` | 組織一覧・プラン変更・リスク評価 |
| ユーザー管理 | `/admin/users` | 全テナントのユーザー管理 |
| プラン管理 | `/admin/plans` | プランCRUD・価格設定 |
| 機能フラグ | `/admin/features` | テナント別機能ON/OFF |
| APIキー設定 | `/admin/api-keys` | Serper・Anthropic・gBizINFO |
| マスターDB自動収集 | `/admin/auto-master` | 全テナント向けマスターDB収集スケジュール |
| SMTP設定 | `/admin/smtp` | システムSMTP設定 |
| 請求管理 | `/admin/billing` | Stripe PaymentIntents |
| 告知管理 | `/admin/announcements` | 全体・テナント別アナウンス |
| システムログ | `/admin/logs` | 監査ログ |
| Stripe設定 | `/admin/stripe` | Webhook・価格ID設定 |
| **特定商取引法表記** | `/admin/legal` | 特定商取引法に基づく公開ページ (`/legal/tokutei`) の内容管理 |

---

## 4. 機能フラグ (システム管理者が制御)

`/admin/features` でテナント単位でON/OFF。デフォルトはすべて **ON**。

| フラグキー | 制御対象機能 |
|-----------|------------|
| `feature_ai_analysis` | AI企業分析 (GPT-4o-mini) |
| `feature_csv_export` | CSVエクスポート |
| `feature_master_db` | マスターDB 参照・インポート |
| `feature_gbizinfo` | gBizINFO 法人DB収集 |
| `feature_google_maps` | Googleマップ収集 |
| `feature_slack_notify` | Slack通知 (フォローアップ等) |
| `feature_self_upgrade` | ユーザー自身によるStripeプランアップグレード |

---

## 5. スケジューラー定時実行 (Reserved VM で常時稼働)

| ジョブ | 実行条件 | タイミング |
|--------|---------|-----------|
| **キーワード自動収集** | `auto_collect_enabled = true` | AppSetting `auto_collect_time` で指定 (例: "09:30") |
| **マスターDB自動収集** | SystemSetting `auto_master_enabled = true` | `auto_master_schedule_hour` 指定時刻 |
| **フォローアップ通知** | `followup_notify_enabled = true` | 毎朝 **09:00** 固定 |
| **半自動メール生成** | `auto_generate_enabled = true` | org 別 `auto_generate_hour` 指定時刻 |
| **非アクティブユーザー停止** | 常時有効 | 毎朝 **02:00** 固定 (30日未ログインで停止) |

---

## 6. サイドバーナビゲーション表示制御

| メニュー項目 | 表示条件 |
|------------|---------|
| ダッシュボード | 全員 |
| 企業収集 | 全員 |
| 企業リスト | 全員 |
| パイプライン | 全員 |
| 営業AI | 全員 |
| マスターDB | `feature_master_db = ON` |
| キーワード | 全員 |
| プロジェクト | 全員 |
| 設定 | 全員 (タブ単位で制限あり) |
| **管理画面リンク** | `is_system_admin = True` のみ | サイドバー下部に表示 |

---

## 7. 通知ベルの表示ロジック

```
GET /api/notifications/follow-ups
  ├── admin または is_system_admin → org内全プロジェクトの期限企業
  └── member → 自分が assignee_id として設定された企業のみ

除外ステータス: ["代理店化", "失注", "除外"]
今日のフォローアップ: follow_up_date == 今日
期限超過: follow_up_date < 今日
上限: 各カテゴリ最大20件
```

赤バッジ: `today_count + overdue_count > 0` の場合に表示

---

## 8. 半自動メール生成スケジューラーのロジック

```
対象企業の選定条件 (AND 条件):
  1. project_id が設定対象プロジェクト内
  2. status が auto_generate_statuses に含まれる (例: ["未確認", "アプローチ前"])
  3. score_rank が min_score 以上 (A=4, B=3, C=2, D=1)
  4. SalesMessage (draft/ready) が未生成

ソート: score_rank 降順 → id 昇順
上限: max_per_run 件 (1〜50)
生成後: status = "draft" で保存 → 「レビュー・送信」タブで人間が確認・送信
```

---

## 9. データ分離 (マルチテナント)

`Company` テーブルに `org_id` カラムはない。**必ず `project_id` 経由でテナント分離する。**

```python
# 正しいパターン
org_project_ids = [p.id for p in db.query(Project)
                   .filter(Project.org_id == current_user.org_id).all()]
companies = db.query(Company).filter(Company.project_id.in_(org_project_ids))
```

`AppSetting` (組織設定): `org_id` カラムでテナント分離  
`SystemSettings` (システム設定): `org_id = NULL` (全テナント共通)

---

## 10. 公開エンドポイント (認証不要)

| エンドポイント | 機能 |
|--------------|------|
| `GET /api/public/roadmap-stats` | ロードマップページ用統計 |
| `GET /api/public/unsubscribe` | ワンクリック配信停止 (HMAC-SHA256 トークン検証) |
| `GET /api/public/legal` | 特定商取引法に基づく表記データ取得（`/legal/tokutei` ページ用） |
| `POST /api/auth/login` | ログイン（レート制限: 10回/分） |
| `POST /api/auth/register` | 新規登録（レート制限: 5回/分） |
| `POST /api/auth/forgot-password` | パスワードリセットメール（レート制限: 3回/分） |
| `POST /api/auth/reset-password` | パスワードリセット実行 |
