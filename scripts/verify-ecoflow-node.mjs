#!/usr/bin/env node
/**
 * EcoFlow Direct API 検証 - Node で署名生成し fetch
 * ecoflow.ts と同じロジックで署名を作成
 * 実行: node --env-file=.env.local scripts/verify-ecoflow-node.mjs
 * または: export $(grep -v '^#' .env.local | xargs) && node scripts/verify-ecoflow-node.mjs
 */
import { createHmac } from "crypto";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local manually (Node < 20.6 has no --env-file)
try {
  const envPath = resolve(process.cwd(), ".env.local");
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
} catch {}

const accessKey = (process.env.ECOFLOW_ACCESS_KEY ?? "").trim();
const secretKey = (process.env.ECOFLOW_SECRET_KEY ?? "").trim();
const deviceSn = (process.env.ECOFLOW_DEVICE_SN ?? "").trim();
const region = (process.env.ECOFLOW_REGION ?? "eu").toLowerCase();

if (!accessKey || !secretKey || !deviceSn) {
  console.error("Error: ECOFLOW_ACCESS_KEY, ECOFLOW_SECRET_KEY, ECOFLOW_DEVICE_SN を .env.local に設定してください");
  process.exit(1);
}

const REGION_HOSTS = { us: "https://api-a.ecoflow.com", a: "https://api-a.ecoflow.com", eu: "https://api-e.ecoflow.com", e: "https://api-e.ecoflow.com" };
// 検証用: ECOFLOW_API_HOST で上書き可能
const host = process.env.ECOFLOW_API_HOST ?? REGION_HOSTS[region] ?? "https://api.ecoflow.com";

const nonce = String(Math.floor(100000 + Math.random() * 900000));
const timestamp = String(Date.now());
// 署名: accessKey, nonce, timestamp のみ（sn は query のみで base string に含めない）
const baseString = `accessKey=${accessKey}&nonce=${nonce}&timestamp=${timestamp}`;
const sign = createHmac("sha256", secretKey).update(baseString).digest("hex").toLowerCase();

const url = `${host}/iot-open/sign/device/quota/all?sn=${encodeURIComponent(deviceSn)}`;
console.log("Host:", host);
console.log("Base string (masked):", `accessKey=***&nonce=${nonce}&timestamp=${timestamp}`);
console.log("");

const res = await fetch(url, {
  method: "GET",
  headers: {
    "Content-Type": "application/json",
    accessKey,
    nonce,
    timestamp,
    sign,
  },
});

const text = await res.text();
console.log("HTTP Status:", res.status);
console.log("Response:", text);

try {
  const json = JSON.parse(text);
  if (json.code === 0 || json.code === "0") {
    console.log("\n✅ Success: code=0");
    process.exit(0);
  } else {
    console.log("\n❌ Error:", json.message ?? json.code);
    process.exit(1);
  }
} catch {
  process.exit(1);
}
