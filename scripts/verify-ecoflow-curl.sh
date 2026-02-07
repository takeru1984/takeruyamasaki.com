#!/bin/bash
# EcoFlow Direct API 署名付き curl 検証スクリプト
# docs/POST_DEPLOY_VERIFICATION.md セクション6 準拠
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

if [ -f .env.local ]; then
  # shellcheck disable=SC2163
  export $(grep -v '^#' .env.local | xargs)
fi

ACCESS_KEY="${ECOFLOW_ACCESS_KEY}"
SECRET_KEY="${ECOFLOW_SECRET_KEY}"
DEVICE_SN="${ECOFLOW_DEVICE_SN}"
REGION="${ECOFLOW_REGION:-eu}"

if [ -z "$ACCESS_KEY" ] || [ -z "$SECRET_KEY" ] || [ -z "$DEVICE_SN" ]; then
  echo "Error: ECOFLOW_ACCESS_KEY, ECOFLOW_SECRET_KEY, ECOFLOW_DEVICE_SN を .env.local に設定してください"
  exit 1
fi

# リージョン → ホスト (ecoflow.ts と同じ)
case "$(echo "$REGION" | tr '[:upper:]' '[:lower:]')" in
  us|a)  HOST="https://api-a.ecoflow.com" ;;
  eu|e)  HOST="https://api-e.ecoflow.com" ;;
  *)     HOST="https://api.ecoflow.com" ;;
esac

echo "Using host: $HOST (ECOFLOW_REGION=$REGION)"
echo ""

TIMESTAMP=$(node -e "console.log(Date.now())")
NONCE=$(node -e "console.log(Math.floor(100000+Math.random()*900000))")
# 署名: accessKey, nonce, timestamp のみ（sn は query のみで base string に含めない）
base_string="accessKey=${ACCESS_KEY}&nonce=${NONCE}&timestamp=${TIMESTAMP}"
SIGN=$(echo -n "$base_string" | openssl dgst -sha256 -hmac "$SECRET_KEY" | sed 's/^.* //')

echo "Request: GET ${HOST}/iot-open/sign/device/quota/all?sn=***"
echo ""

curl -s -w "\n\nHTTP_STATUS:%{http_code}" -X GET \
  -H "accessKey: ${ACCESS_KEY}" \
  -H "nonce: ${NONCE}" \
  -H "timestamp: ${TIMESTAMP}" \
  -H "sign: ${SIGN}" \
  -H "Content-Type: application/json" \
  "${HOST}/iot-open/sign/device/quota/all?sn=${DEVICE_SN}"
