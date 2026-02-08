#!/bin/bash
# .env.local の ECOFLOW_* を正規化（前後スペース除去）。
# 実行: ./scripts/normalize-env-ecoflow.sh
# 注意: 実行前に .env.local のバックアップを取ること。
set -e
ENV_FILE="${1:-.env.local}"
[ -f "$ENV_FILE" ] || { echo "Error: $ENV_FILE が見つかりません"; exit 1; }
TMP=$(mktemp)
while IFS= read -r line; do
  if [[ "$line" =~ ^(ECOFLOW_ACCESS_KEY|ECOFLOW_SECRET_KEY|ECOFLOW_DEVICE_SN|ECOFLOW_REGION)=(.*)$ ]]; then
    key="${BASH_REMATCH[1]}"
    val="$(echo "${BASH_REMATCH[2]}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
    echo "${key}=${val}"
  else
    echo "$line"
  fi
done < "$ENV_FILE" > "$TMP"
mv "$TMP" "$ENV_FILE"
echo "Done: $ENV_FILE の ECOFLOW_* を正規化しました"
