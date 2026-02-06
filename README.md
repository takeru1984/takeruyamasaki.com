# EcoFlow Delta 2 Max S + SwitchBot Dashboard (MVP)

A Next.js-based monitoring and control dashboard to prevent EcoFlow battery exhaustion (0% SoC) using SwitchBot smart plugs as an automated charging relay.

## 🚨 Safety First Policy
1. **Prevent 0% SoC**: The primary mission is to ensure the EcoFlow battery never hits 0%.
2. **Charging Bias**: In case of sensor ambiguity or API failure, the charger state always defaults to **ON**.
3. **Hardware Boundary**: SwitchBot control is **only** applied to the AC charging input. Never place safety-critical household loads downstream of the SwitchBot.

## Features
- **Real-time Monitoring**: Polling EcoFlow SoC, Input/Output Watts via REST API.
- **Automated Charging**: Logic-based SwitchBot toggling to maintain healthy SoC.
- **Alerting**: LINE Notify and Email integration for critical thresholds.
- **Audit Logs**: Full history of manual and automatic actions.

## Getting Started

### Prerequisites
- Node.js 18+
- Vercel Account (Pro recommended for 2min Crons)
- EcoFlow Developer Access (AccessKey/SecretKey)
- SwitchBot Developer Token & Device ID

### Local Setup
1. Clone the repository.
2. Copy `.env.example` to `.env.local` and fill in the values (see `.env.example` for Vercel Postgres and API keys).
3. Install dependencies:
   ```bash
   npm install
   # or: pnpm install
   ```
4. Database: Vercel Postgres をプロビジョンしたら、スキーマを反映します。
   ```bash
   npm run db:push
   # or: pnpm db:push
   ```
5. Run the development server:
   ```bash
   npm run dev
   # or: pnpm dev
   ```
6. Trigger a manual poll for testing:
   ```bash
   curl http://localhost:3000/api/poll -H "Authorization: Bearer <YOUR_CRON_SECRET>"
   ```

### Scripts (package.json)
- `npm run dev` / `pnpm dev` — 開発サーバー
- `npm run build` / `pnpm build` — Prisma generate + Next.js build
- `npm run lint` / `pnpm lint` — ESLint（`src` 配下）
- `npm run test` / `pnpm test` — Vitest（単体: フェイルセーフ・SoC 評価ロジック）
- `npm run db:push` / `pnpm db:push` — Prisma スキーマを DB に反映
- `npm run db:studio` / `pnpm db:studio` — Prisma Studio

## Deployment (Vercel)

1. **Deploy to Vercel**: Connect your repository to Vercel.
2. **Provision Database**: Enable Vercel Postgres from the Storage tab.
3. **Environment Variables**: Add all variables from `.env.example` to Vercel Project Settings.
4. **Cron Configuration**: The system expects `vercel.json` to define the `/api/poll` schedule.
   ```json
   {
     "crons": [
       {
         "path": "/api/poll",
         "schedule": "*/2 * * * *"
       }
     ]
   }
   ```

## Recovery Playbook

If you receive a **Poll Failure** or **SoC Critical** alert:
1. **Check Status**: Login to the Dashboard and check `operation_logs`.
2. **Physical Verification**: Ensure the EcoFlow charging LED is blinking and the SwitchBot plug is physically "ON".
3. **Manual Override**: Use the `FORCE ON` button in the UI or use the SwitchBot app directly if the dashboard is unreachable.
4. **Hard Reset**: If the API is consistently failing (Auth error), rotate EcoFlow keys and update Vercel environment variables.

## Control API (POST /api/control)

### SoC 未知/古いデータガード
- **データ不明**: `lastPollAt` が null または 5 分以上古い場合、SoC は「不明」と判定。
- **charge_off 拒否**: SoC が不明のときは `charge_off` を拒否。`overrideLowSoc` でも解禁しない。
- **override 許可条件**: SoC が安全域 (`> SOC_SAFE_MIN`) かつ `overrideLowSoc` + 理由必須 + PIN OK のときのみ OFF 許可。
- **理由必須**: `overrideLowSoc` 指定時に理由が空なら 400 エラー。
- `operation_logs.details` に `staleData`, `overrideReason` を記録。

### モック認証
- Header: `x-mock-role: admin`, `x-mock-pin: pin_ok`（本番では NextAuth/Clerk 等に置換）

## Project Structure
- `/api/poll`: Master polling handler (EcoFlow + SwitchBot).
- `/api/control`: Charging toggle with safety guards.
- `/dashboard`: Main monitoring UI with manual ON/OFF controls.
- `/docs`: Detailed design & safety specifications.

## License
Confidential / Proprietary. For safety-internal use only.
