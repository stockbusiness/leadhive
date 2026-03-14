# Hubsrev API & Webhook 完全ドキュメント

**バージョン**: 1.0  
**最終更新**: 2026年3月14日  
**提供**: COOLWORKS株式会社

---

## 目次

1. [概要](#概要)
2. [認証](#認証)
3. [共通仕様](#共通仕様)
4. [受信Webhook API（外部 → Hubsrev）](#受信webhook-api外部--hubsrev)
5. [送信Webhook（Hubsrev → 外部）](#送信webhubsrev--外部)
6. [認証 API](#認証-api)
7. [ダッシュボード API](#ダッシュボード-api)
8. [統合受信ボックス API](#統合受信ボックス-api)
9. [サポートチケット API](#サポートチケット-api)
10. [CSAT（顧客満足度）API](#csat顧客満足度api)
11. [ナレッジベース API](#ナレッジベース-api)
12. [顧客管理 API](#顧客管理-api)
13. [管理者設定 API](#管理者設定-api)
14. [プラットフォーム管理 API](#プラットフォーム管理-api)
15. [公開 API](#公開-api)
16. [API Key 管理](#api-key-管理)
17. [送信Webhook管理 API](#送信webhook管理-api)
18. [添付ファイル API](#添付ファイル-api)
19. [エクスポート API](#エクスポート-api)
20. [通知 API](#通知-api)
21. [監査ログ API](#監査ログ-api)
22. [プラン別機能制限](#プラン別機能制限)
23. [エラーハンドリング](#エラーハンドリング)
24. [注意事項・トラブルシューティング](#注意事項トラブルシューティング)

---

## 概要

Hubsrevは、日本語対応の統合サポート管理B2B SaaSプラットフォームです。本ドキュメントでは、Hubsrevが提供する全APIエンドポイントと、外部システムとのWebhook連携について解説します。

**ベースURL**:
```
https://hubsrev.com
```

---

## 認証

Hubsrevでは2種類の認証方式をサポートしています。

### 1. セッション認証（管理画面API用）

管理画面から使用するAPIは、ログインセッション（Cookie）による認証が必要です。

```
POST /api/auth/login
Content-Type: application/json

{
  "username": "your-username",
  "password": "your-password"
}
```

ログイン成功後、レスポンスの `Set-Cookie` ヘッダーに含まれる `connect.sid` Cookieを以降のリクエストに付与してください。

### 2. API Key認証（外部連携API用）

外部システムからのWebhook受信など、プログラムによるアクセスにはAPI Keyを使用します。

API Keyは以下のいずれかの方法でリクエストヘッダーに含めてください。

```
Authorization: Bearer YOUR_API_KEY
```

または

```
X-API-Key: YOUR_API_KEY
```

API Keyは管理画面の「API Key管理」から発行できます。各API Keyはテナントおよびプロダクトに紐づきます。

---

## 共通仕様

### リクエスト形式

- Content-Type: `application/json`
- 文字エンコーディング: UTF-8

### レスポンス形式

すべてのレスポンスはJSON形式です。

**成功時**:
```json
{
  "id": 1,
  "name": "サンプル",
  ...
}
```

**エラー時**:
```json
{
  "error": "エラーメッセージ"
}
```

### HTTPステータスコード

| コード | 説明 |
|--------|------|
| 200 | 成功 |
| 201 | 作成成功 |
| 400 | リクエスト不正（バリデーションエラー） |
| 401 | 認証エラー（未ログイン / API Key不正） |
| 403 | 権限不足（プラン制限を含む） |
| 404 | リソースが見つからない |
| 500 | サーバー内部エラー |

---

## 受信Webhook API（外部 → Hubsrev）

外部システムからHubsrevの統合受信ボックスにデータを送信するためのAPIです。

### POST /api/webhook/inbox

外部のお問い合わせフォーム・メールシステム・チケットシステムなどからHubsrevにデータを投入します。

**認証**: API Key（Bearer またはX-API-Key ヘッダー）

**リクエストボディ**:

```json
{
  "senderName": "山田太郎",
  "senderEmail": "yamada@example.com",
  "senderCompany": "株式会社サンプル",
  "subject": "製品に関するお問い合わせ",
  "bodyText": "貴社製品について質問があります。...",
  "bodyHtml": "<p>貴社製品について質問があります。...</p>",
  "sourceSystem": "ContactForm",
  "sourceType": "form"
}
```

| フィールド | 型 | 必須 | 説明 |
|------------|-----|------|------|
| senderName | string | ○ | 送信者名 |
| senderEmail | string | ○ | 送信者メールアドレス（有効な形式） |
| senderCompany | string | - | 送信者の会社名 |
| subject | string | ○ | 件名 |
| bodyText | string | ○ | 本文（テキスト形式） |
| bodyHtml | string | - | 本文（HTML形式） |
| sourceSystem | string | - | 送信元システム名（デフォルト: "Webhook"） |
| sourceType | string | - | 種別: `form`, `email`, `ticket_reply` のいずれか |

**レスポンス** (201):
```json
{
  "id": 42,
  "inboxNo": "INB-0042"
}
```

**エラー例** (401):
```json
{
  "error": "API Keyが必要です"
}
```

```json
{
  "error": "無効なAPI Keyです"
}
```

**エラー例** (403 — プラン制限超過):
```json
{
  "error": "受信ボックスアイテム数が上限に達しています"
}
```

### cURL リクエスト例

```bash
curl -X POST https://hubsrev.com/api/webhook/inbox \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "senderName": "山田太郎",
    "senderEmail": "yamada@example.com",
    "senderCompany": "株式会社サンプル",
    "subject": "製品に関するお問い合わせ",
    "bodyText": "貴社製品について質問があります。",
    "sourceType": "form"
  }'
```

---

## 送信Webhook（Hubsrev → 外部）

Hubsrevで特定のイベントが発生した際に、外部システムのURLへ自動的にHTTP POSTリクエストを送信する機能です。

### 対応イベント

| イベント名 | 説明 |
|------------|------|
| `ticket.created` | チケットが新規作成されたとき |
| `ticket.replied` | チケットに返信があったとき |
| `ticket.status_changed` | チケットのステータスが変更されたとき |
| `ticket.resolved` | チケットが解決されたとき |
| `inbox.item_created` | 受信ボックスに新規アイテムが追加されたとき |

### ペイロード形式

送信されるWebhookのペイロードは以下の形式です。

```json
{
  "event": "ticket.created",
  "timestamp": "2026-03-14T10:30:00.000Z",
  "data": {
    "ticketId": 123,
    "ticketNo": "TKT-0123",
    "subject": "製品の不具合について",
    "customerName": "山田太郎"
  }
}
```

#### イベント別ペイロード詳細

**ticket.created**:
```json
{
  "event": "ticket.created",
  "timestamp": "2026-03-14T10:30:00.000Z",
  "data": {
    "ticketId": 123,
    "ticketNo": "TKT-0123",
    "subject": "製品の不具合について",
    "customerName": "山田太郎"
  }
}
```

**ticket.replied**:
```json
{
  "event": "ticket.replied",
  "timestamp": "2026-03-14T10:30:00.000Z",
  "data": {
    "ticketId": 123,
    "ticketNo": "TKT-0123",
    "status": "pending"
  }
}
```

**test（テスト送信）**:
```json
{
  "event": "test",
  "timestamp": "2026-03-14T10:30:00.000Z",
  "data": {
    "message": "Hubsrev Webhook テスト"
  }
}
```

### 署名検証

Hubsrevは各Webhook送信時に署名ヘッダーを付与します。受信側でペイロードの改ざんを検証できます。

**ヘッダー**: `X-Hubsrev-Signature`  
**形式**: `sha256=<HMAC-SHA256ハッシュ>`

署名はWebhook作成時に自動生成される `signingSecret` を鍵として、リクエストボディ全体のHMAC-SHA256ハッシュを計算したものです。

#### 検証コード例（Node.js）

```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, signingSecret) {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', signingSecret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

// Express.js での使用例
app.post('/webhook/hubsrev', (req, res) => {
  const signature = req.headers['x-hubsrev-signature'];
  const rawBody = JSON.stringify(req.body); // ※rawBodyの取得方法はフレームワークにより異なります
  
  if (!verifyWebhookSignature(rawBody, signature, YOUR_SIGNING_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  const { event, data } = req.body;
  
  switch (event) {
    case 'ticket.created':
      console.log(`新規チケット: ${data.ticketNo}`);
      break;
    case 'ticket.replied':
      console.log(`チケット返信: ${data.ticketNo}`);
      break;
    case 'test':
      console.log('テスト送信を受信しました');
      break;
  }
  
  res.status(200).json({ received: true });
});
```

#### 検証コード例（Python）

```python
import hmac
import hashlib

def verify_webhook_signature(payload: bytes, signature: str, signing_secret: str) -> bool:
    expected = 'sha256=' + hmac.new(
        signing_secret.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected)
```

#### 検証コード例（PHP）

```php
function verifyWebhookSignature($payload, $signature, $signingSecret) {
    $expected = 'sha256=' . hash_hmac('sha256', $payload, $signingSecret);
    return hash_equals($expected, $signature);
}
```

### HTTPヘッダー

送信Webhookリクエストには以下のヘッダーが含まれます。

| ヘッダー | 値 |
|----------|-----|
| Content-Type | `application/json` |
| User-Agent | `Hubsrev-Webhook/1.0` |
| X-Hubsrev-Signature | `sha256=<署名>` |

### タイムアウト

Webhook送信のタイムアウトは **10秒** です。10秒以内にレスポンスを返す必要があります。

### リトライ

現在、Webhook送信のリトライ機能は実装されていません。送信失敗時は管理画面の「テスト送信」機能で個別に再送信してください。

---

## 認証 API

### POST /api/auth/login

ユーザーログイン。

**リクエスト**:
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**レスポンス** (200):
```json
{
  "id": 1,
  "username": "admin",
  "email": "admin@example.com",
  "displayName": "管理者",
  "role": "admin",
  "tenantId": 1
}
```

**注意**: ログインに5回連続で失敗するとアカウントが **15分間ロック** されます。

### POST /api/auth/logout

ログアウト。セッションを破棄します。

### GET /api/auth/me

現在ログイン中のユーザー情報を取得。

**レスポンス** (200):
```json
{
  "id": 1,
  "username": "admin",
  "email": "admin@example.com",
  "displayName": "管理者",
  "role": "admin",
  "tenantId": 1
}
```

### POST /api/auth/register

新規ユーザー登録。

**リクエスト**:
```json
{
  "username": "newuser",
  "password": "securepassword",
  "email": "newuser@example.com",
  "displayName": "新規ユーザー"
}
```

### POST /api/auth/forgot-password

パスワードリセットメールを送信。

**リクエスト**:
```json
{
  "email": "user@example.com"
}
```

### POST /api/auth/reset-password

パスワードをリセット。

**リクエスト**:
```json
{
  "token": "reset-token",
  "password": "new-password"
}
```

### PATCH /api/auth/password

ログイン中のユーザーのパスワードを変更。

**リクエスト**:
```json
{
  "currentPassword": "old-password",
  "newPassword": "new-password"
}
```

### GET /api/auth/verify-email

メールアドレス確認（クエリパラメータ `token` が必要）。

### POST /api/auth/resend-verification

確認メールの再送信。

---

## ダッシュボード API

### GET /api/dashboard/stats

ダッシュボードの統計情報を取得。

**レスポンス** (200):
```json
{
  "totalTickets": 150,
  "openTickets": 23,
  "resolvedTickets": 120,
  "avgResolutionTime": 4.5,
  ...
}
```

### GET /api/dashboard/stats-by-product

プロダクト別の統計情報を取得。

### GET /api/dashboard/notifications

ダッシュボード用の通知を取得。

---

## 統合受信ボックス API

### GET /api/unified-inbox/stats

受信ボックスの統計情報を取得。

### GET /api/unified-inbox/items

受信アイテム一覧を取得。

**クエリパラメータ**:

| パラメータ | 型 | 説明 |
|------------|-----|------|
| page | number | ページ番号 |
| limit | number | 1ページの件数 |
| status | string | ステータスフィルタ |
| productId | number | プロダクトID |

### GET /api/unified-inbox/items/:id

受信アイテムの詳細を取得。

### POST /api/unified-inbox/import/contact-form

お問い合わせフォームからのデータをインポート。

### POST /api/unified-inbox/import/email

メールデータをインポート。

### POST /api/unified-inbox/import/ticket-reply

チケット返信データをインポート。

### POST /api/unified-inbox/items/:id/create-ticket

受信アイテムからチケットを作成。

### POST /api/unified-inbox/items/:id/link-ticket

受信アイテムを既存チケットに紐づけ。

### PATCH /api/unified-inbox/items/:id/classification

受信アイテムの分類を更新。

### POST /api/unified-inbox/items/:id/ai-classify

AIによる自動分類を実行（Scaleプラン以上）。

### GET /api/unified-inbox/items/:id/similar-tickets

類似チケットを検索。

### PATCH /api/unified-inbox/items/bulk

受信アイテムの一括操作。

### GET /api/unified-inbox/export/csv

受信アイテムをCSVエクスポート（Growthプラン以上）。

---

## サポートチケット API

### GET /api/support-hub/stats

チケットの統計情報を取得。

### GET /api/support-hub/tickets

チケット一覧を取得。

**クエリパラメータ**:

| パラメータ | 型 | 説明 |
|------------|-----|------|
| page | number | ページ番号 |
| limit | number | 1ページの件数 |
| status | string | ステータス: `open`, `pending`, `in_progress`, `resolved`, `closed` |
| priority | string | 優先度: `low`, `medium`, `high`, `urgent` |
| productId | number | プロダクトID |
| assignedUserId | number | 担当者ID |

### GET /api/support-hub/tickets/:id

チケットの詳細を取得（メッセージ履歴を含む）。

### PATCH /api/support-hub/tickets/:id/status

チケットのステータス・優先度・担当者を更新。

**リクエスト**:
```json
{
  "status": "in_progress",
  "priority": "high",
  "assignedUserId": 2
}
```

### POST /api/support-hub/tickets/:id/reply

チケットに返信。

**リクエスト**:
```json
{
  "body": "ご連絡ありがとうございます。確認いたします。",
  "isInternal": false
}
```

### POST /api/support-hub/tickets/:id/internal-note

社内メモを追加。

**リクエスト**:
```json
{
  "body": "開発チームに確認中"
}
```

### PATCH /api/support-hub/tickets/bulk

チケットの一括操作。

### GET /api/support-hub/tags

タグ一覧を取得（Growthプラン以上）。

### POST /api/support-hub/tags

タグを作成（Growthプラン以上）。

**リクエスト**:
```json
{
  "name": "バグ",
  "color": "#ff0000"
}
```

### POST /api/support-hub/tickets/:id/tags

チケットにタグを追加。

### DELETE /api/support-hub/tickets/:ticketId/tags/:tagId

チケットからタグを削除。

### GET /api/support-hub/tickets/:id/customer-history

チケットの顧客による過去の問い合わせ履歴を取得。

### GET /api/support-hub/tickets/:id/similar

類似チケットを検索。

### POST /api/support-hub/tickets/:id/ai-reply

AIによる返信文案を生成（Scaleプラン以上）。

### POST /api/support-hub/tickets/:id/ai-priority

AIによる優先度判定（Scaleプラン以上）。

### GET /api/support-hub/export/csv

チケットをCSVエクスポート（Growthプラン以上）。

### 自動割り当てルール

#### GET /api/support-hub/assignment-rules

自動割り当てルール一覧を取得。

#### POST /api/support-hub/assignment-rules

自動割り当てルールを作成。

#### DELETE /api/support-hub/assignment-rules/:id

自動割り当てルールを削除。

---

## CSAT（顧客満足度）API

### POST /api/support-hub/tickets/:id/csat-request

CSAT評価リクエストメールを送信。

### GET /api/csat/:token

CSAT評価フォームの情報を取得（公開）。

### POST /api/csat/:token

CSAT評価を送信（公開）。

**リクエスト**:
```json
{
  "score": 5,
  "comment": "迅速な対応ありがとうございました"
}
```

### GET /api/support-hub/tickets/:id/csat

チケットのCSAT評価を取得。

### GET /api/support-hub/csat-stats

CSAT統計情報を取得。

### GET /api/support-hub/csat-trend

CSATトレンドデータを取得。

---

## ナレッジベース API

※ Growthプラン以上で利用可能

### GET /api/knowledge-base

ナレッジベース記事一覧を取得。

### GET /api/knowledge-base/:id

ナレッジベース記事の詳細を取得。

### POST /api/knowledge-base

ナレッジベース記事を作成。

**リクエスト**:
```json
{
  "title": "よくある質問",
  "content": "## 返品について\n返品は...",
  "category": "FAQ",
  "isPublished": true
}
```

### PUT /api/knowledge-base/:id

ナレッジベース記事を更新。

### DELETE /api/knowledge-base/:id

ナレッジベース記事を削除。

---

## 顧客管理 API

### GET /api/customers

顧客一覧を取得。

### GET /api/customers/:id

顧客の詳細を取得。

### POST /api/customers

顧客を作成。

**リクエスト**:
```json
{
  "name": "山田太郎",
  "email": "yamada@example.com",
  "company": "株式会社サンプル",
  "phone": "03-1234-5678"
}
```

---

## 管理者設定 API

以下のAPIは管理者（admin）ロールが必要です。

### ユーザー管理

| メソッド | エンドポイント | 説明 |
|----------|---------------|------|
| GET | /api/users | ユーザー一覧 |
| POST | /api/users | ユーザー作成 |
| PATCH | /api/users/:id | ユーザー更新 |
| DELETE | /api/users/:id | ユーザー削除 |
| PATCH | /api/users/:id/reset-password | パスワードリセット |

### プロダクト管理

| メソッド | エンドポイント | 説明 |
|----------|---------------|------|
| GET | /api/products | プロダクト一覧 |
| POST | /api/products | プロダクト作成 |
| PATCH | /api/products/:id | プロダクト更新 |

### チャネル管理

| メソッド | エンドポイント | 説明 |
|----------|---------------|------|
| GET | /api/channels | チャネル一覧 |
| POST | /api/channels | チャネル作成 |
| PATCH | /api/channels/:id | チャネル更新 |

### テナント設定

| メソッド | エンドポイント | 説明 |
|----------|---------------|------|
| GET | /api/tenant/settings | テナント設定を取得 |
| PATCH | /api/tenant/settings | テナント設定を更新 |

### SMTP設定

| メソッド | エンドポイント | 説明 |
|----------|---------------|------|
| GET | /api/admin/smtp-settings | SMTP設定を取得 |
| PUT | /api/admin/smtp-settings | SMTP設定を保存 |
| POST | /api/admin/smtp-settings/test | テストメール送信 |
| POST | /api/admin/smtp-settings/verify | SMTP接続確認 |

### Stripe設定

| メソッド | エンドポイント | 説明 |
|----------|---------------|------|
| GET | /api/admin/stripe-settings | Stripe設定を取得 |
| PUT | /api/admin/stripe-settings | Stripe設定を保存 |

### ブランド設定

| メソッド | エンドポイント | 説明 |
|----------|---------------|------|
| GET | /api/settings/brand | ブランド設定を取得 |
| PUT | /api/settings/brand | ブランド設定を保存 |

### 返信テンプレート

| メソッド | エンドポイント | 説明 |
|----------|---------------|------|
| GET | /api/reply-templates | テンプレート一覧 |
| POST | /api/reply-templates | テンプレート作成 |
| PUT | /api/reply-templates/:id | テンプレート更新 |
| PATCH | /api/reply-templates/:id | テンプレート部分更新 |
| DELETE | /api/reply-templates/:id | テンプレート削除 |

### ユーザー招待

| メソッド | エンドポイント | 説明 |
|----------|---------------|------|
| GET | /api/invitations | 招待一覧 |
| POST | /api/invitations | 招待を送信 |
| POST | /api/invitations/accept | 招待を承認 |

### 特定商取引法表示

| メソッド | エンドポイント | 説明 |
|----------|---------------|------|
| GET | /api/admin/commercial-transactions | 特商法情報を取得 |
| PUT | /api/admin/commercial-transactions | 特商法情報を保存 |

### バックアップ

| メソッド | エンドポイント | 説明 |
|----------|---------------|------|
| GET | /api/admin/backup/download | バックアップをダウンロード |
| GET | /api/admin/backup/status | バックアップ状態を取得 |

---

## プラットフォーム管理 API

プラットフォーム管理者専用のAPIです。

### テナント管理

| メソッド | エンドポイント | 説明 |
|----------|---------------|------|
| GET | /api/platform/tenants | テナント一覧 |
| GET | /api/platform/tenants/:id | テナント詳細 |
| POST | /api/platform/tenants | テナント作成 |
| PUT | /api/platform/tenants/:id/status | テナントステータス変更 |
| PUT | /api/platform/tenants/:id/plan | テナントプラン変更 |

### プラン管理

| メソッド | エンドポイント | 説明 |
|----------|---------------|------|
| GET | /api/platform/plans | プラン一覧 |
| POST | /api/platform/plans | プラン作成 |
| PUT | /api/platform/plans/:id | プラン更新 |
| DELETE | /api/platform/plans/:id | プラン削除 |

### Stripe設定（プラットフォーム）

| メソッド | エンドポイント | 説明 |
|----------|---------------|------|
| GET | /api/platform/stripe-settings | Stripe設定を取得 |
| POST | /api/platform/stripe-settings | Stripe設定を保存 |

---

## 公開 API

認証不要で利用できる公開APIです。

### GET /api/public/plans

公開プラン一覧を取得。

### GET /api/public/commercial-transactions

特定商取引法に基づく表示を取得。

### GET /api/public/founder-slots

ファウンダー枠の空き状況を取得。

### POST /api/public/founder-apply

ファウンダー枠への申し込み。

### POST /api/lp/inquiries

LP（ランディングページ）からのお問い合わせを送信。

### GET /api/lp/inquiries

LP問い合わせ一覧を取得（管理者のみ）。

### PATCH /api/lp/inquiries/:id/status

LP問い合わせのステータスを更新（管理者のみ）。

---

## API Key 管理

管理者がAPI Keyの発行・管理を行うAPIです。

### GET /api/api-keys

API Key一覧を取得。

### POST /api/api-keys

API Keyを発行。

**リクエスト**:
```json
{
  "name": "外部フォーム連携",
  "productId": 1
}
```

**レスポンス** (201):
```json
{
  "id": 1,
  "name": "外部フォーム連携",
  "rawKey": "hbr_xxxxxxxxxxxxxxxxxxxx",
  "tenantId": 1,
  "productId": 1,
  "isActive": true,
  "createdAt": "2026-03-14T10:00:00.000Z"
}
```

> **重要**: `rawKey` はこのレスポンスでのみ表示されます。必ずコピーして安全に保管してください。

### DELETE /api/api-keys/:id

API Keyを削除。

### PATCH /api/api-keys/:id/toggle

API Keyの有効/無効を切り替え。

---

## 送信Webhook管理 API

管理画面からWebhookの設定を管理するAPIです（Scaleプラン以上）。

### GET /api/outbound-webhooks

送信Webhook一覧を取得。

**レスポンス** (200):
```json
[
  {
    "id": 1,
    "name": "Slack通知",
    "url": "https://hooks.slack.com/services/xxx",
    "events": "[\"ticket.created\",\"ticket.replied\"]",
    "isActive": true,
    "signingSecret": "***",
    "lastTriggeredAt": "2026-03-14T10:00:00.000Z",
    "createdAt": "2026-03-01T00:00:00.000Z"
  }
]
```

### POST /api/outbound-webhooks

送信Webhookを作成。

**リクエスト**:
```json
{
  "name": "外部CRM連携",
  "url": "https://example.com/webhook/hubsrev",
  "events": ["ticket.created", "ticket.replied"],
  "isActive": true
}
```

**レスポンス** (201):
```json
{
  "id": 2,
  "name": "外部CRM連携",
  "url": "https://example.com/webhook/hubsrev",
  "events": "[\"ticket.created\",\"ticket.replied\"]",
  "isActive": true,
  "signingSecret": "a1b2c3d4e5f6..."
}
```

> **重要**: `signingSecret` は作成時のレスポンスでのみ表示されます。受信側での署名検証に使用するため、必ずコピーして安全に保管してください。

### PUT /api/outbound-webhooks/:id

送信Webhookを更新。

**リクエスト**（変更したいフィールドのみ）:
```json
{
  "name": "更新後の名前",
  "url": "https://new-url.example.com/webhook",
  "events": ["ticket.created"],
  "isActive": false
}
```

### DELETE /api/outbound-webhooks/:id

送信Webhookを削除。

### POST /api/outbound-webhooks/:id/test

テスト送信を実行。

**レスポンス** (200):
```json
{
  "success": true,
  "status": 200
}
```

**失敗時**:
```json
{
  "success": false,
  "status": 0,
  "error": "ENOTFOUND"
}
```

---

## 添付ファイル API

### POST /api/attachments/upload

ファイルをアップロード。（multipart/form-data形式）

### GET /api/attachments/files/:filename

アップロード済みファイルを取得。

### DELETE /api/attachments/files/:filename

アップロード済みファイルを削除。

---

## エクスポート API

CSVエクスポート機能です（Growthプラン以上）。

| メソッド | エンドポイント | 説明 |
|----------|---------------|------|
| GET | /api/export/tickets | チケットCSVエクスポート |
| GET | /api/export/customers | 顧客CSVエクスポート |
| GET | /api/export/inbox | 受信ボックスCSVエクスポート |
| GET | /api/export/audit-logs | 監査ログCSVエクスポート |

---

## 通知 API

### GET /api/notifications

通知一覧を取得。

### PUT /api/notifications/:id/read

通知を既読にする。

### PUT /api/notifications/read-all

すべての通知を既読にする。

### GET /api/notification-preferences

通知設定を取得。

### PUT /api/notification-preferences

通知設定を更新。

---

## 監査ログ API

Scaleプラン以上で利用可能です。

### GET /api/audit-logs

監査ログ一覧を取得。

**クエリパラメータ**:

| パラメータ | 型 | 説明 |
|------------|-----|------|
| page | number | ページ番号 |
| limit | number | 1ページの件数 |
| action | string | アクションでフィルタ |
| userId | number | ユーザーIDでフィルタ |

---

## プラン別機能制限

利用可能な機能はプランにより異なります。

| 機能 | Starter | Growth | Scale | Enterprise |
|------|---------|--------|-------|------------|
| 基本チケット管理 | ○ | ○ | ○ | ○ |
| 統合受信ボックス | ○ | ○ | ○ | ○ |
| 顧客管理 | ○ | ○ | ○ | ○ |
| SLA管理 | - | ○ | ○ | ○ |
| タグ機能 | - | ○ | ○ | ○ |
| CSVエクスポート | - | ○ | ○ | ○ |
| ナレッジベース | - | ○ | ○ | ○ |
| 埋め込みフォーム | - | ○ | ○ | ○ |
| 送信Webhook | - | - | ○ | ○ |
| カスタマーポータル | - | - | ○ | ○ |
| 監査ログ | - | - | ○ | ○ |
| AI機能（自動分類・返信案） | - | - | ○ | ○ |
| ホワイトラベル | - | - | - | ○ |

### プラン別上限

| リソース | Starter | Growth | Scale | Enterprise |
|----------|---------|--------|-------|------------|
| チャネル数 | 3 | 10 | 50 | 999 |

---

## エラーハンドリング

### エラーレスポンスの形式

```json
{
  "error": "エラーメッセージ（日本語）"
}
```

### よくあるエラー

| ステータス | エラー | 原因 |
|-----------|--------|------|
| 400 | "名前は必須です" | 必須フィールドが未入力 |
| 400 | "有効なURLを入力してください" | URL形式が不正 |
| 400 | "イベントを1つ以上選択してください" | Webhook作成時にイベント未選択 |
| 401 | "API Keyが必要です" | API Keyヘッダーが未設定 |
| 401 | "無効なAPI Keyです" | API Keyが無効または期限切れ |
| 401 | "ログインが必要です" | セッションが切れている |
| 403 | "この機能はGrowthプラン以上で利用可能です" | プラン制限 |
| 403 | "この機能はScaleプラン以上で利用可能です" | プラン制限 |
| 404 | "Webhookが見つかりません" | 指定IDのWebhookが存在しない |

---

## 注意事項・トラブルシューティング

### Webhook受信側の設定に関する注意

1. **認証トークンについて**: 受信側（Webhook送信先）のサーバーで認証が必要な場合は、以下のいずれかの方法で対応してください。
   - WebhookのURLにトークンをクエリパラメータとして含める  
     例: `https://example.com/webhook?token=YOUR_TOKEN`
   - 受信側のサーバーでHubsrevからのリクエストをIPアドレスやUser-Agentで許可する
   - 受信側の設定を確認し、Hubsrevからのリクエストを受け入れるよう設定してください

2. **HTTPS必須**: WebhookのURLは `https://` で始まる必要があります。HTTPは使用できません。

3. **タイムアウト**: 受信側は10秒以内にHTTP 2xx レスポンスを返す必要があります。重い処理は非同期で行い、まず即座に200を返すことを推奨します。

4. **署名検証の推奨**: セキュリティのため、受信側では `X-Hubsrev-Signature` ヘッダーを使用した署名検証を実施することを強く推奨します。

### テスト送信の失敗原因

テスト送信が失敗した場合、エラーメッセージに具体的な原因が表示されます。

| エラー | 原因 | 対処法 |
|--------|------|--------|
| `ENOTFOUND` | ホスト名が見つからない | URLのドメインを確認 |
| `ECONNREFUSED` | 接続が拒否された | サーバーが起動しているか確認 |
| `ECONNRESET` | 接続がリセットされた | ファイアウォールやWAFの設定を確認 |
| `ETIMEDOUT` | 接続タイムアウト | ネットワーク接続を確認 |
| `UNABLE_TO_VERIFY_LEAF_SIGNATURE` | SSL証明書が不正 | SSL証明書の有効性を確認 |
| `CERT_HAS_EXPIRED` | SSL証明書が期限切れ | SSL証明書を更新 |
| HTTPステータス 401 | 認証エラー | 受信側の認証設定を確認。URLにトークンを含めるか、受信側でHubsrevを許可 |
| HTTPステータス 403 | アクセス拒否 | 受信側のアクセス制御設定を確認 |
| HTTPステータス 404 | エンドポイントが見つからない | URLのパスを確認 |
| HTTPステータス 500 | サーバーエラー | 受信側のサーバーログを確認 |

### API Key管理のベストプラクティス

1. **キーの保管**: API Keyは作成時のみ表示されます。安全な場所に保管してください。
2. **キーのローテーション**: 定期的にAPI Keyを再発行することを推奨します。
3. **不要なキーの削除**: 使用しなくなったAPI Keyは速やかに削除してください。
4. **プロダクト紐づけ**: API Keyはプロダクトに紐づきます。適切なプロダクトを選択してください。

### レート制限

現在、APIにレート制限は設定されていません。ただし、大量のリクエストを短時間に送信することは避けてください。

---

## お問い合わせ

API・Webhookに関するご不明点は、Hubsrev管理画面内のサポートチャネルまたは以下までお問い合わせください。

**COOLWORKS株式会社**  
サポート: support@hubsrev.com
