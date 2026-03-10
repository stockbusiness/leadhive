# CommitRev API連携ガイド

> 外部開発者向け — CommitRev REST APIの認証方法・エンドポイント仕様・Webhook連携について解説します。

---

## 目次

1. [はじめに（開発者向け）](#はじめに開発者向け)
2. [統合フロー概要](#統合フロー概要)
3. [認証（HMAC署名）](#認証hmac署名)
4. [エンドポイント一覧](#エンドポイント一覧)
5. [イベントタイプ](#イベントタイプ)
6. [フィールドマッピング（アダプター層）](#フィールドマッピングアダプター層)
7. [エラーコード](#エラーコード)
8. [SDKなしでの統合手順](#sdkなしでの統合手順)
9. [ベストプラクティス](#ベストプラクティス)
10. [よくあるエラーと対処法](#よくあるエラーと対処法)

---

## はじめに（開発者向け）

### このガイドの対象者

CommitRevのAPIを使用して自社システムとの連携を実装する開発者向けのガイドです。
パートナー紹介トラッキング、コンバージョンイベントの送信、Webhook連携の実装方法を解説します。

### 事前に必要なもの

- CommitRevへのテナント登録が完了していること
- テナント管理画面からHMACシークレットキーを取得していること
- プロダクトコードが設定済みであること

---

## 統合フロー概要

CommitRev APIとの統合は、以下の5ステップで完了します。

| ステップ | 内容 | 説明 |
|---------|------|------|
| 1 | HMACキーを取得 | テナント管理画面の「API設定」からHMACシークレットキーをコピーします。 |
| 2 | 署名ロジックを実装 | リクエストボディのJSON文字列に対してHMAC-SHA256署名を生成するコードを実装します。 |
| 3 | テストイベントを送信 | テスト環境で `/v1/events` エンドポイントにイベントを送信し、正常に処理されることを確認します。 |
| 4 | フィールドマッピングを設定 | Webhook経由の連携の場合、管理画面でフィールドマッピングを設定し、外部JSONを標準フォーマットに変換します。 |
| 5 | 本番運用を開始 | テスト完了後、本番環境のエンドポイントに切り替えて運用を開始します。 |

---

## 認証（HMAC署名）

### 認証パラメータ

| パラメータ | 値 |
|-----------|------|
| ヘッダー | `x-signature` — リクエストボディのHMAC-SHA256 hex digest |
| ヘッダー | `x-tenant-id` — テナントID（数値） |
| アルゴリズム | SHA-256 |
| 署名方式 | テナントのhmacSecretを使用してリクエストボディのJSONをHMAC署名 |
| 検証方式 | サーバー側でタイミングセーフ比較を使用 |

署名ヘッダー（`x-signature`）が付与されたリクエストに対してのみ検証が実行されます。
署名なしのリクエストも受け付けますが、**本番環境では必ずHMAC署名を付与してください。**

### 署名検証フロー

1. クライアントがリクエストボディのJSON文字列を生成
2. HMACシークレットキーを使用してSHA-256ダイジェストを計算
3. hex形式のダイジェストを `x-signature` ヘッダーに設定
4. サーバーが同じ秘密鍵で署名を再計算し、タイミングセーフ比較で検証
5. 不一致の場合は `401 Unauthorized` を返却

### コード例: Node.js

```javascript
const crypto = require('crypto');
const body = JSON.stringify(payload);
const signature = crypto.createHmac('sha256', SECRET_KEY).update(body).digest('hex');
// Set headers: { 'x-signature': signature, 'x-tenant-id': tenantId, 'Content-Type': 'application/json' }
```

### コード例: Python

```python
import hmac, hashlib, json
body = json.dumps(payload)
signature = hmac.new(SECRET_KEY.encode(), body.encode(), hashlib.sha256).hexdigest()
```

### コード例: curl

```bash
SIGNATURE=$(echo -n '{"event_type":"..."}' | openssl dgst -sha256 -hmac "$SECRET_KEY" | awk '{print $2}')
curl -X POST https://your-domain.com/v1/events \
  -H "Content-Type: application/json" \
  -H "x-signature: $SIGNATURE" \
  -H "x-tenant-id: $TENANT_ID" \
  -d '{"event_type":"..."}'
```

---

## エンドポイント一覧

### POST `/v1/track` — クリックトラッキング

パートナー紹介のクリックを記録します。

**リクエストボディ:**

| フィールド | 必須 | 説明 |
|-----------|------|------|
| `token` | **必須** | パートナー紹介トークン |
| `tenant_id` | 任意 | テナントID |
| `landing_url` | 任意 | ランディングURL |

**成功レスポンス（201）:**

```json
{
  "click_id": 123,
  "message": "クリックを記録しました",
  "hmac_verified": true
}
```

**エラーレスポンス（400）:**

```json
{
  "message": "tokenは必須です"
}
```

---

### POST `/v1/events` — イベント記録

コンバージョンイベント（登録、支払いなど）を記録します。

**リクエストボディ:**

| フィールド | 必須 | 説明 |
|-----------|------|------|
| `event_type` | **必須** | イベント種別（下記のイベントタイプ一覧を参照） |
| `idempotency_key` | **必須** | 冪等キー（重複防止用。注文IDやトランザクションIDなど一意な値） |
| `event_time` | **必須** | イベント発生日時（ISO 8601形式） |
| `product_code` | **必須** | プロダクトコード |
| `tenant_id` | 任意 | テナントID |
| `payload` | 任意 | 追加イベントデータ（JSON） |

**冪等性:** 同じ `idempotency_key` で再送信した場合、既存のイベントが返されます（重複登録なし）。

**成功レスポンス（201 新規作成 / 200 重複）:**

新規イベントは `201`、同じ idempotency_key の再送信は `200` で既存イベントを返却します。

```json
{
  "id": 456,
  "event_type": "lead_created",
  "idempotency_key": "usr_abc123",
  "product_code": "premium",
  "status": "processed",
  "created_at": "2025-01-01T10:00:00Z"
}
```

**エラーレスポンス（400）:**

```json
{
  "message": "必須フィールドが不足しています"
}
```

---

### POST `/v1/webhooks/:systemCode` — 汎用Webhook

外部システムからのイベントを受信し、フィールドマッピングにより自動変換して処理します。

**パスパラメータ:**

| パラメータ | 必須 | 説明 |
|-----------|------|------|
| `systemCode` | **必須** | Webhook設定で定義したシステムコード |

**ヘッダー:**

| ヘッダー | 必須 | 説明 |
|---------|------|------|
| `x-signature` | **必須** | HMAC署名 |
| `x-tenant-id` | **必須** | テナントID |

**ボディ:**

任意のJSON形式。`event_type` はボディ内のフィールドまたは `x-event-type` ヘッダーで指定できます。
フィールドマッピング設定に基づいてCommitRevの標準フォーマットに自動変換されます。

**成功レスポンス（201 新規作成 / 200 重複）:**

フィールドマッピングで変換後、イベントとして処理されます。重複 idempotency_key は 200 を返します。

```json
{
  "id": 789,
  "event_type": "purchase_completed",
  "idempotency_key": "ORD-001",
  "product_code": "premium",
  "status": "processed",
  "created_at": "2025-01-15T10:30:00Z"
}
```

**エラーレスポンス（400）:**

```json
{
  "message": "必須フィールドが不足しています"
}
```

---

## イベントタイプ

| イベントタイプ | 説明 |
|--------------|------|
| `click_recorded` | クリック記録 |
| `lead_created` | リード獲得（無料登録など） |
| `contract_signed` | 契約成立 |
| `payment_received` | 支払い受領 |
| `purchase_completed` | 購入完了（EC取引など） |
| `refund_issued` | 返金処理 |
| `ai_review_first_use` | AI機能初回利用（アクティベーション） |
| `plan_conversion` | プラン変更（アップグレード/ダウングレード） |
| `monthly_renewal` | 月次継続課金（定期更新） |

---

## フィールドマッピング（アダプター層）

Webhookで受信した外部システムのJSONペイロードを、CommitRevの標準フォーマットに変換するアダプター機能です。
JSONPathベースのフィールドマッピングにより、任意のデータ構造をサポートします。

| 項目 | 内容 |
|------|------|
| 方式 | JSONPathベース（例: `$.user.email` → `email`） |
| 設定単位 | Webhook設定 + ソースイベントタイプごと |

### 変換後の必須フィールド

| フィールド | 必須 | 備考 |
|-----------|------|------|
| `product_code` | **必須** | |
| `idempotency_key` | **必須** | |
| `event_time` | 任意 | 未指定時は現在時刻 |

### マッピング例

**外部システムからのペイロード:**

```json
{
  "user": {
    "id": "usr_abc123",
    "email": "test@example.com"
  },
  "plan": "premium",
  "signed_at": "2025-06-01T10:00:00Z"
}
```

**フィールドマッピング設定:**

```json
{
  "idempotency_key": "$.user.id",
  "product_code": "$.plan",
  "event_time": "$.signed_at",
  "email": "$.user.email"
}
```

**変換後のペイロード:**

```json
{
  "idempotency_key": "usr_abc123",
  "product_code": "premium",
  "event_time": "2025-06-01T10:00:00Z",
  "email": "test@example.com"
}
```

---

## エラーコード

| ステータス | 説明 |
|-----------|------|
| `201` | 新規作成成功 |
| `200` | 重複 idempotency_key の場合、既存イベントを返却（新規作成なし） |
| `400` | 必須フィールド不足 / マッピングエラー |
| `401` | 署名が無効 / テナントが見つからない |
| `404` | Webhook設定が見つからない / エンドポイントが存在しない |
| `500` | サーバー内部エラー |

エラーレスポンスの形式:

```json
{
  "message": "エラーの説明"
}
```

---

## SDKなしでの統合手順

CommitRevはSDKを必要としません。標準的なHTTPクライアントで統合できます。以下のチェックリストに沿って実装してください。

- [ ] HMACシークレットキーを環境変数に設定する（ソースコードにハードコーディングしない）
- [ ] リクエストボディを `JSON.stringify()` で文字列化し、HMAC-SHA256署名を生成する
- [ ] `x-signature` と `x-tenant-id` ヘッダーを含めてPOSTリクエストを送信する
- [ ] `idempotency_key` にユニークな値を設定し、リトライ時の重複を防止する
- [ ] レスポンスのステータスコードを確認し、エラー時はリトライロジックを実装する
- [ ] Webhookログ画面で送信結果を確認し、フィールドマッピングの正確性を検証する
- [ ] テスト送信機能で動作確認が完了してから本番環境に切り替える

---

## ベストプラクティス

- イベント送信時には必ず冪等キー（`idempotency_key`）を設定してください
- 本番環境ではHTTPSを使用してください
- 秘密鍵は安全な場所に保管し、ソースコードにハードコーディングしないでください
- Webhookログを定期的に確認し、エラーを早期に検出してください
- 本番運用開始前に、Webhook設定画面のテスト送信機能で動作確認を行ってください

---

## よくあるエラーと対処法

### 1. `401 Unauthorized` — Invalid signature

- **原因:** HMAC署名の計算が正しくない、またはシークレットキーが間違っている
- **対処法:** リクエストボディの文字列化方法を確認してください。`JSON.stringify()` の出力を直接署名に使用し、送信するボディと同一であることを確認します。シークレットキーが正しいことも再確認してください。

### 2. `400 Bad Request` — Missing required fields

- **原因:** `event_type`, `idempotency_key`, `product_code` などの必須フィールドが不足している
- **対処法:** リクエストボディに必須フィールドがすべて含まれているか確認してください。フィールドマッピング経由の場合は、マッピング設定で必須フィールドが正しく変換されているかを確認します。

### 3. `404 Not Found` — Webhook config not found

- **原因:** 指定された `systemCode` に対応するWebhook設定が存在しない
- **対処法:** テナント管理画面のWebhook設定でシステムコードを確認してください。大文字小文字の区別に注意してください。

### 4. イベントが重複登録される

- **原因:** `idempotency_key` が毎回異なる値で送信されている
- **対処法:** 同一のイベントには同一の `idempotency_key` を使用してください。例えば、注文IDやトランザクションIDなど、ビジネス上一意な値を使用します。

### 5. フィールドマッピングで値がnullになる

- **原因:** JSONPathの指定が実際のペイロード構造と一致していない
- **対処法:** Webhookログ画面で受信した生のペイロードを確認し、JSONPathが正しいことを検証してください。ネストされたオブジェクトの場合は `$.parent.child` の形式で指定します。
