---
name: ECサイトオーナー向け機能強化
description: LeadHive のECサイトオーナー向けリスト収集・スコアリング・キーワード機能の実装記録。
---

## 実装概要

ECサイトオーナー（BASEやShopify等のECプラットフォーム利用者）を営業ターゲットとして特定・収集・スコアリングする機能を強化した。

## 追加プラットフォーム検出 (`server/services/scraper.py`)

以下の7プラットフォームを追加検出対応：
- **Canaly** — ECモール管理SaaS
- **CrossMall** — 多チャネルEC管理
- **Smaregi** — クラウドPOS・EC
- **楽楽EC** — 楽楽シリーズEC管理
- **Hamee** — ネクストエンジン等
- **TikTokショップ** — TikTok Shop
- **Shopify Hydrogen** — Shopify ヘッドレスコマース

## スコアリング強化 (`server/services/scorer.py`)

| フラグ | 加点 | 説明 |
|-------|------|------|
| `instagram_shop` | +8 | Instagram ショッピング機能検出 |
| `tiktok_shop` | +8 | TikTok Shop 検出 |

## キーワードテンプレート追加 (`server/routes/keywords.py`)

ECサイトオーナー向けに3テンプレートを追加：
- ECプラットフォーム別（Shopify/BASE/STORES）
- EC規模別（小規模・中規模・大規模）
- EC業種別（アパレル・食品・コスメ等）

## EC専用サービスモジュール (`server/services/ec_collector.py`)

EC収集に特化したユーティリティ関数群：
- `generate_ec_platform_queries()` — プラットフォーム別検索クエリ生成
- `filter_by_ec_score()` / `filter_ec_only()` — ECスコアでフィルタリング
- `filter_by_platform()` — 特定プラットフォームで絞り込み
- `is_social_commerce()` — SNSコマース判定（TikTok/Instagram）
- `is_headless_shopify()` — Shopify Hydrogen（ヘッドレス）判定
- `get_ec_priority_label()` — ECスコアに基づく優先度ラベル生成
- `build_ec_search_operators()` — Google検索オペレータ構築
- `select_ec_keyword_set()` — カテゴリ別キーワードセット選択

## フロントエンド

`frontend/src/pages/ECDiscovery.tsx` — ECサイト発見専用ページ（App.tsx に `/ec-discovery` ルートとして追加済み）

## 未実装（今後の課題）

Session Planに記載の以下は未着手：
- T004: ECアプローチメッセージテンプレートプリセット (`/api/templates/ec-presets`)
- T005: ECプラットフォームフィルターUI強化（Companies.tsx）

**Why:** ECサイトオーナーは LeadHive の主要ターゲット顧客セグメント。プラットフォーム別に検出・スコアリングすることで、アプローチ優先度を自動判定できる。
