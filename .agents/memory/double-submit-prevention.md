---
name: フォーム自動送信 二重送信防止パターン
description: sales_ai.py のフォーム自動送信における多層二重送信防止の実装方針と各ガード層の説明
---

# フォーム自動送信 二重送信防止パターン

## 実装済みファイル
- `server/routes/sales_ai.py`

## 4層の多重防御（実装済み）

### 層①: DB アトミッククレーム（_send_one() 冒頭）
```python
claim = _db.execute(
    text("UPDATE sales_messages SET status='processing' WHERE id=:id AND status NOT IN ('sent', 'processing')"),
    {"id": msg_id},
)
_db.commit()
if claim.rowcount == 0:
    return (msg_id, "skip", "already_sent_or_processing")
```
- これが最重要。他スレッド・他リクエストとの競合を DB レベルで排除
- 例外時は `processing → failed` に自動ロールバック（スタック防止）

### 層②: BGジョブ起動時の残留 processing リセット
```python
db.execute(text("UPDATE sales_messages SET status='failed' WHERE id = ANY(:ids) AND status='processing'"), {"ids": all_generated_ids})
db.commit()
```
- 前回クラッシュ/強制終了時の残留ロックを解除してから送信開始

### 層③: スレッドプール投入前フィルタ
```python
msgs = db.query(SalesMessage).filter(
    SalesMessage.id.in_(all_generated_ids),
    SalesMessage.status.notin_(["sent"]),
).all()
```
- 既に送信済みのメッセージはスレッドプールに投入しない

### 層④: BGジョブ重複起動防止（start_bg_job）
```python
running = [j for j in _JOBS.values() if j.get("org_id") == current_user.org_id and j.get("status") == "running"]
if running:
    raise HTTPException(status_code=409, detail=f"送信ジョブが実行中です（job_id: {running[0]['job_id']}）...")
```
- 同一 org で実行中ジョブがあれば新規起動を 409 で拒否

### 層⑤: bulk-send-form API からの競合防止
```python
with _JOBS_LOCK:
    running_jobs = [j for j in _JOBS.values() if j.get("org_id") == current_user.org_id and j.get("status") == "running"]
if running_jobs:
    raise HTTPException(status_code=409, ...)
```
- BG ジョブ実行中は直接 API も 409 でブロック

## ステータス遷移
```
draft/reviewed
    ↓ (層①: atomic UPDATE)
processing
    ↓ (送信成功)          ↓ (送信失敗 or 例外)
  sent                  failed
```

## 注意点
- `_send_one()` は各スレッド独自の `_db = SessionLocal()` を使用（メインの `db` と別接続）
- `_send_one()` 内で直接 `text()` UPDATE でステータスを更新するため、外側の ORM オブジェクト (`msg_obj`) との二重更新が発生するが無害（同値上書き）
- `sent_at` や `co.status` の更新は外側ループが担当（`_send_one()` では行わない）
- `sqlalchemy.text` を `from sqlalchemy import func, case, text` でインポート済み

**Why:** 並列5スレッド + バックグラウンドジョブ + 直接API の3経路が同時に同じメッセージを送信できる構造のため、DBレベルの排他制御が必須。
