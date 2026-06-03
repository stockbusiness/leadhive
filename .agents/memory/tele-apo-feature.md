---
name: テレアポ機能実装
description: LeadHive のテレアポ（電話営業）機能の全実装内容。モデル・API・フロントエンド・Zoom統合を含む。
---

## 実装概要

LeadHive にテレアポ（電話営業）機能を全面実装。架電リスト表示・結果記録・AIスクリプト生成・統計表示・Zoom Phone発信を備える。

## データモデル

`server/models.py` に `CallLog` テーブル（line ~680）を追加：
- `id`, `company_id` (FK), `user_id` (FK), `org_id`
- `result`: 不在 / 留守電 / 折り返し / NG / 興味あり / 商談決定
- `memo`: テキストメモ
- `called_at`: 架電日時

## バックエンド API (`server/routes/tele_apo.py`)

ルーター: `/api/tele-apo` として `server/main.py` line ~576 に登録済み。

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/companies` | 電話番号ありの企業リスト（スコア順）、ランク/ステータス/プロジェクトフィルター |
| POST | `/logs` | 架電結果を記録。「商談決定」時は会社ステータスを「商談中」に自動更新 |
| GET | `/logs` | 架電履歴一覧（company_id フィルター対応）|
| DELETE | `/logs/{log_id}` | 架電ログ削除（自分のログのみ）|
| GET | `/stats` | 本日の統計（架電数・接続率・アポ獲得数・アポ率）|
| POST | `/script` | Claude-3-5-Sonnet で企業向けトークスクリプト生成 |

すべてのエンドポイントは `_owned_projects(current_user, db)` で org_id テナント分離済み。

## フロントエンド (`frontend/src/pages/TeleApo.tsx`)

- サイドバー: 「一括メール送信」直下、`App.tsx` line ~322 に Phone アイコン付き「テレアポ」メニュー追加
- ルート: `App.tsx` line ~542 に `/tele-apo` ルート追加
- `frontend/src/api/index.ts` に `teleApo` メソッド群（listCompanies, createLog, listLogs, deleteLog, getStats, generateScript）追加

### UIレイアウト
- 左ペイン: 架電リスト（検索・フィルター、スコアバッジ・ランク表示）
- 右ペイン: 選択企業の詳細 + 発信ボタン + 架電結果選択 + メモ入力 + 過去ログ + AIスクリプトパネル
- ヘッダー: 本日の統計バー（架電数 / 接続率 / アポ獲得数 / アポ率）

## Zoom Phone 統合

`toZoomPhoneUrl()` ヘルパー関数をページ内に定義し、発信ボタンを「電話で発信（tel:）」と「Zoom」の2択に変更。
→ 詳細は `zoom-phone-pattern.md` を参照。

## 注意事項

- FastAPI: 固定パス (`/companies`, `/logs`, `/stats`, `/script`) はすべて動的パス (`/logs/{log_id}`) より前に定義済み
- `CallLog` テーブルの自動マイグレーションは SQLAlchemy `create_all` で行われる
