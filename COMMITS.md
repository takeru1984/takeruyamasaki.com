# 論理単位でのコミット案（レビュー用）

以下の順でコミットすると差分が追いやすくなります。

1. **chore: Next.js App Router + Prisma 初期化**
   - `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `.gitignore`
   - `src/app/layout.tsx`, `page.tsx`, `globals.css`, `favicon.ico`, `public/*`
   - `prisma/schema.prisma`（docs/SCHEMA.md 準拠）
   - `.env.example` の POSTGRES コメント追加

2. **feat: DB・設定・EcoFlow/SwitchBot クライアント**
   - `src/lib/db.ts`, `src/lib/config.ts`, `src/lib/ecoflow.ts`, `src/lib/switchbot.ts`

3. **feat: ポール評価ロジックとポールサービス**
   - `src/lib/poll-evaluator.ts`, `src/lib/poll-service.ts`

4. **feat: /api/poll（Cron 専用・署名チェック・フェイルセーフ）**
   - `src/app/api/poll/route.ts`
   - `vercel.json`（Cron スケジュール）

5. **test: フェイルセーフ・SoC 評価の単体テスト**
   - `vitest.config.ts`, `tests/poll-evaluator.test.ts`

6. **feat: /api/control（Auth モック・PIN・SoC ガード・operation_logs）**
   - `src/lib/auth-mock.ts`, `src/app/api/control/route.ts`

7. **feat: ダッシュボード・履歴・ログ UI**
   - `src/app/dashboard/page.tsx`, `src/app/history/page.tsx`, `src/app/logs/page.tsx`

8. **chore: DevX（README・scripts・health・コメント）**
   - `README.md`, `package.json` scripts, `src/app/api/health/route.ts`
   - 各 API の Vercel Cron 説明コメントは既にコード内に記載済み

E2E（Cypress）は後回しで問題ありません。
