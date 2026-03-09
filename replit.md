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