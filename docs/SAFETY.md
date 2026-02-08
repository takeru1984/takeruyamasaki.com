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

## API & Communication Safety
- **EcoFlow Data Source**: When `WORKER_URL` and `WORKER_AUTH_TOKEN` are set, `/api/poll` **always** uses the Cloudflare Worker. Direct EcoFlow REST API is only called when Worker is not configured, or when `ECOFLOW_ALLOW_DIRECT_FALLBACK=1` and the Worker call fails.
- **Host Redundancy**: The system should attempt regional endpoints (api-a, api-e, api) to mitigate regional outages.
- **Signature Timing**: Ensure Vercel server time is used for timestamps; a mismatch > 15 min results in Error 8524.
- **Fail-safe Logic**:
  - API errors (from Worker or Direct API) increment `poll_failure_count`.
  - When `poll_failure_count` >= 3 → call SwitchBot `turnOn`, log auto action, and alert operators.
  - **Worker Downtime Procedure**:
    1. Verify direct API status using `scripts/verify-ecoflow-node.mjs`.
    2. Check Worker health manually via `curl` if possible.
    3. If Worker is persistent down, set `ECOFLOW_ALLOW_DIRECT_FALLBACK=1` in Vercel env to maintain polling while Worker is being repaired.
  - If last successful poll timestamp is older than 10 min, UI banner instructs manual hardware verification.

## Notification Throttling & Prioritization
- **Prioritization**:
  - The system attempts to notify via **LINE Notify** (if `LINE_NOTIFY_TOKEN` is present) and **Email** (if `RESEND_API_KEY` is present).
  - If LINE Notify fails due to connectivity issues (e.g., DNS/ENOTFOUND), the system **skips** LINE and proceeds to Email to ensure alerts are delivered.
  - Notification failures do **not** block the `/api/poll` execution or increment `poll_failure_count`.
- **Throttling**:
  - Each alert type uses `notifications` table storing `alert_slug`, `last_sent_at`.
  - Reuse `cooldown_minutes` per alert (ex: low_soc=30, poll_failure=15).

## Notification Channels (LINE vs Email)
- **少なくとも片方のチャネルを有効にすること**を推奨。両方未設定だとアラートが届かない。
- **LINE Notify**: `LINE_NOTIFY_TOKEN` が空・未設定の場合は **静かにスキップ** する（エラーにはならない）。
- **LINE が不通の間**（例: Vercel から DNS ENOTFOUND 等で LINE API に到達できない場合）は、`LINE_NOTIFY_TOKEN` を一旦削除または空にして **メール通知のみ** を使う運用を推奨。
- メール設定（`RESEND_API_KEY` + `ALERT_EMAIL_TO`）が整ったら、LINE を無効化したままでも運用可能。

## Secrets & Permissions
- `.env` only loaded locally and in Vercel environment variables.
- Document minimal scopes for EcoFlow/SwitchBot tokens.
- Rotate tokens quarterly; record rotation schedule in docs/OPERATIONS.md (future).

## Access Control & Re-authentication
- Auth middleware enforces login for all routes.
- Sensitive control endpoints require role `admin` AND challenge mechanism (PIN prompt or passkey re-auth) per action when SoC < 60%.

## Operational Procedures for Consecutive Failures
In the event of 3+ consecutive poll failures (Communication Blackout):

1. **Immediate Action**: System forces SwitchBot `CHARGE_ON`.
2. **Operator Triage**:
   - Check EcoFlow physical LED status.
   - Check SwitchBot app for cloud connectivity.
   - Use `docs/POST_DEPLOY_VERIFICATION.md` Section 6 to test API manually.
3. **Manual Control Rules**:
   - During blackout, manual `CHARGE_OFF` is **DISABLED** in the UI to prevent deep discharge.
   - Only manual `CHARGE_ON` or "Panic Force ON" is permitted until a successful API poll is recorded.

## Logging & Audit
- Every automatic or manual action writes `operation_logs` (ISO timestamp, actor, device, previous/new state, justification, fail-safe flag).
- Logs retained for 365 days; archive script (future) moves older entries to cold storage.

## Operational Runbooks (initial)
- Recovery: If notifications indicate repeated failures, operator must confirm charger LED physically, then check SwitchBot app.
- **Mandatory Logic Verification**:
  - APIキー更新後や署名関連の修正後は、必ず `scripts/verify-ecoflow-node.mjs` を実行すること。
  - **Proof of Success**: 成功時（`✅ Success: code=0`）のログまたはスクリーンショットを完了報告（PR/issue等）に添付し、証跡を残す運用を徹底する。
- Manual override: Provide CLI script `scripts/force_charge_on.ts` hitting `/api/control?action=charge_on&source=cli` with service account.

