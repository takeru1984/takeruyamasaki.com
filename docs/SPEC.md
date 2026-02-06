# EcoFlow Delta 2 Max S + SwitchBot Dashboard MVP Spec

## Objectives
- Prevent EcoFlow SoC from ever reaching 0% by proactively switching AC charging on.
- Centralize remote monitoring/control with authenticated web access hosted on Vercel.
- Provide auditable history for sensor readings, notifications, and manual overrides.

## Functional Scope
### Monitoring
- Poll EcoFlow REST API (battery, input/output watts, SoC, errors) at high frequency (e.g., every 2 min) via `/api/poll` cron job.
- Poll SwitchBot plug (charger side only) to confirm relay state with each EcoFlow poll.
- Persist every poll snapshot into Postgres `device_state` table (timestamped, raw payload, derived SoC metrics).
- UI `/dashboard` surfaces latest snapshot, SoC trend (last 24h), and highlight “critical devices” (EcoFlow battery, SwitchBot charger, solar input).

### Control
- `/api/control` accepts `action=charge_on|charge_off` targeting SwitchBot plug.
- Requires authenticated session + secondary PIN/Re-auth when issuing OFF (riskier action).
- Control endpoint always writes to `operation_logs` (who, when, action, rationale text, API response).
- Endpoint enforces safety guardrails: denies OFF if SoC < configurable floor (e.g., 40%) unless explicit override flag with justification and SoC still >20%.

### History & Reporting
- `/dashboard` shows latest reading + mini table (last 10 entries) and link to `/history` for deeper query.
- Provide CSV export endpoint `/api/history?from=&to=` limited by auth + rate limiting.

### Notifications
- Alerting worker (triggered in `/api/poll`) evaluates rules:
  - SoC <= 35% → notification + auto charge ON.
  - Consecutive poll failures >= 3 → fail-safe ON + notification.
- Supports email (SMTP/Resend) and LINE Notify webhook; deduplicate using `notifications` table with 30 min cooldown keying by alert type.

### Authentication & Authorization
- Wrap entire app with Vercel Middleware enforcing Auth (e.g., Clerk/Auth0/NextAuth passwordless).
- Role concept: `admin` (full control), `viewer` (read-only). Control endpoints require `admin`.
- Secondary confirmation: PIN modal or WebAuthn re-auth for `charge_off`.

### Operation Logging
- Every control attempt and automatic safety action stored in `operation_logs` (actor, type manual/auto, request payload, result, reason text, correlation id).
- Logs visible in `/dashboard` sidebar (last 5) and `/logs` page.

### Reliability & Fail-safe
- Default charger state is ON when signals ambiguous.
- Keep a `system_state` row tracking last successful poll time; UI surfaces stale data warnings (>5 min old).
- Provide manual “panic ON” button always enabled.

### Deployment & Environment
- Vercel app (Next.js). Scheduled Functions or Vercel Cron invoke `/api/poll` every 2 min (requires Pro plan) + `/api/notify-digest` hourly.
- Database: Vercel Postgres or Supabase (prefer hosted Postgres for SQL + history retention).
- `.env.example` lists EcoFlow API token, SwitchBot token/deviceId, LINE token, SMTP creds, Auth secrets, PIN hash, DB URL.

## Non-Functional Requirements
- Average poll handler must finish < 10s to stay within Vercel function timeout.
- Observability: emit structured logs (JSON) for poll/control with correlation IDs.
- Testing: include unit tests for alert evaluator + control safety gating logic.
- Documentation: README covers local dev, env vars, cron setup, recovery playbook.
