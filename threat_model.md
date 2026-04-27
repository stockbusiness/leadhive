# Threat Model

## Project Overview

LeadHive is a multi-tenant B2B sales automation SaaS with a React/Vite frontend and a FastAPI backend backed by PostgreSQL via SQLAlchemy. Authenticated tenant users manage company leads, projects, outreach, dashboards, and integrations; platform system administrators manage billing, tenant-wide settings, and operational controls. Production traffic is assumed to be TLS-terminated by the platform, `NODE_ENV` is assumed to be `production`, and mockup/sandbox-only areas are out of scope unless proven production-reachable.

## Assets

- **User accounts and sessions** — user credentials, JWT bearer tokens, TOTP state, password reset and invite tokens. Compromise enables account takeover and tenant access.
- **Tenant business data** — projects, companies, notes, contact details, activities, exported lead lists, and pipeline state. This is the primary customer data set and must stay isolated by organization.
- **Platform-wide admin state** — system-admin privileges, tenant metadata, plans, billing state, and operational dashboards. Compromise affects every tenant.
- **Integration secrets and configuration** — Stripe keys, webhook secrets, SMTP credentials, SendGrid keys, Serper/gBizINFO/OpenAI/Anthropic keys, Slack webhook URLs, and similar settings. Leakage or tampering can lead to account compromise, billing abuse, data exfiltration, or SSRF.
- **Webhook and callback channels** — Stripe webhooks, inbound lead webhooks, tracking/unsubscribe links, email event webhooks, and support/inbound integrations. These are public-facing trust boundaries that can mutate data.

## Trust Boundaries

- **Browser to API** — the React frontend stores a bearer token in browser storage and sends it to the FastAPI backend. The client is untrusted; authorization must be enforced server-side on every sensitive route.
- **Public to authenticated to system-admin surfaces** — the app exposes public auth/callback/legal endpoints, authenticated tenant APIs, and privileged system-admin endpoints. These role and reachability boundaries are security-critical.
- **API to PostgreSQL** — FastAPI handlers and background jobs have broad database access. Missing ownership checks or unsafe query construction can expose or tamper with cross-tenant data.
- **API to third-party services** — the server calls Stripe, SMTP/SendGrid, Slack webhooks, gBizINFO, Serper, OpenAI, Anthropic, and other services with stored secrets. Publicly reachable trigger endpoints and test utilities must not become proxy/SSRF or secret-abuse channels.
- **Background jobs and schedulers** — collector, enrichment, IMAP polling, and scheduler jobs run with server-side privileges and can touch many records across tenants.

## Scan Anchors

- **Production entry points:** `server/main.py`, `server/routes/auth.py`, `server/routes/companies.py`, `server/routes/payments.py`, `server/routes/public.py`, `server/routes/webhooks.py`, `server/routes/security.py`, `server/routes/settings.py`.
- **Highest-risk areas:** auth/session defaults in `server/auth.py` and `server/main.py`; tenant isolation in `server/routes/companies.py`, `server/routes/keywords.py`, and authenticated campaign flows in `server/routes/email_campaigns.py`; public callbacks/webhooks in `server/routes/public.py`, `server/routes/payments.py`, `server/routes/email_campaigns.py`, and `server/routes/tracking.py`; secret handling in `server/services/encryption.py` and settings/admin routes.
- **Surface split:** public endpoints under `/api/public/*`, `/api/auth/*`, tracking/callback endpoints, authenticated tenant APIs under `/api/*`, and system-admin surfaces mostly under `/api/admin/*` and some privileged operational routes.
- **Usually ignore unless proven reachable in production:** `frontend/dist/`, `docs/`, `.local/`, `attached_assets/`, `node_modules/`, and local-only development artifacts.

## Threat Categories

### Spoofing

The application relies on JWT bearer tokens signed with `SESSION_SECRET`, plus invitation, verification, reset, unsubscribe, and webhook secrets. The system must reject startup defaults or predictable shared secrets in production, validate every bearer token on protected routes, and require cryptographic verification for external callbacks that change billing or user-visible state.

### Tampering

Authenticated users can modify lead data, org settings, exports, billing flows, and integration behavior. All state-changing routes must enforce the intended role boundary server-side, and every project/company mutation must verify organization ownership before reading, updating, deleting, exporting, or triggering downstream actions.

### Information Disclosure

LeadHive stores customer lead data, user records, internal notes, and operational metadata for many organizations. API responses, exports, backup endpoints, admin dashboards, and webhook/test utilities must only disclose data scoped to the authenticated tenant or the legitimate platform admin; secrets must remain encrypted at rest and never be returned in plaintext to less-privileged users.

### Denial of Service

The product exposes public auth endpoints, public corporate lookup, public webhook receivers, and multiple network-heavy collector/scraper functions. Public or low-privilege callers must not be able to force expensive upstream API usage, mass scraping, or unbounded background work without rate limits, quotas, and strict authorization.

### Elevation of Privilege

This codebase has three meaningful privilege levels: public, authenticated tenant user/admin, and platform system admin. The backend must not trust frontend gating or route names like `/api/admin/...`; it must enforce role checks consistently, prevent IDOR and cross-tenant access based on guessable numeric IDs, and ensure tenant users cannot reach global administrative capabilities or alter org-wide secrets unless explicitly authorized.
