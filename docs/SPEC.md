# EcoFlow Delta 2 Max S + SwitchBot Dashboard MVP Spec

## Objectives
- Prevent EcoFlow SoC from ever reaching 0% by proactively switching AC charging on.
- Centralize remote monitoring/control with authenticated web access hosted on Vercel.
- Provide auditable history for sensor readings, notifications, and manual overrides.

## Functional Scope
### Monitoring
- Poll EcoFlow IoT Open Platform REST API (battery, input/output watts, SoC, errors) at high frequency (e.g., every 2 min) via `/api/poll` cron job.
- Region-specific endpoints:
  - Global/US: `https://api-a.ecoflow.com`
  - Europe: `https://api-e.ecoflow.com`
  - Others: `https://api.ecoflow.com`
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

## EcoFlow API Specifications

### Worker vs Direct API
- **Worker (default when configured)**: If `WORKER_URL` and `WORKER_AUTH_TOKEN` are set, `/api/poll` always calls the Worker first and returns its result.
- **Direct Fallback (opt-in)**: Only when `ECOFLOW_ALLOW_DIRECT_FALLBACK=1` AND the Worker call throws does the system fall back to the direct EcoFlow REST API. Default is 0 (no fallback).
- **Fail-safe Mode**: If both the primary and fallback (if enabled) fail, or if neither is configured, the system increments the `pollFailureCount`.

### Direct API (Authentication & Signature)
Requests must include authentication headers and a signature generated as follows:

- **Algorithm**: HMAC-SHA256
- **Secret**: `ECOFLOW_SECRET_KEY`
- **Headers**:
  - `accessKey`: Your Access Key.
  - `nonce`: Random string (e.g., 6-digit number or larger).
  - `timestamp`: Current UTC time in **milliseconds**.
  - `sign`: Generated HMAC-SHA256 hex string.
- **Signature Base String**:
  1. Gather authentication parameters: `accessKey`, `nonce`, and `timestamp`. (Note: `sn` and other data parameters are **EXCLUDED** from the signature base string).
  2. Sort parameter keys alphabetically.
  3. Form a string: `accessKey=VAL&nonce=VAL&timestamp=VAL`.
  4. Perform HMAC-SHA256(secret, baseString) and convert to lowercase hex.

### Error Codes
- `0`: Success
- `8513`: AccessKey invalid (key revoked, expired, or wrong portal/region).
- `8521`: Signature error (invalid sign or mismatch in base string).
- `8524`: Timestamp error (client/server time out of sync > 15 min).
- `404`: Endpoint or Device SN not found.

### Key Regeneration (accessKey invalid / 8513)
1. Log in to [developer.ecoflow.com](https://developer.ecoflow.com) (Global) or [developer-eu.ecoflow.com](https://developer-eu.ecoflow.com) (EU).
2. Open your App → **Credentials** or **Key Management**.
3. **Regenerate** or **Create new** Access Key and Secret Key. Copy both immediately (Secret is shown only once).
4. Update `.env.local` and Vercel Environment Variables with the new values.
5. Redeploy and run `scripts/verify-ecoflow-node.mjs` until `code=0`.

### Developer Portal Checklist
If `accessKey invalid` persists despite correct credentials:
1. **Region Consistency**:
   - **Global/US**: [developer.ecoflow.com](https://developer.ecoflow.com)
   - **Europe/EU**: [developer-eu.ecoflow.com](https://developer-eu.ecoflow.com)
   - *Crucial*: Ensure your keys were issued on the portal matching your device's physical region. Mixing keys/portals often leads to invalid status.
2. **App Status**:
   - Ensure the App is **"Normal"** or **"Active"**.
   - Review "Expiration Date" (if applicable) or "Certification Status".
3. **Data/Device Binding**:
   - Verify that the `DEVICE_SN` appears in the "Authorized Devices" or "Quota Management" list to ensure the account has permission to read that specific unit.

> [!TIP]
> Operational verification and manual `curl` steps are detailed in [POST_DEPLOY_VERIFICATION.md](file:///Users/takeru/Library/CloudStorage/GoogleDrive-takeru@cloudnine.llc/%E5%85%B1%E6%9C%89%E3%83%89%E3%83%A9%E3%82%A4%E3%83%96/Cloudnine/02_Coding/05_ECOFLOW%20Dashboard/docs/POST_DEPLOY_VERIFICATION.md).

## Non-Functional Requirements
- Average poll handler must finish < 10s to stay within Vercel function timeout.
- Observability: emit structured logs (JSON) for poll/control with correlation IDs.
- Testing: include unit tests for alert evaluator + control safety gating logic.
- Documentation: README covers local dev, env vars, cron setup, recovery playbook.
