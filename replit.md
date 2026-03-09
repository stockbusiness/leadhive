# LeadHive — 営業先リスト自動化ツール

## Overview
LeadHive is a B2B sales lead automation tool designed to streamline the collection, scoring, progress management, and team sharing of sales targets. It automates lead generation using Google Custom Search API and Google Maps, aiming to become an "Enterprise Data OS" by integrating AI-powered company analysis and sales decision support.

## User Preferences
特に指定はありません。

## System Architecture
LeadHive is a modern web application built with React and FastAPI.

**UI/UX**:
- Built with React, TypeScript, Tailwind CSS, and Recharts, bundled by Vite.
- Features include project-specific customization, Kanban views, dashboard charts, and mobile responsiveness.

**Backend**:
- FastAPI (Python) running on port 5000.
- PostgreSQL database integrated with Replit's internal database.
- JWT authentication with `sha256_crypt` for security.
- Supports organization-based multi-tenancy.

**Data Collection & Processing**:
- **Scraping**: Utilizes BeautifulSoup4 and Requests for web scraping (up to 5 parallel processes).
- **Sources**: Serper API (primary), Google Custom Search API (fallback), directory sites, Google search, Shopify Partner Directory, Google Places API, and gBizINFO API for company information.
- **Scoring**: Customizable 100-point scoring system with manual adjustments.
- **Categorization**: Automated and custom categorization into 9 types, including flag detection.
- **Deduplication**: Domain normalization for duplicate detection and merging.
- **Aggregator Detection**: Automatic identification and blacklisting of aggregator sites.
- **Workflow Automation**: Automated collection based on keywords, scheduled tasks, real-time progress updates via SSE, and Slack notifications upon completion.
- **AI Analysis**: OpenAI GPT-4o-mini for generating business descriptions, customer segments, strengths, services, and pricing from company URLs.
- **Outreach Email Generation**: OpenAI GPT-4o-mini generates subject lines and body content based on AI summaries and user-defined tones.
- **Follow-up Notifications**: Email/Slack notifications for overdue follow-ups.
- **CMS Detection**: Automatic detection of Shopify, WordPress, BASE, MakeShop, futureshop, カラーミー, EC-CUBE, Wix, Squarespace, STORES, and Jimdo.
- **Email & SNS Extraction**: Enhanced email extraction (mailto links, obfuscation, priority for info@/contact@) and automatic SNS link extraction (Twitter/X, Instagram, Facebook, YouTube, LINE).
- **Recruitment Detection**: Flags companies with recruitment information (e.g., career keywords, Indeed links).
- **Safe Collection Policy**: `robots.txt` check with 24-hour cache; skips disallowed pages. Standardized User-Agent.
- **ESCMS Priority Flag**: Identifies non-Shopify EC businesses for scoring.

**Data Management**:
- **Master Database**: Centralized company pool (`company_master`) across all projects with import functionality.
- **History & Logs**: Collection history, status changes, and API usage logs.
- **Templates**: Memo and email templates with variable substitution.
- **User Management**: Organization member invitation, management, and role assignment.
- **AI Usage Logging**: Records token consumption, model, and cost for AI features.
- **Keyword Analytics**: Provides insights into acquisition, success, duplication, and rejection rates per keyword.
- **Contact Person Fields**: Adds `contact_name` and `contact_title` to company profiles.
- **Tag Management**: Free tagging, filtering, and management for companies.
- **SMTP Email Send**: Direct email sending via SMTP from company details with history logging.
- **Onboarding Wizard**: A 6-step onboarding process for new users.
- **Segments**: Allows saving and reusing search criteria as "segments" for MasterDB searches.
- **Scoring Rule Management**: Improved UI for managing scoring rules with sliders and default reset options.
- **Job Logs**: Persistent logging for collection jobs with status, counts, and errors.

**Admin Features**:
- **Admin Dashboard**: Displays tenant/user counts, statistics, and AI cost management.
- **System API Settings**: Centralized management of API keys (Serper, Anthropic, gBizINFO).
- **Tenant Management**: Overview of organizations, plan changes, and risk assessment.
- **User Management**: Cross-organizational user administration.
- **System Logs**: Audit logs for administrative actions.
- **Announcements**: System-wide or tenant-specific announcements.
- **Billing**: View Stripe PaymentIntents.
- **SMTP Settings**: Configuration and testing for SMTP services.
- **Feature Flags**: Enable/disable key features (AI analysis, CSV export, MasterDB, gBizINFO, Google Maps, Slack notifications, self-upgrade).

**Subscription & Plans**:
- **Plan Management**: CRUD for subscription plans with customizable limits (members, projects, companies, AI analyses, MasterDB imports).
- **Stripe Integration**: Self-upgrade via Stripe.
- **CSV Export**: Plan-based limits on CSV export entries.
- **Master DB Access Control**: Plan-based restrictions on MasterDB search and import.
- **Team Progress Dashboard**: Displays per-assignee company counts, activity, overdue items, and progress.
- **Early Access**: `is_system_admin` flag controls feature access. Locked features for regular users.
- **Founder Plan**: Automatic application for first 50 registrants with perpetual discounts.
- **Auto-suspend**: Automatic deactivation of inactive users (30 days without login).
- **Roadmap Page**: Public roadmap showing registration count, Founder slots, feature status, and benefits.

## External Dependencies
- **Google Custom Search API**: Lead collection.
- **Google Places API**: Company information, address, phone, and review data.
- **PostgreSQL**: Primary database.
- **Slack Incoming Webhook**: Notifications.
- **SMTP services**: Email sending (invitations, password resets, follow-ups).
- **OpenAI API (GPT-4o-mini)**: AI analysis and email generation.
- **gBizINFO API**: Corporate database (Japan).
- **Stripe**: Payment processing and subscription management.
- **Serper API**: Search engine integration for lead collection.
- **Anthropic API (Claude-3-5-Sonnet)**: Advanced sales email generation.

## Phase 4 Implementation (2026-03)

**Phase 4a: SMTP Email Sending**:
- `send_message` endpoint now sends real emails via SMTP. Plain text is converted to HTML (paragraphs + unsubscribe footer).
- `GET /api/sales-ai/messages/{id}/send-preview` returns recipient email, contact_url, SMTP config status, opt-out state.
- SendConfirmModal updated: shows recipient email, SMTP badge (green=configured/amber=not), opt-out warning, three send methods (email/form/manual).
- Result screen after send: success (green CheckCircle2 + "送信完了") or failure (red XCircle + error detail). audit_logs stores email address and error details.

**Phase 4b: Unsubscribe Automation**:
- `server/services/unsubscribe_token.py`: HMAC-SHA256 token generation/verification using SESSION_SECRET. URL tampering prevention.
- `GET /api/public/unsubscribe?email=...&token=...`: Public endpoint. Valid token → adds to opt_out_list (reason="メール内配信停止リンクよりお手続き").
- Outgoing emails include real unsubscribe link (built from REPLIT_DEV_DOMAIN) in both HTML and plain text.
- `List-Unsubscribe` + `List-Unsubscribe-Post` headers added per RFC 2369 (one-click unsubscribe in email clients).
- `/unsubscribe` page (public, no auth): loading → success (green check + "配信停止が完了しました") / already-unsubscribed (blue check) / error (red X) states. COOLWORKS footer.

**Phase 4c: Send Statistics Dashboard**:
- `GET /api/sales-ai/stats`: Aggregated stats — status counts (draft/reviewed/sent/failed), template type counts, send method counts, result counts, 14-day daily send history, opt-out count.
- `GET /api/sales-ai/audit-logs?limit=50`: Recent audit log entries with company name join.
- SalesAI "送信統計" tab (4th tab): 4 KPI cards (total/sent/failed/opt-out), progress bar charts for status/template/method breakdown, CSS-based 14-day bar chart, sortable audit log table with colored result badges.
## Phase 5 Implementation (2026-03)

**Phase 5: 営業パイプライン・カンバンボード**:
- `GET /api/companies/pipeline?project_id=N`: Returns companies grouped by 9 statuses as kanban columns. Lightweight card data (company_name, domain, score, rank, follow_up_date, EC/Shopify flags). Route placed BEFORE `/{company_id}` to avoid 422 routing conflicts.
- `PATCH /api/companies/{id}/status`: Fast single-field status update with StatusHistory logging and cache invalidation.
- `PipelineCard` type added to `frontend/src/types/index.ts`.
- `frontend/src/pages/Pipeline.tsx`: Full Kanban board with 9 color-coded columns. Features: HTML5 drag & drop between columns (optimistic UI update), click-to-change status dropdown per card, project filter dropdown, company count badges, follow_up_date display (overdue=red/today=amber), score rank badge, EC/Shopify/CMS badges, direct link to company detail.
- Sidebar: "パイプライン" link with GanttChartSquare icon added after "営業AI".
- Route `/pipeline` added to App.tsx as lazy-loaded route.

## Phase 6-8 Implementation (2026-03)

**Phase 6: フォローアップ通知ベル**:
- `server/routes/notifications.py`: `GET /api/notifications/follow-ups` endpoint. Returns today/overdue follow-up companies. Admin/system_admin sees all org companies; regular users see only their assigned companies. Excludes completed statuses (代理店化/失注/除外). Returns up to 20 items per category.
- `frontend/src/components/common/NotificationPanel.tsx`: Notification bell with red badge (count), dropdown panel with "今日のフォローアップ"/"期限超過" sections, per-item company link to /companies/{id}, "パイプラインで確認" footer, auto-refresh every 5 minutes. Accepts `buttonClassName` prop for theming.
- Added to: mobile header (App.tsx) + desktop sidebar user section (with dark-themed `buttonClassName`).

**Phase 7: チームダッシュボード開放**:
- Dashboard.tsx: Team tab access condition changed from `isSystemAdmin` only → `isSystemAdmin || user?.role === "admin"`. Org admins can now view the team dashboard without system admin privileges.

**Phase 8: 収集効率ランキングカード**:
- Keywords.tsx analytics tab: Added "成功率 上位キーワード" (green card, top 3 by success_rate where total_found >= 5) and "要改善キーワード" (red card, bottom 3 where total_runs >= 2 AND success_rate < 20%). Pure frontend sorting — no API changes. Cards appear between KPI summary grid and bar chart.
