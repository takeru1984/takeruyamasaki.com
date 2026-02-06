# Post-Deploy Verification レポート

**検証日時**: 2025-02-06  
**対象URL**: https://takeruyamasaki-com.vercel.app

---

## 1. 現状の結果

### HTTP レスポンス

| パス | HTTPステータス | 備考 |
|------|----------------|------|
| `/` | 404 | ボディ: `DEPLOYMENT_NOT_FOUND` |
| `/dashboard` | 404 | ルート404のため HTML 取得不可 |
| `/history` | 404 | 同上 |
| `/logs` | 404 | 同上 |
| `/api/health` | 404 | 同上 |
| `/api/poll` | 404 | curl 例を実施する前提で要デプロイ |

### 判定

**`takeruyamasaki-com.vercel.app` は現時点で DEPLOYMENT_NOT_FOUND（404）を返しています。**

- EcoFlow Dashboard プロジェクトがこのドメインにデプロイされていない
- または、別の Vercel プロジェクト（例: ポートフォリオサイト）がこのドメインを占有している可能性

---

## 2. デプロイ後の検証手順

デプロイが完了し、URL が有効になったら以下を実行してください。

### 2.1 ページ取得確認

```bash
# ダッシュボード
curl -s -w "\nHTTP:%{http_code}" https://<YOUR_DEPLOYMENT_URL>/dashboard | tail -20

# 履歴
curl -s -w "\nHTTP:%{http_code}" https://<YOUR_DEPLOYMENT_URL>/history | tail -20

# ログ
curl -s -w "\nHTTP:%{http_code}" https://<YOUR_DEPLOYMENT_URL>/logs | tail -20
```

**確認項目**:
- HTTP 200 が返ること
- HTML に「ダッシュボード」「履歴」「操作ログ」などの主要セクションが含まれること
- エラーメッセージや missing データが表示されていないこと

### 2.2 /api/poll 実行

`.env.local` または Vercel 環境変数に設定した `CRON_SECRET` を使用:

```bash
# CRON_SECRET を環境変数から読み込んで実行
source .env.local 2>/dev/null || true
curl -s -w "\nHTTP:%{http_code}" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "https://<YOUR_DEPLOYMENT_URL>/api/poll"
```

**期待レスポンス例**:
```json
{"ok":true,"failSafeTriggered":false,"ecoflowSoc":80,"switchbotState":"ON","pollFailureCount":0}
```
または（API未設定時）:
```json
{"ok":false,"reason":"EcoFlow env not configured...","pollFailureCount":1}
```

**DB 確認**:
- Vercel Postgres (Prisma Studio または `psql`) で以下を確認:
  - `system_status`: `last_poll_at` が更新されている
  - `device_state`: 新規レコードが追加されている（EcoFlow/SwitchBot API が有効な場合）
  - `operation_logs`: フェイルセーフ時は `CHARGE_ON` が記録されている

### 2.3 Vercel Cron 設定確認

Vercel ダッシュボード（Pro プラン）で以下を確認:

1. **Project** → **Settings** → **Cron Jobs**
2. `/api/poll` が `*/2 * * * *` (2分ごと) で登録されていること
3. **Environment Variables** に `CRON_SECRET` が設定され、その値が curl で使用する値と一致していること

`vercel.json` の内容:
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

---

## 3. .env.local の現状（検証時点）

- `CRON_SECRET=REPLACE_ME_RANDOM_LONG_STRING` のままのため、本番では必ずランダムな文字列に置換すること
- Vercel の環境変数にも同じ値を設定すること
- `POSTGRES_*` が `REPLACE_ME_*` の場合は、Vercel Postgres の接続情報で上書きすること

---

## 4. 次のアクション

1. **EcoFlow Dashboard のデプロイ**
   - 別 Vercel プロジェクトとして作成するか、`takeruyamasaki-com.vercel.app` のプロジェクトにこのリポジトリを接続
   - デプロイ後に上記 2.1〜2.3 を再実行

2. **環境変数の設定**
   - Vercel Project Settings → Environment Variables で全変数を設定
   - `CRON_SECRET` を必ず本番用の値に変更

3. **Cron の有効化**
   - Pro プランで Cron Jobs が有効か確認
   - 初回は手動で `/api/poll` を curl 実行して動作確認してから Cron に任せる
