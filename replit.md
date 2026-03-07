# LeadHive — 営業先リスト自動化ツール

## Overview
LeadHiveは、BtoB営業先の収集、スコアリング、進捗管理、チーム共有を統合したWebアプリケーションです。Google Custom Search APIやGoogleマップなどを利用して営業先を自動収集し、営業活動の効率化を支援します。将来的にはAIによる企業分析や営業判断支援機能を提供し、「企業データOS」となることを目指しています。

## User Preferences
特に指定はありません。

## System Architecture
LeadHiveは、ReactとFastAPIを組み合わせたモダンなWebアプリケーションです。

- **UI/UX**: React, TypeScript, Tailwind CSS, Rechartsを使用し、Viteでビルド。プロジェクトごとのカスタマイズ、カンバンビュー、ダッシュボードのチャート表示、モバイル対応が特徴です。
- **Backend**: FastAPI (Python) を使用し、ポート5000で動作します。
- **Database**: PostgreSQLを使用し、Replitの内蔵データベースを活用します。
- **Authentication**: JWTと`sha256_crypt`による認証を採用。
- **Multi-tenancy**: 組織ベースのマルチテナンシーをサポート。
- **Scraping & Collection**: BeautifulSoup4とRequestsを用いた最大5並列のWebスクレイピング。Google Custom Search API、ディレクトリサイト、Google検索、Shopifyパートナーディレクトリ、Google Places API、gBizINFO APIからの企業情報収集に対応しています。
- **Data Processing**:
    - **Scoring**: カスタム可能な100点満点スコアリングシステムと手動調整。
    - **Categorization**: 9種類のカテゴリ分類とフラグ検出の自動化、カスタム設定可能。
    - **Duplicate Detection**: ドメイン正規化による重複検出とマージ。
    - **Aggregator Detection**: まとめサイトや比較サイトの自動判定と拒否リスト化。
- **Workflow & Automation**:
    - **Auto-collection**: 設定キーワードに基づきGoogle Custom Search APIで自動収集。
    - **Scheduled Tasks**: 毎日指定時刻の自動収集実行スケジューラ。
    - **Real-time Progress**: SSEによるGoogle API収集進捗のリアルタイム表示。
    - **Slack Notifications**: 収集完了時のSlack通知。
- **Data Management**:
    - **Master Database**: 全プロジェクト横断の企業プール（`company_master`）とインポート機能。
    - **History & Logs**: コレクション履歴、ステータス変更履歴、API使用ログ。
    - **Templates**: メモ・メールテンプレート（変数展開機能付き）。
    - **User Management**: 組織メンバーの招待、管理、ロール設定。
- **Performance**: APIレスポンスにインメモリTTLキャッシュを適用。
- **AI Analysis**: OpenAI GPT-4o-miniで企業URLから事業内容・顧客層・強み・サービス・価格帯を自動生成。企業詳細ページに表示。
- **Outreach Email Generation**: AIサマリーを活用し、トーン選択と追加指示に基づいてOpenAI GPT-4o-miniが件名・本文を生成。
- **Follow-up Notifications**: 期限当日・超過のフォローアップ企業をメール/Slackで通知。
- **Plan Management**: サブスクリプションプランのCRUDと組織への割り当て。メンバー数、プロジェクト数、企業数、月次AI分析回数、マスターDBインポート回数に上限を設定可能。Stripe Payment Integrationによるセルフアップグレードに対応。
- **CSV Export with Plan Limits**: 企業リストのCSVエクスポート機能にプラン別件数制限を適用。
- **Master DB Access Control**: プランに応じたマスターDB検索・インポート機能の利用制限。
- **Admin Features**:
    - **Admin Dashboard**: テナント数、ユーザー数、統計データ、グラフ表示。
    - **System API Settings**: gBizINFO等のシステム全体で共有するAPIキー管理。
    - **Tenant Management**: 全Organizationの一覧表示、プラン変更。
    - **User Management**: 全ユーザーの横断管理、ロール変更、削除。
    - **System Logs**: 管理者操作の監査ログ。
    - **Announcements**: 全体またはテナント個別のお知らせ配信。
    - **Billing**: Stripe PaymentIntentsの一覧表示。
    - **SMTP Settings**: 各種SMTPサービス設定とテスト送信機能。
    - **Feature Flags**: 主要機能（AI分析、CSVエクスポート、マスターDB、gBizINFO、Googleマップ、Slack通知、セルフアップグレード）の有効/無効管理。
- **Keyword Analytics**: 検索条件管理ページに、キーワードごとの獲得数・成功率・重複率・拒否率を可視化する分析タブ。

## External Dependencies
- **Google Custom Search API**: 営業先自動収集。
- **Google Places API**: Googleマップからの企業情報収集、住所・電話・レビュー情報の補完。
- **PostgreSQL**: データベース。
- **Slack Incoming Webhook**: 収集完了通知、フォローアップ通知。
- **SMTPサービス**: ユーザー招待、パスワードリセット、フォローアップ通知メール送信。
- **OpenAI API (GPT-4o-mini)**: AI企業分析、アウトリーチメール生成。
- **gBizINFO API（経済産業省）**: 法人DB収集（約400万社）。
- **Stripe**: 決済処理、サブスクリプション管理。