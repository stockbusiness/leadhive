# Onbizu 連携ガイド

> SaaS・自社システムを Onbizu に接続するための技術ドキュメント

---

## Onbizu とは

**Onbizu** は、BtoB SaaS 向けの **ユーザー活性化・再稼働支援プラットフォーム** です。

外部システムから送られてくるユーザーの行動ログ（登録・ログイン・ステップ完了など）を受け取り、停滞しているユーザーを自動検知して、メール配信・ウィジェット通知・AI提案によって再稼働を促します。

```
外部SaaS / 自社システム
        │
        │  Webhook / API でイベントを送信
        ▼
  ┌──────────────┐
  │   Onbizu     │  ← ユーザーの動きを一元管理
  │              │
  │  停滞検知     │
  │  AI介入提案   │
  │  メール配信   │
  └──────────────┘
        │
        │  再稼働を促すアクション
        ▼
   エンドユーザー
```

---

## 目的

| 課題 | Onbizuで解決すること |
|---|---|
| 登録後に使われなくなるユーザーが多い | 停滞を自動検知してタイムリーに介入 |
| どのユーザーに連絡すべきかわからない | AI がスコアリング・介入文面を提案 |
| メール配信と行動ログがバラバラ | 1つのプラットフォームで統合管理 |
| SaaS との連携に開発工数がかかる | AI が自動でフィールドマッピングを生成 |

---

## 連携方式の選択

用途に応じて以下の3つから選択してください。

| 方式 | 向いているケース | 難易度 |
|---|---|---|
| **A. 汎用Webhook（AI自動マッピング）** | 既存のSaaS Webhook をそのまま転送したい | ★☆☆ |
| **B. イベント取り込みAPI（直接送信）** | 自社システムから任意のタイミングで送りたい | ★★☆ |
| **C. 汎用Webhook + 手動マッピング定義** | フィールド構造が決まっていて確実に制御したい | ★★☆ |

---

## 方式A ： 汎用Webhook（AI自動マッピング）

既存の Webhook URL をそのまま Onbizu に向けるだけで連携できます。  
初回受信時に Claude AI がフィールドを自動分析し、管理者が承認するだけで以降は自動処理されます。

### エンドポイント

```
POST https://{your-domain}/api/webhooks/generic
```

### 必須ヘッダー

| ヘッダー | 値 | 説明 |
|---|---|---|
| `Content-Type` | `application/json` | 必須 |
| `x-source` | 任意の文字列（例: `shopify`） | 送信元を識別するための識別子 |
| `idempotency-key` | UUID v4 | 重複送信防止（推奨） |

### ボディ

任意の JSON を送ってください。構造・フィールド名は問いません。

```json
{
  "customer": {
    "id": "cust_001",
    "email": "user@example.com",
    "name": "田中 花子"
  },
  "event": "customer/create",
  "created_at": "2026-04-29T10:00:00Z"
}
```

### レスポンス

| ステータス | 意味 |
|---|---|
| `200 / 201` | 承認済みルールで自動処理された |
| `202 draft_created` | AI がドラフトを作成。管理画面で確認・承認してください |
| `202 pending_key` | Claude APIキーが未設定。管理画面「AI設定」で設定が必要 |
| `422 skipped` | ルールはあるがイベントタイプのマッピングが未定義 |

### 動作フロー

```
1. Webhook 受信
      │
      ├─ マッピングルールあり → 自動処理（200/201）
      │
      └─ ルールなし → AI 分析 → ドラフト作成（202）
                           │
                    管理画面で承認
                           │
                  以降は自動処理
```

### Shopify での設定例

Shopify はカスタムヘッダーを付与できないため、**プロキシサーバー経由**で `x-source` ヘッダーを付与します。

```javascript
// Express プロキシの例
app.post("/shopify-webhook", (req, res) => {
  // Shopify の署名検証（省略）

  fetch("https://{your-domain}/api/webhooks/generic", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-source": "shopify",
      "idempotency-key": crypto.randomUUID(),
    },
    body: JSON.stringify(req.body),
  }).then(async (r) => {
    res.status(r.status).json(await r.json());
  });
});
```

---

## 方式B ： イベント取り込みAPI（直接送信）

自社システムから Onbizu 独自フォーマットで直接送信する方法です。  
HMAC-SHA256 署名による認証が必要です。

### 事前準備

管理コンソール → **プロダクト管理** から以下を取得してください：

- `productKey` — イベント送信時に使用するキー
- `webhookSecret` — 署名生成に使用するシークレット

### エンドポイント

```
POST https://{your-domain}/api/events/ingest
```

### 必須ヘッダー

| ヘッダー | 値 |
|---|---|
| `Content-Type` | `application/json` |
| `x-webhook-signature` | `sha256={HMAC-SHA256署名}` |
| `idempotency-key` | UUID v4（推奨） |

### 署名の生成方法

```javascript
import crypto from "crypto";

const body = JSON.stringify(payload);
const signature = crypto
  .createHmac("sha256", webhookSecret)
  .update(body)
  .digest("hex");

// ヘッダーに設定する値
const headerValue = `sha256=${signature}`;
```

### リクエストボディ

```json
{
  "productKey": "main",
  "externalUserId": "user-001",
  "eventType": "user_registered",
  "email": "user@example.com",
  "displayName": "田中 花子",
  "planType": "free"
}
```

### 主なイベントタイプ

| eventType | タイミング | 効果 |
|---|---|---|
| `user_registered` | ユーザー登録時 | オンボーディング開始・ウェルカムメール送信 |
| `user_login` | ログイン時 | 最終活動日の更新・停滞フラグの解除 |
| `step_completed` | 機能を使用したとき | 進捗率の更新 |
| `onboarding_completed` | オンボーディング完了時 | 完了日を記録 |
| `conversion` | 有料転換・成果達成時 | コンバージョン数の更新 |

### Node.js 実装例

```javascript
import crypto from "crypto";

const WEBHOOK_SECRET = "your-webhook-secret";
const API_BASE = "https://{your-domain}/api";

async function sendEvent(event) {
  const body = JSON.stringify(event);
  const signature = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(body)
    .digest("hex");

  const res = await fetch(`${API_BASE}/events/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-webhook-signature": `sha256=${signature}`,
      "idempotency-key": crypto.randomUUID(),
    },
    body,
  });

  return res.json();
}

// 使用例
await sendEvent({
  productKey: "main",
  externalUserId: "user-001",
  eventType: "user_registered",
  email: "user@example.com",
  displayName: "田中 花子",
});
```

### curl での確認

```bash
BODY='{"productKey":"main","externalUserId":"user-001","eventType":"user_registered","email":"user@example.com"}'
SECRET="your-webhook-secret"
SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -hex | awk '{print $2}')

curl -X POST https://{your-domain}/api/events/ingest \
  -H "Content-Type: application/json" \
  -H "x-webhook-signature: sha256=$SIG" \
  -d "$BODY"
```

---

## 方式C ： 手動マッピングルールの定義

AI に頼らず、送られてくる Webhook の構造を事前に定義する方法です。  
方式Aと同じエンドポイント（`/api/webhooks/generic`）を使用しますが、管理画面から先にルールを作成します。

### 設定手順

1. 管理コンソール → **Webhook マッピング** を開く
2. 「ルールを追加」から以下を設定する

| 設定項目 | 説明 | 例 |
|---|---|---|
| 送信元（x-source） | Webhook の送信元識別子 | `my-crm` |
| ユーザーIDのパス | ペイロード内のユーザーIDフィールド | `data.user_id` |
| メールのパス | メールアドレスのフィールド | `data.email` |
| イベントタイプのマッピング | 送信元イベント名 → Onbizu イベント名 | `signup` → `user_registered` |
| プロダクトキー | 対象のプロダクト | `main` |

---

## ウィジェットの埋め込み

オンボーディング進捗ウィジェットをサービス内に埋め込むことができます。

```html
<script
  src="https://{your-domain}/api/widget/embed.js
    ?productKey={productKey}
    &userId={externalUserId}
    &widgetToken={widgetToken}
    &theme=light
    &position=bottom-right"
  async
></script>
```

| パラメータ | 説明 |
|---|---|
| `productKey` | プロダクト管理で発行したキー |
| `userId` | ログイン中ユーザーの外部ID |
| `widgetToken` | サーバーサイドで生成する HMAC トークン（セキュリティ用） |

### widgetToken の生成

```javascript
import crypto from "crypto";

function generateWidgetToken(webhookSecret, productKey, userId) {
  return crypto
    .createHmac("sha256", webhookSecret)
    .update(`widget-access:${productKey}:${userId}`)
    .digest("hex");
}
```

---

## 動作確認チェックリスト

連携後、以下の順で確認してください。

- [ ] イベントを送信して HTTP 200/201/202 が返ることを確認
- [ ] 管理コンソール → **ユーザー管理** にユーザーが表示される
- [ ] 方式A の場合：**Webhook マッピング** にドラフトが作成されている
- [ ] 方式A の場合：ドラフトを承認して再送信し、200/201 が返ることを確認
- [ ] ステップ完了イベントを送信して進捗率が更新される

---

## よくあるエラー

| エラー | 原因 | 対処 |
|---|---|---|
| `401 Unauthorized` | 署名が一致しない | `webhookSecret` と署名対象のボディを確認 |
| `400 productKey is required` | productKey が未指定 | ボディに `productKey` を追加 |
| `422 skipped` | イベントタイプのマッピングが未定義 | Webhook マッピングにルールを追加 |
| `202 pending_key` | Claude APIキー未設定 | 管理画面「AI設定」で設定 |
| `429 Too Many Requests` | レート制限に達した | しばらく待ってから再送信、または Retry-After ヘッダーを参照 |

---

## 連絡先・サポート

ご不明な点は管理コンソール内のチャットサポートまたは担当者までお問い合わせください。
