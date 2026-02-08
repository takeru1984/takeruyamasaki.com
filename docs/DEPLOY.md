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

## 7. Emergency Recovery (緊急時の対応フロー)

直APIが `8521` 等で停止し、解決しない場合の最終手段：

### 7.1 キーの再発行と反映
1. ポータル（SPEC.md 参照）で **Secret Key の再生成 (Refresh)** を行う。
2. Vercel の Environment Variables で値を更新。
3. `npx vercel env pull` でローカルを同期し、`scripts/verify-ecoflow-node.mjs` で `code=0` を確認。
4. Production を再デプロイ。

### 7.2 Worker フォールバックへの暫定復旧
直APIの問題が解決するまで、Cloudflare Worker 経由を優先させる場合：
- Vercel の環境変数に `ECOFLOW_USE_WORKER_FIRST=1` を設定。
- これにより、故障していない Worker システム（あれば）が優先されます。

### 7.3 リージョンの変更
- `ECOFLOW_REGION` を `eu` ↔ `us` で切り替えてホストを変更し、疎通を確認。
