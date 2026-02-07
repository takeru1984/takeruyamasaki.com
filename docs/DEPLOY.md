# Deployment Playbook

この手順書は、EcoFlow Dashboard MVP を GitHub + Vercel にデプロイするための最小ステップをまとめたものです。

## 1. Git 初期化と初回コミット
リポジトリ直下で以下を実行してください。

```bash
cd /Users/takeru/Library/CloudStorage/GoogleDrive-takeru@cloudnine.llc/共有ドライブ/Cloudnine/02_Coding/05_ECOFLOW\ Dashboard
rm -rf .git            # すでにGitが設定されている場合のみ（なければ不要）
git init
cp .env.example .env.local  # ローカル検証用（既にある場合は不要）
git add .
git commit -m "chore: bootstrap EcoFlow dashboard MVP"
```

> **注意**: `node_modules` や `.env.local` は `.gitignore` 済み。commit 前に `git status` で余計なファイルが入っていないか確認してください。

## 2. GitHub リポジトリ作成 & push
1. GitHub にログイン → "New repository" から空のリポジトリ（例: `ecoflow-dashboard`）を作成
2. 作成画面に表示されるリモートURLを使って push

```bash
git remote add origin git@github.com:<your-account>/ecoflow-dashboard.git
git branch -M main
git push -u origin main
```

> HTTPS を使う場合は `git remote add origin https://github.com/<your-account>/ecoflow-dashboard.git` を利用。

## 3. Vercel プロジェクト作成
1. [Vercel](https://vercel.com/) にログイン
2. ダッシュボード右上 "New Project" → GitHub 連携済みなら先ほど作成したリポジトリを選択
3. Import 画面で `Framework = Next.js` が自動判定される。必要に応じて `Build Command`/`Output Directory` はデフォルトのままでOK

## 4. 環境変数設定（GUI）
Vercel の *Project Settings → Environment Variables* で `.env.example` にあるキーを1つずつ登録します。
- `ECOFLOW_ACCESS_KEY`, `ECOFLOW_SECRET_KEY`, `ECOFLOW_DEVICE_SN`
- `SWITCHBOT_TOKEN`, `SWITCHBOT_SECRET`, `SWITCHBOT_PLUG_DEVICE_ID`
- `LINE_NOTIFY_TOKEN`, `RESEND_API_KEY`, `SMTP_FROM`, `ALERT_EMAIL_TO`
- `CRON_SECRET`, `APP_PIN_HASH`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
- `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`
- `SOC_SAFE_MIN`, `SOC_CAUTION_MIN`, `SOC_CRITICAL_MIN`, `SOC_PANIC_MIN`, `POLL_INTERVAL_MIN`

Preview/Production それぞれの環境に同じ値が必要です。

## 5. Vercel Cron で `/api/poll` を 2分間隔に設定
- `vercel.json` には既に `"crons": [{"path": "/api/poll", "schedule": "*/2 * * * *"}]` が定義されています。
- Vercel ダッシュボードの *Cron Jobs* セクションでパスと頻度を確認し、必要に応じて `CRON_SECRET` を合わせる。

## 6. デプロイ確認
1. `Deploy` を実行し、ログにエラーが無いことを確認
2. デプロイ完了後、`https://<project>.vercel.app/dashboard` にアクセスし、モックPINで操作ができるかチェック
3. `curl https://<project>.vercel.app/api/poll -H "Authorization: Bearer <CRON_SECRET>"` を実行し、DBにレコードが生成されるか確認
4. LINE/Email 通知が届くかをテスト（必要なら `.env.local` でも同じ値でローカル検証）

## 7. トラブルシューティング
- Prismaエラー: `POSTGRES_*` の値が間違っていないか確認し、`npm run db:push` をローカルで実行して再デプロイ
- Cron 401: `CRON_SECRET` が Vercel設定と `.env` で一致しているかを確認
- **EcoFlow 8521 (Signature Error)**: 署名生成時に `sn`（シリアル番号）を含めていないか確認してください。署名対象は `accessKey`, `nonce`, `timestamp` のみです。
- **LINE 通知が失敗する/環境的に不通**: Vercel から LINE API への接続エラー (`ENOTFOUND` 等) が発生する場合、Vercel Dashboard の Environment Variables から `LINE_NOTIFY_TOKEN` を削除（または値を空に）して再デプロイしてください。システムは LINE をスキップしてメール通知を優先します。
- 通知が届かない: `operation_logs` と `notifications` テーブルで suppression/送信結果を確認し、トークン/メールAPIキーを再度チェック

以上で GitHub ↔ Vercel デプロイの基本フローは完了です。
