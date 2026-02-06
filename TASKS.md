# Task Tracker

| ID | Title | Status | Owner | DoD |
| --- | --- | --- | --- | --- |
| T01 | Baseline specs/safety/architecture docs | DONE | Codex | SPEC/SAFETY/ARCHITECTURE drafted with safety assumptions + published in docs/ |
| T02 | Persistence + schema plan | DONE | Anti-Gravity | Produced docs/SCHEMA.md with ERD + retention rules |
| T03 | Poll worker implementation | DONE | Cursor | `/api/poll` serverless route fetches EcoFlow + SwitchBot, saves to Postgres, unit tests for fail-safe paths |
| T04 | Control endpoint + PIN gating | DONE | Cursor | `/api/control` with auth, guardrails, logging, tested via integration test hitting mock SwitchBot |
| T05 | Dashboard UI + history/log views | DONE | Cursor | `/dashboard` shows latest state + history, `/history` + `/logs` pages reading DB only |
| T06 | Notification + dedupe logic | DONE | Anti-Gravity | Alerting spec + doc (docs/ALERTING.md) ready for implementation |
| T07 | Deployment + README/.env.example | DONE | Anti-Gravity | README and .env.example instructions covering Vercel, Cron, recovery created |
