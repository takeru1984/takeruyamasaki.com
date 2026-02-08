#!/usr/bin/env node
/**
 * .env.local と .vercel/.env.production.local の EcoFlow 変数を比較。
 * 値は表示せず、一致/不一致と文字数・前後スペースの有無のみ報告。
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnv(path) {
  const obj = {};
  try {
    const content = readFileSync(resolve(process.cwd(), path), "utf8");
    for (const line of content.split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) {
        const k = m[1].trim();
        const v = m[2];
        obj[k] = { raw: v, trimmed: v.trim(), len: v.length, hasLeadingSpace: /^\s/.test(v), hasTrailingSpace: /\s$/.test(v) };
      }
    }
  } catch (e) {
    return null;
  }
  return obj;
}

const keys = ["ECOFLOW_ACCESS_KEY", "ECOFLOW_SECRET_KEY", "ECOFLOW_DEVICE_SN", "ECOFLOW_REGION"];
const local = loadEnv(".env.local");
const prod = loadEnv(".vercel/.env.production.local");

if (!local) {
  console.error("Error: .env.local が読めません");
  process.exit(1);
}
if (!prod) {
  console.error("Error: .vercel/.env.production.local が読めません (vercel env pull を実行してください)");
  process.exit(1);
}

let allMatch = true;
for (const k of keys) {
  const l = local[k];
  const p = prod[k];
  if (!l && !p) {
    console.log(`${k}: 両方とも未設定`);
  } else if (!l) {
    console.log(`${k}: .env.local に未設定 (Vercel には存在)`);
    allMatch = false;
  } else if (!p) {
    console.log(`${k}: Vercel に未設定 (.env.local には存在)`);
    allMatch = false;
  } else {
    const match = l.trimmed === p.trimmed;
    const localIssues = [];
    if (l.hasLeadingSpace || l.hasTrailingSpace) localIssues.push("前後にスペース");
    const prodIssues = [];
    if (p.hasLeadingSpace || p.hasTrailingSpace) prodIssues.push("前後にスペース");
    const status = match ? "一致" : "不一致";
    if (!match) allMatch = false;
    console.log(`${k}: ${status} | .env.local len=${l.len} ${localIssues.join(" ")} | Vercel len=${p.len} ${prodIssues.join(" ")}`);
  }
}
process.exit(allMatch ? 0 : 1);
