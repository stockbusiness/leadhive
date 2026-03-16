# CommitRev API連携ガイド

> 外部開発者向け — CommitRev REST APIの認証方法・エンドポイント仕様・Webhook連携について解説します。

---

## 目次

1. [はじめに（開発者向け）](#はじめに開発者向け)
2. [統合フロー概要](#統合フロー概要)
3. [認証（HMAC署名）](#認証hmac署名)
4. [スコープ付きAPIキー（Bearer認証）](#スコープ付きapiキーbearer認証)
5. [エンドポイント一覧](#エンドポイント一覧)
6. [イベントタイプ](#イベントタイプ)
7. [フィールドマッピング（アダプター層）](#フィールドマッピングアダプター層)
8. [エラーコード](#エラーコード)
9. [SDKなしでの統合手順](#sdkなしでの統合手順)
10. [ベストプラクティス](#ベストプラクティス)
11. [よくあるエラーと対処法](#よくあるエラーと対処法)

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

## スコープ付きAPIキー（Bearer認証）

HMAC署名に加え、**スコープ付きAPIキー**による認証もサポートしています。権限を絞り込んだキーを用途ごとに発行できるため、外部システムへの最小権限付与が可能です。

### キーの発行方法

1. テナントポータルにログイン（管理者権限が必要）
2. サイドバー → **APIキー管理** → **スコープ付きAPIキー** タブ
3. 「新規発行」をクリックし、キー名とスコープを選択
4. 発行直後に表示されるキー文字列（`cr_xxxxxxxxxx...`）を**必ずコピー**する  
   ⚠️ **キーは発行時の1回のみ表示されます。再表示はできません。**

### キーの形式

```
cr_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

- プレフィックス: `cr_`（CommitRevを示す識別子）
- 本体: 64文字の16進数文字列（256ビットランダム値）

### 認証ヘッダー

スコープ付きAPIキーは `X-Api-Key` ヘッダーで送信します。

```http
X-Api-Key: cr_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

HMAC署名（`x-signature` / `x-tenant-id`）との**同時送信は不要**です。`X-Api-Key` が存在する場合はAPIキー認証が優先されます。

### スコープ一覧

| スコープ | 説明 | 対象エンドポイント |
|---------|------|-----------------|
| `events` | イベント送信・クリックトラッキング・Webhook受信 | `POST /v1/track`、`POST /v1/events`、`POST /v1/webhooks/:systemCode` |
| `read` | イベントデータの読み取り | `GET /api/v1/events` |
| `write` | 内部APIへの書き込み | `POST /api/v1/events` |
| `full` | 上記すべての権限（HMAC署名と同等） | すべてのエンドポイント |

> `full` スコープを持つキーは、HMACシークレットキーと同等の権限を持ちます。外部連携では用途に応じた最小スコープを指定することを推奨します。

### コード例: イベント送信（`events` スコープ）

**Node.js:**
```javascript
const response = await fetch('https://your-domain.com/v1/events', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Api-Key': 'cr_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  },
  body: JSON.stringify({
    event_type: 'purchase_completed',
    idempotency_key: 'order_12345',
    event_time: new Date().toISOString(),
    product_code: 'premium',
  }),
});
const data = await response.json();
```

**Python:**
```python
import requests

response = requests.post(
    'https://your-domain.com/v1/events',
    headers={
        'Content-Type': 'application/json',
        'X-Api-Key': 'cr_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    },
    json={
        'event_type': 'purchase_completed',
        'idempotency_key': 'order_12345',
        'event_time': '2025-01-01T10:00:00Z',
        'product_code': 'premium',
    }
)
```

**curl:**
```bash
curl -X POST https://your-domain.com/v1/events \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: cr_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  -d '{
    "event_type": "purchase_completed",
    "idempotency_key": "order_12345",
    "event_time": "2025-01-01T10:00:00Z",
    "product_code": "premium"
  }'
```

### スコープ不足時のエラーレスポンス

指定スコープの権限がない場合、`403 Forbidden` が返ります。

```json
{
  "message": "このキーにはイベント送信権限がありません",
  "required_scope": "events",
  "current_scopes": ["read"]
}
```

### HMAC署名との比較

| 項目 | HMAC署名 | スコープ付きAPIキー |
|------|---------|-----------------|
| 認証ヘッダー | `x-signature` + `x-tenant-id` | `X-Api-Key` |
| 権限制御 | フルアクセス固定 | スコープで細かく制御可能 |
| キー管理 | テナント設定画面（1本のみ） | 複数発行・個別無効化可能 |
| 推奨用途 | サーバー間連携（自社システム） | 外部サービス・サードパーティ連携 |
| 最終利用日時 | 非記録 | 自動記録（管理画面で確認可能） |

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

## 複数商品・アップセルの連携パターン

フロント商品とアップセル商品を1つのプロダクト設定で管理し、イベント種別によって異なる報酬を自動計算するパターンです。追加のプロダクト登録や複数の紹介リンクは不要で、どのSaaSにも適用できます。

### 設計思想

```
紹介リンク（1本） → フロント成約 → アップセル成約 → 継続課金
                       ↓                ↓               ↓
                  contract_signed  plan_conversion  monthly_renewal
                       ↓                ↓               ↓
                  イベント別コミッションルールで自動計算
```

パートナーが発行する紹介リンクは1本のまま、`customer_id` の一致によって同一顧客の追加購入が自動的に同じパートナーへ帰属されます。

### CommitRev側の設定

1. プロダクトを1つ登録（例: `product_code = "my-saas"`）
2. プロダクト管理 → コミッションルール → 「＋ 追加」でイベント別ルールを設定

| イベント種別 | 用途 | 報酬例 |
|------------|------|--------|
| `contract_signed` | フロント商品の成約 | ¥5,000 固定 |
| `plan_conversion` | アップセル商品の成約 | ¥10,000 固定 |
| `monthly_renewal` | 毎月の継続課金 | 月額の 10%（recurringRate） |

### SaaS側の実装

#### フロント商品の成約時

```json
POST /v1/events
{
  "product_code": "my-saas",
  "event_type": "contract_signed",
  "idempotency_key": "order-{注文ID}",
  "event_time": "2026-01-01T10:00:00Z",
  "payload": {
    "customer_id": "user_12345",
    "amount": 9800
  }
}
```

#### アップセル商品の成約時

```json
POST /v1/events
{
  "product_code": "my-saas",
  "event_type": "plan_conversion",
  "idempotency_key": "upsell-{注文ID}",
  "event_time": "2026-01-15T14:00:00Z",
  "payload": {
    "customer_id": "user_12345",
    "amount": 29800
  }
}
```

#### 継続課金（月次更新）時

```json
POST /v1/events
{
  "product_code": "my-saas",
  "event_type": "monthly_renewal",
  "idempotency_key": "renewal-user_12345-2026-02",
  "event_time": "2026-02-01T00:00:00Z",
  "payload": {
    "customer_id": "user_12345",
    "amount": 9800
  }
}
```

### customer_id の一貫性について

`customer_id` はCommitRevがパートナー帰属を判定するための核心的なフィールドです。

```
フロント成約: customer_id = "user_12345" → パートナーAに紐付け
アップセル:   customer_id = "user_12345" → 同じパートナーAへ自動帰属 ✅
月次更新:     customer_id = "user_12345" → 同じパートナーAへ自動帰属 ✅
```

**使用できる値の例:**
- 自社データベースのユーザーID
- メールアドレス（一意であること）
- Stripeの `customer_id`

> ⚠️ `customer_id` が変わると別顧客として扱われ、アップセル・継続報酬が正しく帰属されません。

### idempotency_key の設計

同一イベントの重複送信を防ぐため、`idempotency_key` には必ず一意な値を設定してください。

| ケース | 推奨フォーマット |
|--------|----------------|
| 初回成約 | `contract-{注文ID}` |
| アップセル | `upsell-{注文ID}` |
| 月次更新 | `renewal-{顧客ID}-{YYYY-MM}` |

### Node.js 実装例（全パターン）

```javascript
const API_KEY = 'cr_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
const BASE_URL = 'https://your-commitrev-domain.com';

async function sendEvent(eventType, orderId, customerId, amount) {
  const prefixMap = {
    contract_signed: 'contract',
    plan_conversion: 'upsell',
    monthly_renewal: `renewal-${customerId}-${new Date().toISOString().slice(0, 7)}`,
  };

  const res = await fetch(`${BASE_URL}/v1/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': API_KEY,
    },
    body: JSON.stringify({
      product_code: 'my-saas',
      event_type: eventType,
      idempotency_key: `${prefixMap[eventType]}-${orderId}`,
      event_time: new Date().toISOString(),
      payload: { customer_id: customerId, amount },
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`CommitRev error: ${err.message}`);
  }
  return res.json();
}

// 使用例
await sendEvent('contract_signed', 'ORD-001', 'user_12345', 9800);   // フロント成約
await sendEvent('plan_conversion', 'ORD-002', 'user_12345', 29800);  // アップセル
await sendEvent('monthly_renewal', 'REN-003', 'user_12345', 9800);   // 月次更新
```

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
