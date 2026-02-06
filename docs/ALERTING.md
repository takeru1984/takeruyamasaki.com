# Alerting & Notification Specification

This document details the logic for monitoring SoC thresholds and managing notifications to avoid "alert fatigue" while ensuring EcoFlow safety.

## SoC Threshold Logic

| Level | Threshold | Action | Notification | UI State |
| :--- | :--- | :--- | :--- | :--- |
| **Recovery** | > 45% | No Auto Action | None | Default |
| **Caution** | <= 35% | `SwitchBot.turnOn()` | LINE/Email (Info) | Yellow Banner |
| **Critical** | <= 25% | `SwitchBot.turnOn()` (Force) | LINE/Email (Alert) | Red Flash |
| **Panic** | <= 15% | Lock UI to "ON" | LINE/Email (Emergency) | Black/Red Lock |

## Notification Suppression Algorithm

To prevent flooding the operator with messages during a persistent low-SoC or API outage state, the system uses a deduplication logic backed by the `notifications` table.

### Algorithm Steps:
1. **Trigger Check**: An alert condition is met (e.g., SoC = 34%).
2. **Slug Generation**: Create a unique `alert_slug` based on type and level (e.g., `low_soc_caution`).
3. **Lookup**: Query `notifications` for the latest `sent_at` where `alert_slug` matches.
4. **Cooldown Evaluation**:
   - If `(CurrentTime - last_sent_at) < COOLDOWN_MINUTES`: **Suppress**.
   - If `(CurrentTime - last_sent_at) >= COOLDOWN_MINUTES`: **Send**.
5. **State Reset**: If SoC rises above 45%, the cooldown for `low_soc_*` slugs is effectively ignored for the next dip (cleared via business logic).

### Default Cooldowns:
- `low_soc_caution`: 60 minutes
- `low_soc_critical`: 30 minutes
- `poll_failure`: 15 minutes
- `api_fatal_error`: 5 minutes

## Alert Priority Matrix

| Priority | Scenario | Channel | Frequency |
| :--- | :--- | :--- | :--- |
| **P0 (Highest)** | SoC <= 15% OR Fatal API Auth Error | LINE + Email | Every 5 min |
| **P1** | SoC <= 25% OR Poll Failure >= 5 | LINE | Every 30 min |
| **P2** | SoC <= 35% | LINE (Digest) | Every 60 min |
| **P3 (Lowest)** | Charger Manually Toggled | DB Log Only | N/A |

## Implementation Notes

> [!WARNING]
> **SwitchBot specific**: Always verify the action result. If a `turnOn` command returns a failure code, escalate the alert priority to **P0** immediately regardless of current SoC.

- **LINE Notify**: Use simple POST requests to `https://notify-api.line.me/api/notify`.
- **Email**: Use Resend or SendGrid (Node.js SDK).
- **Template**: Alerts should include `TIMESTAMP`, `CURRENT_SOC`, `DEVICE_ID`, and `ACTION_TAKEN`.
