---
name: テレアポ機能実装
description: LeadHive のテレアポ（電話営業）機能の全実装内容。初期実装〜O1-O6最適化〜E1-E8拡張まで。
---

## 実装フェーズ一覧

| フェーズ | 内容 |
|---------|------|
| **初期実装** | CallLog モデル・6エンドポイント・AIスクリプト・Zoom Phone統合 |
| **O1〜O6 最適化** | クエリ最適化・ナビゲーション・ソート・KB・コピー・週次グラフ |
| **E1〜E8 拡張** | 折り返し予約・タイマー・チーム統計・テンプレ・NG除外・CSV・Slackレポート・分析 |

---

## Phase 1: 初期実装

### データモデル (`server/models.py`)

`CallLog` テーブル：
- `id`, `company_id` (FK→Company), `user_id` (FK→User), `org_id`
- `result`: 不在 / 留守電 / 折り返し / NG / 興味あり / 商談決定
- `memo`, `called_at`, `created_at`
- **拡張追加カラム**: `call_duration INTEGER` (通話秒数), `callback_at TIMESTAMP` (折り返し予定日時)
- 自動マイグレーション: `main.py` の `ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS` で起動時に付与

### バックエンド API (`server/routes/tele_apo.py`)

ルーター: `/api/tele-apo`（`server/main.py` に登録済み）

**FastAPI ルート順序の鉄則**: 固定パスはすべて動的パス (`/{log_id}` 等) より前に定義すること。

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/companies` | 電話番号ありの企業リスト。`sort`/`exclude_ng`/`rank`/`status` フィルター対応 |
| GET | `/stats` | 統計。`?days=7` で日次ブレークダウン付き |
| GET | `/callbacks` | callback_at が未来の折り返し予定リスト |
| GET | `/team-stats` | メンバー別架電数・アポ率（admin/system_admin のみ） |
| GET | `/export.csv` | 架電ログCSV（StreamingResponse） |
| GET | `/insights` | 時間帯別・曜日別接続率分析 |
| GET | `/script-templates` | カスタムスクリプトテンプレート取得（AppSetting経由） |
| POST | `/script-templates` | テンプレート保存 |
| POST | `/script` | Claude-3-5-Sonnet でトークスクリプト生成 |
| POST | `/logs` | 架電結果記録。`call_duration`・`callback_at` 含む。「商談決定」時は会社ステータスを「商談中」に自動更新 |
| GET | `/logs` | 架電履歴一覧（`company_id` フィルター） |
| DELETE | `/logs/{log_id}` | ログ削除（自分のログのみ） |

すべてのエンドポイントは `_owned_projects(current_user, db)` でテナント分離済み。

### スケジューラー (`server/services/scheduler.py`)

`_run_tele_apo_daily_report()` を追加し、毎日 17:00 に Slack 日次架電サマリーを送信。  
**有効化条件**: `AppSetting.tele_apo_daily_report_enabled = "true"` が必要。

---

## Phase 2: O1〜O6 最適化

### O1: N+1クエリ修正
`/companies` で最新 CallLog をサブクエリ（`func.max(CallLog.called_at)` + JOIN）で一括取得。N+1 問題を解消。

### O2: 次の企業→ナビゲーションボタン
パネルヘッダーに `◀` `▶` ボタン追加。`←` `→` キーボードショートカットでも移動可能。

### O3: ソートドロップダウン
`?sort=score|uncalled_first|last_called` パラメーター対応。
- `uncalled_first`: 未架電 → 古い順
- `last_called`: 最終架電が古い順

### O4: キーボードショートカット
`1`〜`6` キーで架電結果（不在/留守電/折り返し/NG/興味あり/商談決定）を即記録。パネル内ボタンに「キーN」表示。`Escape` でパネルを閉じる。

### O5: スクリプトコピーボタン
AIスクリプト表示エリアにコピーボタン（`navigator.clipboard.writeText`）を追加。

### O6: 週次ミニバーチャート
ヘッダー右の `BarChart2` アイコンをクリックするとトグル表示。`/stats?days=7` のレスポンスの `daily` 配列を Recharts `BarChart` で描画。

---

## Phase 3: E1〜E8 拡張

### E1: 折り返し予約
- `CallLog.callback_at` カラムに日時を保存。結果「折り返し」選択時に `datetime-local` ピッカーを表示。
- 専用タブ「折り返し」: `GET /callbacks` で取得した一覧を表示。

### E2: 架電タイマー
発信ボタン（tel:/ Zoom）クリックで `setInterval` 計測開始。結果記録時に通話秒数を `call_duration` として API 送信。

### E3: チーム統計モーダル
ヘッダー右の `Users` アイコン（admin/system_admin のみ表示）。`GET /team-stats` でメンバー別架電数・接続率・アポ率ランキングを取得・表示。

### E4: スクリプトテンプレート
パネル内「スクリプトテンプレート」コラプシブルセクション（BookOpen アイコン）。  
- `GET /script-templates` でロード → org 別テキストを `AppSetting` に保存
- `POST /script-templates` で保存
- AI生成時にテンプレート内容をヒントとして連携

### E5: NG除外トグル
フィルターバーの「NG除外」チェックボックスで `?exclude_ng=true` を切り替え。NG企業（最終結果が「NG」）をリストから除外。

### E6: CSVエクスポート
フィルターバーの `Download` アイコンボタン。`GET /export.csv?days=30` で直近30日の架電ログを CSV ダウンロード（`StreamingResponse`）。

### E7: Slack 日次レポート
`scheduler.py` の 17:00 ジョブ。当日の架電数・接続率・アポ率・上位架電者を Slack Webhook 送信。設定キー: `tele_apo_daily_report_enabled=true`。

### E8: ベストタイム分析タブ
「ベストタイム」タブ。`GET /insights?days=30` で時間帯別・曜日別の接続率を集計。Recharts `BarChart` で視覚化。

---

## フロントエンド (`frontend/src/pages/TeleApo.tsx`)

- サイドバー: `App.tsx` に Phone アイコン付き「テレアポ」メニュー
- ルート: `/tele-apo`
- `frontend/src/api/index.ts` の `teleApo` オブジェクトに全メソッド追加
  - `listCompanies`, `createLog`, `listLogs`, `deleteLog`, `getStats`, `getCallbacks`
  - `getTeamStats`, `getInsights`, `exportCsv`, `generateScript`
  - `getScriptTemplate`, `saveScriptTemplate`

### UIレイアウト
- **ヘッダー**: 本日統計バー（本日架電/接続率/アポ獲得/アポ率）+ アイコン群（Bell/Users/BarChart2/RefreshCw）
- **タブバー**: 架電リスト | 折り返し (N) | ベストタイム
- **フィルターバー**: 検索・ランク・ステータス・ソート・プロジェクト・NG除外・CSV
- **企業リスト**: ランクバッジ・未架電バッジ・最終架電結果
- **架電パネル**: 400px 右スライドオーバー
  - ヘッダー: ◀ ランク 会社名 X/N ▶ ×
  - 発信: tel:/Zoom ボタン + タイマー
  - コラプシブル: スクリプトテンプレート / AIスクリプト / 折り返し予約
  - 結果記録: 3×2 グリッド（各ボタンにキーN 表示）
  - 架電履歴
  - ボトムバー: 前の企業 ← | X/N | 次の企業 →

---

## デプロイ・テスト注意事項

- フロントエンドは FastAPI が `frontend/dist` を静的配信するため、**変更後は必ず `npx vite build --config frontend/vite.config.ts` を実行してリビルドすること**。ビルドなしではTSX変更が反映されない。
- E2Eテスト（Playwright）でタブ要素が取得できない場合の原因として「旧ビルドの配信」が多い。まず再ビルドを試みること。
- テストユーザー: `admin@test.com` / `Test1234!`（ログイン失敗5回でロック → DB直接リセット必要）
