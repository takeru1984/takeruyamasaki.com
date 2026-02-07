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

### 5.1 LINE 通知とメール通知の運用
- **LINE が不通のとき**（Vercel Production から `notify-api.line.me` へ DNS ENOTFOUND 等で到達できない場合）は、`LINE_NOTIFY_TOKEN` を Vercel の Environment Variables から **削除または空** にし、Production を再デプロイする。
- `LINE_NOTIFY_TOKEN` が空なら LINE 通知は **スキップ** され、メール（`RESEND_API_KEY` + `ALERT_EMAIL_TO`）のみが使用される。メールが未設定の場合はアラートは届かないが、`/api/poll` の成否には影響しない。
- メール設定を優先して整えたうえで、必要に応じて LINE を再有効化する。

---

## 6. EcoFlow Direct API 手動検証 (curl)

署名エラー (8521) 等が発生する場合、以下のコマンドで手動リクエストを組み立てて検証できます。docs/SPEC.md 準拠（HMAC-SHA256, UTC ms timestamp, nonce, sorted params）。

```bash
# .env.local から読み込み、または手動設定
if [ -f .env.local ]; then export $(grep -v '^#' .env.local | xargs); fi
ACCESS_KEY="${ECOFLOW_ACCESS_KEY}"
SECRET_KEY="${ECOFLOW_SECRET_KEY}"
DEVICE_SN="${ECOFLOW_DEVICE_SN}"

# timestamp = UTC ミリ秒 (Date.now() 相当)
TIMESTAMP=$(node -e "console.log(Date.now())")
NONCE="$(node -e "console.log(Math.floor(100000+Math.random()*900000))")"

# 署名用 base string: アルファベット順 (accessKey, nonce, timestamp)
# 注意: sn パラメータは署名に含めません
base_string="accessKey=${ACCESS_KEY}&nonce=${NONCE}&timestamp=${TIMESTAMP}"

# HMAC-SHA256(secret, base_string) → 小文字 hex
SIGN=$(echo -n "$base_string" | openssl dgst -sha256 -hmac "$SECRET_KEY" | sed 's/^.* //')

# リクエスト (地域: api-a=US, api-e=EU, api=default)
curl -i -X GET \
  -H "accessKey: ${ACCESS_KEY}" \
  -H "nonce: ${NONCE}" \
  -H "timestamp: ${TIMESTAMP}" \
  -H "sign: ${SIGN}" \
  -H "Content-Type: application/json" \
  "https://api-e.ecoflow.com/iot-open/sign/device/quota/all?sn=${DEVICE_SN}"
```

成功時は `"code":0` と `data` が返ります。その後 `/api/poll` を呼び、`ok:true` になることを確認してください。

### 主なエラーコードと対策
- **8521 (Signature Error)**: 認証情報または署名の不一致。以下を確認:
  - EcoFlow デベロッパーポータル (developer.ecoflow.com または developer-eu.ecoflow.com) で accessKey/secretKey が有効か
  - アプリとデバイス SN が紐づいているか
  - `.env` の値に余分な空白・改行が含まれていないか（`trim` 済み）
  - `base_string` は accessKey, nonce, timestamp のみ（sn は除外）、HMAC は小文字 HEX
- **8524 (Timestamp Error)**: サーバー時刻とのズレ（15分以上で発生）。Vercel サーバー時刻は NTP 同期済みの想定。
- **404 (Not Found)**: `sn` の誤り、またはホスト地域（api-a/api-e/api）の不一致。

### 補助スクリプト
- `scripts/verify-ecoflow-curl.sh`: 署名付き curl を実行（リージョン対応）
- `scripts/verify-ecoflow-node.mjs`: Node で署名生成＋ fetch 検証

Worker フォールバックを無効にして直接 API のエラーを確認する場合:
```bash
# .env.local に追加
ECOFLOW_DIRECT_API_ONLY=1
```

---

## 7. 検証チェック項目（最終確認用）

| 項目 | 結果 | 備考 |
|------|------|------|
| 署名付き curl で code=0 | 要確認 | 上記 curl または scripts/verify-ecoflow-curl.sh で検証 |
| /api/poll で ok:true | 要確認 | EcoFlow API 成功時に限る |
| DB に最新ポーリングデータ | 要確認 | device_state テーブル、/dashboard で表示 |
| LINE 通知（有効時） | 要確認 | `LINE_NOTIFY_TOKEN` 設定時 |
| メール通知（有効時） | 要確認 | `RESEND_API_KEY` 設定時 |
| LINE 未設定で正常動作 | 要確認 | トークンプライバシー設定または削除時のスキップ確認 |
| lint パス | ✅ | `npm run lint` |
| test パス | ✅ | `npm run test` |

---

## 8. フェイルセーフ（連続失敗）からの復旧フロー

API取得に連続して失敗（デフォルト3回）すると、安全のため充電器が **強制ON** 状態にロックされ、通知が飛びます。復旧手順は以下の通りです。

1. **原因の特定**:
   - Vercel Logs で `/api/poll` のエラー内容を確認。
   - 上記セクション 6 の `curl` コマンドを実行し、直APIが `code:0` を返すか確認。
2. **正常性の確認**:
   - `curl` または `/api/poll` 手動実行で `ok:true` を確認。
3. **カウンタのリセット**:
   - `/api/poll` が成功すると、データベースの `poll_failure_count` は自動的に `0` にリセットされます。
4. **ダッシュボードの確認**:
   - `/dashboard` にアクセスし、警告バナーが消え、最新の SoC が表示されていることを確認。
   - 必要に応じて `charge_off` を手動実行し、自動モードに復帰させる。

5. **失敗カウントの手動リセット（テスト用）**:
   - `npx prisma studio` で `system_status` の `poll_failure_count` を 0 に更新。
