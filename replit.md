# LeadHive — 営業先リスト自動化ツール

## Overview
LeadHiveは、BtoB営業先の収集、スコアリング、進捗管理、チーム共有を統合したWebアプリケーションです。Google Custom Search APIやGoogleマップなどを利用して営業先を自動収集し、スコアリング、カテゴリ分類、カンバン管理によって営業活動の効率化を支援します。ビジネスビジョンとしては、営業リストを単なる使い捨てではなく「資産」として蓄積する企業データベースを構築し、将来的にはAIによる企業分析や営業判断支援機能を提供することで、「企業データOS」となることを目指しています。

## User Preferences
特に指定はありません。

## System Architecture
LeadHiveは、ReactとFastAPIを組み合わせたモダンなWebアプリケーションです。
- **UI/UX**: React, TypeScript, Tailwind CSS, Rechartsを使用し、Viteでビルドされた静的ファイルとして提供されます。プロジェクトごとに収集対象業種、カテゴリ、フラグ、スコアリング基準をカスタマイズでき、サイドバーでプロジェクト切り替えが可能です。カンバンビューやダッシュボードのチャート表示（Recharts）により、視覚的に情報を管理します。モバイル対応済み：スマートフォン（viewport < 768px）ではサイドバーがハンバーガーメニューによるスライドドロワーに変わり、企業一覧はカードビューで表示されます。
- **Backend**: FastAPI (Python) を使用し、ポート5000で動作します。
- **Database**: PostgreSQLを使用し、リプリットの内蔵データベースを活用します。
- **Authentication**: JWTと`sha256_crypt`による認証を採用し、AuthorizationヘッダーでBearerトークンを使用します。
- **Multi-tenancy**: 組織ベースのマルチテナンシーをサポートし、各組織は独立したプロジェクト、企業、設定、テンプレートを持ちます。
- **Scraping**: BeautifulSoup4とRequestsを用いて、ThreadPoolExecutorによる最大5並列のWebスクレイピングを実行します。
- **Search & Collection**: Google Custom Search APIを利用した自動収集、ディレクトリサイトからのリンク収集、Google検索結果の直接スクレイピング、Shopifyパートナーディレクトリからの収集、Google Places APIによるGoogleマップからの企業収集など、複数の情報源に対応しています。
- **Data Processing**:
    - **Scoring**: 100点満点のスコアリングシステム（Shopify+20点、EC制作+15点など）と手動調整機能を持ち、プロジェクトごとにカスタムスコアリングルールを設定可能です。
    - **Categorization**: 9種類のカテゴリ分類（EC制作、Shopify支援など）とフラグ検出を自動で行い、プロジェクトごとにカスタムカテゴリキーワードとフラグ定義を設定可能です。
    - **Duplicate Detection**: ドメイン正規化による重複検出とマージ機能を提供します。
    - **Aggregator Detection**: まとめサイトや比較サイトを自動で判定し、拒否リスト化します。
- **Workflow & Automation**:
    - **Auto-collection**: 設定された検索キーワードに基づき、Google Custom Search APIを使用して候補企業を自動収集します。
    - **Scheduled Tasks**: 毎日指定時刻に自動収集を実行するスケジューラを内蔵しています。
    - **Real-time Progress**: SSE (Server-Sent Events) を使用して、Google API収集の進捗をリアルタイムで表示します。
    - **Slack Notifications**: 収集完了時にSlackへの通知が可能です。
- **Data Management**:
    - **Master Database**: 全プロジェクト横断の企業プール（`company_master`）があり、収集時に自動的にUPSERTされます。キーワード、カテゴリ、都道府県、スコアで検索し、現在のプロジェクトにインポートできます。
    - **History & Logs**: コレクション履歴、ステータス変更履歴、API使用ログを記録します。
    - **Templates**: メモテンプレートとメールテンプレート（変数展開機能付き）を管理します。
    - **User Management**: 組織メンバーの招待、一覧、ロール管理（admin/member）、削除機能を提供します。
- **Performance**: APIレスポンス（ダッシュボード、キーワード、テンプレートなど）にはインメモリTTLキャッシュが適用されます。
- **AI Analysis**: 企業URLをスクレイピングし、OpenAI GPT-4o-miniで事業内容・顧客層・強み・サービス・価格帯を自動生成します。結果はDBに保存（`ai_summary` JSONカラム）し、企業詳細ページの「AIサマリー」タブに表示します。
- **Follow-up Notifications**: 毎朝9時にスケジューラが起動し、期限当日・超過のフォローアップ企業を管理者にメール/Slackで通知します。通知のON/OFFとチャンネルは設定画面から変更できます。
- **Plan Management**: サブスクリプションプランのCRUDと組織への割り当て機能。管理者は `/admin/plans` からプランを作成・編集・削除し、各組織に割り当てられます。プランにはメンバー数・プロジェクト数・企業数・月次AI分析回数の上限を設定でき、上限超過時はHTTP 402エラーを返します。設定画面ではプログレスバーで使用量を確認でき、ダッシュボードにはプラン名のバッジが表示されます。
- **Keyword Analytics**: 検索条件管理ページ（/keywords）に「分析」タブを追加。collection_logsを集計してキーワードごとの獲得数・成功率・重複率・拒否率を可視化。棒グラフと詳細テーブルで効率の高い/低いキーワードを把握できます。
- **Outreach Email Generation**: 企業詳細ページのAIサマリータブ内に「アウトリーチメール生成」セクションを追加。ai_summaryデータを活用し、フォーマル/カジュアルのトーン選択と追加指示に基づいてOpenAI GPT-4o-miniが件名・本文を生成。コピーボタン付き・本文は編集可能。

## External Dependencies
- **Google Custom Search API**: 営業先の自動収集に利用します。APIキーは管理画面で設定します。
- **Google Places API**: Googleマップからの企業情報収集および住所、電話、レビュー情報の補完に利用します。
- **PostgreSQL**: データベースとして利用します（Replit内蔵）。
- **Slack Incoming Webhook**: 収集完了通知・フォローアップ通知のために利用します。
- **SMTPサービス**: ユーザー招待・パスワードリセット・フォローアップ通知のメール送信に利用します。SMTPサーバー設定は管理画面から行います。
- **OpenAI API (GPT-4o-mini)**: AI企業分析機能に利用します。APIキーは管理画面から設定します。