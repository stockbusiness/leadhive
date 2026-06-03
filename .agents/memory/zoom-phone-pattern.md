---
name: Zoom Phone統合パターン
description: LeadHive における Zoom Phone クリックtoコール実装パターン。URIスキーム・E.164変換・実装ファイル一覧。
---

## URI スキーム

```
zoomus://phone?action=dial&phoneNumber={E.164形式の番号}
```

Zoom アプリがインストールされている PC/スマートフォンで Zoom Phone が即座に起動して発信する。

## 電話番号変換ヘルパー

```typescript
function toZoomPhoneUrl(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  const e164 = digits.startsWith("0") ? "+81" + digits.slice(1) : "+" + digits;
  return `zoomus://phone?action=dial&phoneNumber=${encodeURIComponent(e164)}`;
}
```

**Why:** 日本の電話番号は `03-xxxx-xxxx` 形式で DB に格納されるが、Zoom Phone は E.164 形式 (`+813xxxxxxxx`) を要求する。先頭 `0` を `+81` に置換する必要がある。

## 実装済みファイル

| ファイル | 実装箇所 | 備考 |
|---------|---------|------|
| `frontend/src/components/companies/CompanyTable.tsx` | line 4-8 (関数定義), line 316 (適用) | 企業一覧の電話番号横に小さい Zoom ボタン |
| `frontend/src/components/companies/CompanyEditModal.tsx` | line 556 (インライン実装) | 企業編集モーダルの「Zoom Phoneで発信」ボタン |
| `frontend/src/pages/TeleApo.tsx` | line 51-54 (関数定義), line 369 (適用) | 架電パネルの Zoom ボタン（Zoom ブランドカラー #2D8CFF）|

## ボタンスタイル

- CompanyTable: `bg-blue-50 text-blue-500` の小さいバッジ風ボタン
- TeleApo: `bg-[#2D8CFF]` の Zoom ブランドカラーボタン、Video アイコン使用

**How to apply:** 新しい画面に Zoom Phone ボタンを追加する場合は、同じ `toZoomPhoneUrl` ヘルパーを定義またはインポートして使う。共通化が必要になったら `frontend/src/utils/phone.ts` に切り出すことを検討。
