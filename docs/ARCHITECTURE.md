# Architecture Overview

## High-Level Flow
1. **Vercel Cron → `/api/poll`** every 2 minutes (Pro plan). Poll handler fans out to:
   - EcoFlow API (REST websocket fallback) for battery metrics.
   - SwitchBot cloud API for plug status.
2. Handler normalizes payloads, evaluates alerts/fail-safe logic, persists records into Postgres.
3. UI routes (`/dashboard`, `/history`, `/logs`) read exclusively from Postgres using ISR/SSR caches to avoid hitting vendor APIs.
4. `/api/control` executes SwitchBot commands with guardrails, updates DB, and optionally enqueues notification jobs.
5. Notification worker shares code with poll handler to send email/LINE when thresholds breached, using dedupe state in DB.

## Components
- **Frontend**: Next.js App Router on Vercel, Tailwind UI. Auth middleware gating all routes.
- **API Routes / Server Actions**:
  - `/api/poll` (cron-only, token-guarded) orchestrates device fetch + DB write.
  - `/api/control` (POST) toggles charging; enforces SoC/policy.
  - `/api/history` & `/api/logs` provide paginated JSON for UI components.
- **Database**: Vercel Postgres (preferred) with Prisma ORM. Key tables:
  - `device_state(id, collected_at, source, soc, watts_in, watts_out, switchbot_state, raw jsonb)`
  - `operation_logs(id, occurred_at, actor_id, action, target, reason, auto boolean, details jsonb)`
  - `notifications(id, alert_slug, sent_at, channel, payload)`
  - `users(id, email, role, pin_hash)` (if auth provider lacks role metadata)
  - `system_status(id singleton, last_poll_at, poll_failure_count)`
- **Cache/Queue**: Edge Config (optional) for feature flags; Upstash Redis for debounced notifications (optional future).

## Data Refresh & Rate Limits
- EcoFlow polling capped at every 120s to respect API quotas while maintaining SoC safety. Critical device metrics cached per poll in DB for UI.
- SwitchBot commands limited to <=10 per minute; control endpoint debounces repeated ON requests.
- UI uses SWR polling (30s) against Postgres-backed API endpoints, never direct vendor API calls.

## Deployment Considerations
- Vercel Pro for Cron frequency + Postgres storage needs.
- Use environment-specific projects (`dev`, `prod`) with isolated DBs.
- Observability via Vercel logging + optional Axiom ingestion.

## Future Enhancements (out of MVP)
- Predictive SoC modeling w/ solar + load forecast.
- Multi-battery support.
- Ops runbooks + escalations automation.

