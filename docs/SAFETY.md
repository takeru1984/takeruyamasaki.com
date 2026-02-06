# Safety Plan

## Guiding Principles
1. Absolute rule: EcoFlow SoC must never reach 0%. Control logic always biases toward charging when signals disagree.
2. Any data gap, API failure, or worker outage immediately triggers charger ON and alerts operators.
3. SwitchBot automation only touches the AC input plug—never inline with household loads.
4. Secrets (.env, API tokens) remain confined to environment variables/local secure storage and never printed to logs or repo.
5. Disallow destructive shell commands (`rm -rf`, blanket formatters) in automation scripts.

## SoC Guard Rails
- `SOC_SAFE_MIN` (default 40%): deny `charge_off` below this threshold.
- `SOC_CRITICAL_MIN` (default 25%): automatic charger ON + high-priority notification + escalate in UI.
- `SOC_PANIC_MIN` (default 15%): lock UI controls to force ON until recovered.
- Poll loop compares reported SoC vs previous reading; if SoC drops unexpectedly >10% per poll, treat as sensor fault and force ON.

## Fail-safe Behavior
- Maintain `poll_failure_count`; when >=3 within 10 min → call SwitchBot `turnOn`, log auto action, send alert.
- If last successful poll timestamp older than 5 min, UI banner instructs operator to verify hardware manually.
- Cron monitor (Upstash/Heartbeat) pings `/api/health`; if missed twice, out-of-band alert to ops chat.

## Notification Throttling
- Each alert type uses `notifications` table storing `alert_slug`, `last_sent_at`.
- Reuse `cooldown_minutes` per alert (ex: low_soc=30, poll_failure=15).
- Critical repeating alerts escalate by changing slug (e.g., `low_soc_level2`).

## Secrets & Permissions
- `.env` only loaded locally and in Vercel environment variables.
- Document minimal scopes for EcoFlow/SwitchBot tokens.
- Rotate tokens quarterly; record rotation schedule in docs/OPERATIONS.md (future).

## Access Control & Re-authentication
- Auth middleware enforces login for all routes.
- Sensitive control endpoints require role `admin` AND challenge mechanism (PIN prompt or passkey re-auth) per action when SoC < 60%.

## Logging & Audit
- Every automatic or manual action writes `operation_logs` (ISO timestamp, actor, device, previous/new state, justification, fail-safe flag).
- Logs retained for 365 days; archive script (future) moves older entries to cold storage.

## Operational Runbooks (initial)
- Recovery: If notifications indicate repeated failures, operator must confirm charger LED physically, then check SwitchBot app.
- Manual override: Provide CLI script `scripts/force_charge_on.ts` hitting `/api/control?action=charge_on&source=cli` with service account.

