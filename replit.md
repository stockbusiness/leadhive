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
- **Scraping & Collection**: BeautifulSoup4とRequestsを用いた最大5並列のWebスクレイピング。Serper API（優先）またはGoogle Custom Search API（フォールバック）、ディレクトリサイト、Google検索、Shopifyパートナーディレクトリ、Google Places API、gBizINFO APIからの企業情報収集に対応しています。
- **Data Processing**:
    - **Scoring**: カスタム可能な100点満点スコアリングシステムと手動調整。
    - **Categorization**: 9種類のカテゴリ分類とフラグ検出の自動化、カスタム設定可能。
    - **Duplicate Detection**: ドメイン正規化による重複検出とマージ。
    - **Aggregator Detection**: まとめサイトや比較サイトの自動判定と拒否リスト化。
- **Workflow & Automation**:
    - **Auto-collection**: 設定キーワードに基づきSerper API（優先）またはGoogle Custom Search APIで自動収集。使用エンジンをログ出力。
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
- **Team Progress Dashboard**: ダッシュボードに「概要/チーム」タブを追加。チームタブでは担当者別の担当企業数・今週のアクティビティ・期限超過件数・アプローチ進捗バーを表示。GET /api/dashboard/team エンドポイント。
- **Early Access Phase 0**: アーリーアクセス戦略を実装。`is_system_admin`フラグによるシステム管理者のみ全機能利用可能。通常ユーザーはステータス変更、活動ログ、CSVエクスポート、AI分析、メール生成・送信、チーム招待、テンプレート管理、マスターDB、チームダッシュボードが402エラーでロック。
- **Founder Plan**: 先着50名の登録者に自動適用されるFounderプラン。is_founder=true、1年目無料・2年目80%オフ・3年目以降50%オフ永続特典。
- **Registration Number**: 新規登録時に連番の登録番号(registration_number)を自動発行。登録50名以内はis_founder=True。オンボーディング完了画面に表示。
- **Auto-suspend**: 30日間ログインなしのユーザーを毎日2時に自動停止(is_active=False)。システム管理者は除外。
- **Roadmap Page**: /roadmapで公開ロードマップページ。登録者数・Founder残り枠・機能ステータス4グループ（利用可能/スターター/プロ/準備中）・特典説明を表示。認証不要。
- **Sidebar**: ロードマップリンク追加。マスターDBリンクはis_system_admin=trueのみ表示。FounderバッジとAdminバッジをサイドバーユーザー名横に表示。
- **AI Usage Logging**: ai_usage_logs テーブルでAI機能のトークン消費量（入力/出力）・モデル・コストを記録。ai_analyzer.py で自動ログ保存。
- **Last Login Tracking**: users.last_login_at カラム。ログイン時に自動更新。
- **Admin Features**:
    - **Admin Dashboard**: テナント数、ユーザー数、統計データ、グラフ表示。AIコスト管理セクション（組織別・月別トークン消費量・USD概算コスト・棒グラフ・詳細テーブル）。
    - **System API Settings**: gBizINFO等のシステム全体で共有するAPIキー管理。
    - **Tenant Management**: 全Organizationの一覧表示、プラン変更。最終利用日・今月収集数・解約リスクバッジ（30日未利用）の表示。GET /api/admin/ai-costs エンドポイント。
    - **User Management**: 全ユーザーの横断管理、ロール変更、削除。
    - **System Logs**: 管理者操作の監査ログ。
    - **Announcements**: 全体またはテナント個別のお知らせ配信。
    - **Billing**: Stripe PaymentIntentsの一覧表示。
    - **SMTP Settings**: 各種SMTPサービス設定とテスト送信機能。
    - **Feature Flags**: 主要機能（AI分析、CSVエクスポート、マスターDB、gBizINFO、Googleマップ、Slack通知、セルフアップグレード）の有効/無効管理。
- **Keyword Analytics**: 検索条件管理ページに、キーワードごとの獲得数・成功率・重複率・拒否率を可視化する分析タブ。
- **Contact Person Fields**: 企業モデルに担当者名（contact_name）と役職（contact_title）フィールドを追加。編集モーダルと詳細ページに表示。
- **Tag Management**: 企業へのフリータグ追加・削除・フィルタリング機能。CompanyEditModal でタグ管理、CompanyFilterBar でタグ絞り込み。
- **SMTP Email Send with History**: 企業詳細の編集モーダルからSMTPサーバー経由でメールを直接送信。送信履歴を email_send_logs テーブルに保存し、アクティビティログにも記録。テンプレート適用・宛先/件名/本文の編集が可能。
- **Onboarding Wizard**: 新規ユーザー向け6ステップウィザード（ようこそ→組織名→プロジェクト→キーワード→Google API→完了）。onboarding_completed フラグ管理。
- **Enhanced Registration Form**: 登録フォームに担当者名（display_name・必須）・電話番号（phone・必須）を追加。法人番号（13桁・任意）入力欄を設置し、チェックデジット検証（NTA仕様準拠）付き。gBizINFO APIトークンが設定済みの場合は「法人情報を取得」ボタンで会社名を自動補完（GET /api/public/corporate/{number}）。利用規約・プライバシーポリシー同意チェックボックスを必須化。Organizationモデルに phone, corporate_number, corporate_verified カラムを追加。
- **Phase 1 データ基盤**（2026-03実装）:
    - **CMS検出**: Shopify/WordPress/BASE/MakeShop/futureshop/カラーミー/EC-CUBE/Wix/Squarespace/STORES/Jimdo の自動判定。scraper.py の `detect_cms()` が HTML/HTTPヘッダを解析。
    - **メール取得強化**: `extract_email_from_soup()` で `mailto:` リンク優先抽出・難読化（[at]等）対応・info@/contact@等の優先順位付け・contact_url への追加クロール。
    - **SNSリンク取得**: `extract_sns_links()` でTwitter/X・Instagram・Facebook・YouTube・LINEのURLを自動抽出し `sns_links` JSON列に保存。
    - **採用情報フラグ**: `detect_recruitment()` で採用/求人/募集/career キーワードとIndeedリンクを検出し `has_recruitment` フラグを付与。
    - **安全収集ポリシー**: `check_robots_allowed()` でrobots.txtを確認（24時間キャッシュ）し、Disallow対象は `robots_disallow=True` で記録してスクレイピングをスキップ。User-Agent を `LeadHive/1.0 +https://leadhive.work` に統一。AutoMasterのクロール間隔を `random.uniform(2.0, 4.0)` 秒に延長。
    - **ESCMS優先フラグ**: `escms_target_flag = ec_flag AND cms_type NOT IN (NULL, "Shopify")` で自動付与。EC事業者でShopify未使用の企業を識別。スコア+10。
    - **スコアリング拡張**: has_recruitment +5、SNSアクティブ +5、escms_target_flag +10。
    - **DBスキーマ拡張**: company_master・companiesテーブルに cms_type/cms_detected_at/sns_links/has_recruitment/employee_count/escms_target_flag/robots_disallow の7カラムを追加（ALTER TABLE IF NOT EXISTS で安全マイグレーション）。
    - **マスターDB検索フィルタ拡張**: `/api/master/search` に cms_type/has_email/escms_target/has_recruitment パラメータを追加。
    - **UI拡張**: MasterDB検索にCMS種別・メール有無・ESCMS優先・採用情報フィルタを追加。テーブルにCMS列・情報列（メール/SNS/採用アイコン）を追加。CompanyDetailにCMSバッジ・SNSリンク行・採用中バッジ・ESCMS優先バッジ・メールコピーボタンを追加。
    - **セグメント機能**（2026-03実装）: 検索条件を「セグメント」として保存・再利用できる機能。`segments` テーブル（org_id/created_by/name/description/filters JSONB）を新設。CRUD API `/api/segments`（GET/POST/PUT/DELETE）。MasterDB UIに保存済みセグメントパネル（折りたたみ）・セグメント保存ダイアログ・クリックで条件を即適用・アクティブセグメント表示・削除機能を実装。上限50件/org。
    - **スコアリングルール管理UI改善**（2026-03実装）: Projects.tsx のスコアリングタブを全面改善。DEFAULT_SCORING_RULES の日本語ラベル・説明を追加（RULE_LABELS定数）。スライダーUI（プラスルール0〜30/ペナルティ−30〜0）。「デフォルトに戻す」ボタン。新規プロジェクト作成時はデフォルトルールで初期化。collector.py がプロジェクト固有の scoring_rules を使って calculate_score() を呼ぶように修正。
    - **job_logs DBマイグレーション**（2026-03実装）: `job_logs` テーブル（job_id/job_type/status/message/current/total/source_count/saved_count/error_count/started_at/finished_at）を新設。collector.py の `job_update()` が非同期バックグラウンドスレッドで DB にジョブ開始・完了・エラーを永続化。`GET /api/admin/auto-master/job-logs` エンドポイントを追加。AdminAutoMaster.tsx に折りたたみ式「実行履歴」パネル（開始時刻・種別・状態・保存件数・メッセージ・所要時間）を追加。

- **Phase 2 営業補助AI**（2026-03実装）:
    - **DBテーブル**: `sales_messages`（org_id/company_id/project_id/template_type/subject/body/ai_prompt_id/status/reviewed_by/reviewed_at/sent_at/sent_by）、`audit_logs`（company_id/send_method/sent_by_user_id/message_id/ai_prompt_id/result/note）、`opt_out_list`（email/domain/company_id/reason/added_by/added_at）。
    - **営業文生成AI**: Claude API（claude-3-5-sonnet-20241022）で3テンプレート（shopify/ec_support/partner）の件名+本文（300-500字）を自動生成。`server/services/ai_writer.py`。
    - **バックエンドAPI** (`server/routes/sales_ai.py`): POST /generate（1件）、POST /generate-batch（最大50件）、GET/PUT/DELETE /messages、POST /messages/{id}/send、GET/POST /opt-out。
    - **SalesAI.tsx**: 企業選択→テンプレート選択→一括生成→レビューリスト→編集モーダル→1件ずつ送信の全フロー。配信停止リスト管理タブ。
    - **opt_out_list**: メール/ドメイン単位で配信停止。生成時・送信時に自動チェック。
- **Phase 3 URL取得エンジン**（2026-03実装）:
    - **Serper API統合**: `server/services/serper_search.py` を新規作成。`collector.py` でSerper優先・Google CSEフォールバック実装。`/api/collect/search-engine-status` エンドポイント追加。
    - **スコアリングv3.0**: ec_flag +25、escms_target_flag +20、shopify_flag +20、production/consulting/operation_flag +15、contact_url +15、multi_platform +10、sns_count_3 +10、has_recruitment +5、sns_count_1 +5、phone +5、location +5。
    - **スケジューラー強化**: 自動収集時にSerper優先を使用。gBizINFOのURL補完もSerper優先。エンジン名をログ出力。
    - **API管理一元化**: Serper・Anthropic・gBizINFO APIキーをシステム管理者専用 `AdminApiKeys.tsx` で管理（`SystemSettings` テーブル、org_id=NULL）。各API取得手順アコーディオンUI付き。
- **Phase 4a SMTPメール送信**（2026-03実装）:
    - **実際のメール送信**: `send_message` エンドポイントでSMTPを使い実際にメール送信。プレーンテキストをHTML変換（段落・配信停止フッター付き）。SMTP未設定時は明確なエラーメッセージ。
    - **送信プレビューAPI**: `GET /api/sales-ai/messages/{id}/send-preview` で宛先メールアドレス・contact_url・SMTP設定状況・配信停止状態を事前確認。
    - **SendConfirmModal刷新**: 送信ダイアログに宛先メールアドレス表示・SMTP設定状況バッジ（設定済み=緑/未設定=黄）・配信停止チェック結果を表示。送信方法を「メール送信」「フォーム(手動)」「その他(手動記録)」の3種類に拡張。
    - **送信結果フィードバック**: 成功時は緑チェックマーク+「送信完了」画面、失敗時は赤×アイコン+「送信失敗」+エラー詳細を表示。audit_logsに送信先メールアドレスとエラー詳細を保存。

## External Dependencies
- **Google Custom Search API**: 営業先自動収集。
- **Google Places API**: Googleマップからの企業情報収集、住所・電話・レビュー情報の補完。
- **PostgreSQL**: データベース。
- **Slack Incoming Webhook**: 収集完了通知、フォローアップ通知。
- **SMTPサービス**: ユーザー招待、パスワードリセット、フォローアップ通知メール送信。
- **OpenAI API (GPT-4o-mini)**: AI企業分析、アウトリーチメール生成。
- **gBizINFO API（経済産業省）**: 法人DB収集（約400万社）。
- **Stripe**: 決済処理、サブスクリプション管理。