---
name: SalesAI bulk-send implementation pattern
description: How bulk send and skip-existing work in the SalesAI module
---

## Rule
The bulk-send endpoint (`POST /messages/bulk-send`) must be defined BEFORE the `DELETE /messages/{message_id}` route in FastAPI, but no conflict exists with `POST /messages/{id}/send` (different segment depth).

**Why:** FastAPI matches fixed-segment paths before dynamic ones within the same depth. `/messages/bulk-send` (2 segments) and `/messages/{id}/send` (3 segments) are different depths so order doesn't matter, but explicit documentation prevents future confusion.

## How to apply
- `BulkSendRequest` already has: `send_method`, `profile_id`, `message_ids`
- Bulk send queries `SalesMessage.status == "reviewed"` joined to `Company` via `project_id.in_(owned_pids)`
- Auto-updates company status to "フォーム送信済" if in `{"未確認","対象候補","アプローチ前"}`
- `skip_existing: bool = False` on `GenerateBatchRequest` — frontend passes via `generateBatch(ids, tpl, projId, customId, skipExisting)`
- Company statuses: "未確認","対象候補","除外","アプローチ前","フォーム送信済","返信あり","面談化","代理店化","失注" — "アプローチ済" does NOT exist
