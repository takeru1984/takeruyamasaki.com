# Post-Deploy Verification 手順

本ドキュメントは、デプロイ後の動作確認およびトラブルシューティングの手順をまとめた最新版です。

---

## 1. デプロイ直後の確認（404・未デプロイ時の対応）

デプロイ先 URL にアクセスして **404 DEPLOYMENT_NOT_FOUND** が発生する場合、ビルドがまだ完了していないか、プロジェクトがスタックしている可能性があります。

### 強制再デプロイの手順
1. **空コミットのプッシュ**:
   ```bash
   git commit --allow-empty -m "Chore: trigger deployment"
   git push origin main
   ```
2. **Vercel CLI での強制デプロイ**:
   ```bash
   vercel --prod
   ```

> [!NOTE]  
> 独自ドメイン（例: `ecoflow.takeruyamasaki.com`）を割り当てる場合は、Vercel Dashboard の **Settings > Domains** で設定し、DNS レコードが反映されていることを確認してください。

---

## 2. 実稼働後の検証ステップ

### 2.1 画面表示とガード表示の確認
ブラウザで各ページを確認します。DB設定が不完全な場合はガード（警告）が表示されます。

| パス | 確認内容 | 期待結果（正常時） | DB未設定時の挙動 |
|---|---|---|---|
| `/dashboard` | メイン画面 | SoC（%）、SwitchBot状態、直近履歴 | 「DB not configured」警告を表示。データは「—」またはスタブ値を表示。 |
| `/history` | 履歴一覧 | 過去の記録がリスト表示される。 | 警告が表示され、リストは空。 |
| `/logs` | 操作ログ | システム操作の記録が表示される。 | 警告が表示され、ログは空。 |

### 2.2 /api/poll (Cron) の手動実行確認
Vercel Cron の動作を確認するため、手動でリクエストを送信します。

```bash
# .env.local からシークレットを読み込んで実行
if [ -f .env.local ]; then export $(grep -v '^#' .env.local | xargs); fi

curl -i -X GET \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "https://<YOUR_URL>/api/poll"
```

**期待レスポンス (`200 OK`)**:
```json
{
  "ok": true,
  "failSafeTriggered": false,
  "ecoflowSoc": 80,
  "switchbotState": "ON",
  "pollFailureCount": 0
}
```

---

## 3. Vercel Cron (Pro プラン) の設定

Vercel の Cron Jobs 機能を利用するには **Pro プラン** 以上が必要です。

1. **vercel.json**: `crons` 項目が含まれていることを確認（設定済み）。
2. **プロジェクト設定**: Vercel Dashboard > Settings > Cron Jobs にて、`/api/poll` が登録されていることを確認。
3. **実行周期**: デフォルトでは 2分間隔（`*/2 * * * *`）で設定されています。

---

## 4. 環境変数・シークレット管理

### 4.1 CRON_SECRET の再生成・反映
1. **生成**: `openssl rand -base64 32`
2. **Vercel反映**: Dashboard > Settings > Environment Variables で `CRON_SECRET` を更新。
3. **ローカル反映**: `.env.local` を更新。

---

## 5. トラブルシューティング

- **DB not configured**: Vercel Storage で Postgres を接続し、環境変数が注入されているか確認してください。
- **401 Unauthorized**: 送信した `Bearer` トークンが Vercel 上の `CRON_SECRET` と一致しているか再確認してください。
- **データ不更新**: Vercel の **Logs** タブで `/api/poll` のログを確認してください。失敗時はフェイルセーフ（充電器ON維持）が発動します。
