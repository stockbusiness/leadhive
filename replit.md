# LeadHive — 技術ドキュメント

## Overview

LeadHive is a B2B sales lead automation SaaS developed and operated by COOLWORKS Inc. The platform automates lead generation, scoring, AI analysis, email generation, pipeline management, and team collaboration. It gathers sales leads from various sources like Google Search, Google Maps, and gBizINFO, then streamlines the entire sales process from initial contact to pipeline tracking. The project aims to revolutionize B2B sales by providing an all-in-one solution for efficient lead management and conversion.

## User Preferences

- I want iterative development with a focus on delivering working features quickly.
- Ask for my input before making any significant architectural changes or adding new external dependencies.
- I prefer clear and concise explanations, avoiding overly technical jargon where simpler language suffices.
- I value detailed documentation for all new features and modifications.
- Ensure all changes are thoroughly tested before deployment.
- Prioritize security and data privacy in all development tasks.
- Do not make changes to the `replit.md` file unless explicitly instructed.
- Do not make changes to the `.replit` file.
- Do not make changes to the `.git/` folder.

## System Architecture

LeadHive utilizes a modern full-stack architecture.

**Frontend:**
-   **Framework:** React 18 with TypeScript
-   **Build Tool:** Vite
-   **Styling:** Tailwind CSS for utility-first styling
-   **Charting:** Recharts for data visualization
-   **Icons:** Lucide Icons
-   **UI/UX:** Adopts a clean, modern aesthetic with a focus on usability. Dark mode is supported via `ThemeContext` which applies a `.dark` class to the `<html>` element, enabling Tailwind's `dark:` variants.
-   **API Client:** `axios` is used for all API interactions, with a centralized client in `frontend/src/api/index.ts`.
-   **State Management:** React Context (`Auth`, `Project`, `Theme`) is used for global state management.

**Backend:**
-   **Framework:** FastAPI (Python 3.11) with Uvicorn, running on port 5000.
-   **Database ORM:** SQLAlchemy for defining and interacting with PostgreSQL models.
-   **Authentication:** JWT (Bearer tokens) with `sha256_crypt` for password hashing. Role-based access control (`member`, `admin`, `system_admin`) and specific flags (`is_system_admin`, `is_founder`) are implemented.
-   **Scheduler:** A Python `threading`-based scheduler (`server/services/scheduler.py`) polls every 30 seconds to execute background jobs for auto-collection, enrichment, user management, and notifications. This requires a Reserved VM deployment.
-   **API Design:** RESTful API endpoints are organized by resource (e.g., `companies`, `projects`, `sales_ai`). Fixed paths in FastAPI routes (e.g., `/api/companies/pipeline`) must be defined before dynamic paths (e.g., `/api/companies/{id}`) to prevent routing conflicts.
-   **Tenant Isolation:** Data is segmented by `org_id` or, for `companies`, indirectly via `project_id`. The `_owned_projects(user, db)` function ensures users only access their organization's data.
-   **Organization Settings:** `app_settings` table stores organization-specific key-value configurations, filtered by `org_id`.

**Key Features Implemented:**

-   **Collection & Scoring:** Automated lead collection from multiple sources, 100-point scoring with A-D ranks, CMS detection, email/SNS extraction, domain normalization, duplicate removal, and blacklist management.
-   **Company Management:** Filterable company lists, detailed views, editing, tagging, manual score adjustment, 담당자 assignment, follow-up date setting, CSV import/export, and master database search.
-   **Sales Pipeline:** Kanban board with 9 statuses, HTML5 drag-and-drop for status changes, and project filtering.
-   **Sales AI:** Claude-3-5-Sonnet for sales email generation (3 templates), bulk generation (up to 50), draft saving, review, SMTP sending, unsubscribe list management, and a semi-automatic generation scheduler.
-   **Notifications:** In-app notification bell for follow-ups, daily email notifications, and Slack Webhook integration.
-   **Dashboards & Analytics:** Organizational dashboards (collection count, approach rate, conversion rate, score distribution), team dashboards (admin/system_admin only), and keyword analysis.
-   **Team Management:** Member invitation, permission management, profiles, and a 6-step onboarding wizard.
-   **Admin Functions (COOLWORKS Only):** Tenant, user, plan, billing management, centralized API key management, feature flag management, and master DB auto-collection scheduling.
-   **Production-Readiness Features (Implemented):** Stripe Webhook full handling (invoice.payment_failed, subscription.deleted/updated), Customer Portal, coupon codes, downgrade validation, API rate limiting (slowapi on login/register/forgot-password), JWT token_version session management, 2FA TOTP (pyotp + qrcode), account deletion with Stripe cancellation, GDPR data export, welcome email, usage alert emails (80%/100%), Sentry error monitoring, MRR/ARR admin dashboard, terms acceptance recording.

## External Dependencies

-   **AI Writer:** Anthropic Claude-3-5-Sonnet (via Anthropic API)
-   **AI Analysis:** OpenAI GPT-4o-mini (via OpenAI API)
-   **Search APIs:** Serper API (primary), Google Custom Search API (fallback)
-   **Maps & Business Info:** Google Places API, gBizINFO API
-   **Payment Processing:** Stripe
-   **Email:** SMTP (for sending sales emails and notifications)
-   **Notifications:** Slack Incoming Webhook
-   **Database:** PostgreSQL 16 (Replit built-in)