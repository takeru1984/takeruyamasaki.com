# Architecture Overview

## High-Level Flow
1. **Trigger**: Vercel Cron invokes `/api/poll` every 2 minutes.
2. **Data Acquisition**:
   - **EcoFlow IoT API**: Direct REST call with HMAC-SHA256 signing (Primary).
   - **SwitchBot API**: Fetch current plug relay state.
3. **Logic Evaluation**:
   - Update `system_status` (failure counters/success timestamps).
   - SoC Check: If SoC < Critical threshold → Trigger `CHARGE_ON`.
   - Fail-safe Check: If failures >= 3 → Trigger `CHARGE_ON`.
4. **Persistence**: Write results to `device_state` and `operation_logs`.
5. **Notification**: Send alerts via LINE/Email if automatic actions were taken.
6. **Delivery**: UI (`/dashboard`) reflects the latest DB state; User issues manual commands via `/api/control`.

## Worker Fallback (Secondary / Proxy)
While the system defaults to **Direct API** for lower latency and simplicity, the legacy `WORKER_URL` logic is retained as a fallback:
- **Redundancy**: Used if direct Vercel -> EcoFlow connectivity is throttled or blocked.
- **Account Mirroring**: Useful if metrics need to be proxied from a different EcoFlow account region without changing main app secrets.

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

