/**
 * EcoFlow REST API client.
 * Uses ECOFLOW_ACCESS_KEY, ECOFLOW_SECRET_KEY, ECOFLOW_DEVICE_SN.
 * Implements EcoFlow Open API per docs/SPEC.md: HMAC-SHA256, UTC ms timestamp,
 * nonce, sorted params. Region: api-a (US), api-e (EU), api (default).
 */

import { createHmac } from "crypto";

export type EcoFlowSnapshot = {
  soc: number;
  wattsIn: number;
  wattsOut: number;
  raw: unknown;
};

/** Structured error for EcoFlow API (8521 signature, 8524 timestamp, etc.) */
export class EcoFlowApiError extends Error {
  constructor(
    message: string,
    public readonly code?: number | string,
    public readonly ecoflowMessage?: string
  ) {
    super(message);
    this.name = "EcoFlowApiError";
  }
}

const REGION_HOSTS: Record<string, string> = {
  us: "https://api-a.ecoflow.com",
  a: "https://api-a.ecoflow.com",
  eu: "https://api-e.ecoflow.com",
  e: "https://api-e.ecoflow.com",
  default: "https://api.ecoflow.com",
};

function generateNonce(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getHost(): string {
  const region = (process.env.ECOFLOW_REGION ?? "").toLowerCase();
  if (region && REGION_HOSTS[region]) return REGION_HOSTS[region];
  const override = process.env.ECOFLOW_API_HOST ?? process.env.ECOFLOW_API_HOSTS?.split(",")[0]?.trim();
  if (override) return override;
  return REGION_HOSTS.default;
}

/** Build signature base string: accessKey, nonce, timestamp only (sn is query-only, excluded from sign). */
function buildSignBaseString(accessKey: string, nonce: string, timestamp: string): string {
  return `accessKey=${accessKey}&nonce=${nonce}&timestamp=${timestamp}`;
}

function hmacSha256Hex(secret: string, baseString: string): string {
  return createHmac("sha256", secret).update(baseString).digest("hex").toLowerCase();
}

function extractNumber(obj: Record<string, unknown>, ...paths: string[]): number {
  for (const path of paths) {
    let cur: unknown = (obj as Record<string, unknown>)[path];
    if (cur == null) {
      const segments = path.split(".");
      cur = obj;
      for (const seg of segments) {
        if (cur == null || typeof cur !== "object") break;
        cur = (cur as Record<string, unknown>)[seg];
      }
    }
    if (typeof cur === "number") return cur;
    if (typeof cur === "string") {
      const n = parseFloat(cur);
      if (!Number.isNaN(n)) return n;
    }
  }
  return 0;
}

async function fetchViaWorker(): Promise<EcoFlowSnapshot> {
  const url = process.env.WORKER_URL;
  const token = process.env.WORKER_AUTH_TOKEN;
  if (!url || !token) throw new EcoFlowApiError("Worker not configured");

  const res = await fetch(url.replace(/\/+$/, ""), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  if (!res.ok) throw new EcoFlowApiError(`Worker HTTP ${res.status}: ${text.slice(0, 150)}`);

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new EcoFlowApiError(`Worker invalid JSON: ${text.slice(0, 150)}`);
  }

  return parseEcoFlowSnapshotFromResponse(json);
}

async function fetchViaDirectApi(): Promise<EcoFlowSnapshot> {
  const accessKey = process.env.ECOFLOW_ACCESS_KEY;
  const secretKey = process.env.ECOFLOW_SECRET_KEY;
  const deviceSn = process.env.ECOFLOW_DEVICE_SN;

  if (!accessKey || !secretKey || !deviceSn) {
    throw new EcoFlowApiError(
      "EcoFlow env not configured (ECOFLOW_ACCESS_KEY, ECOFLOW_SECRET_KEY, ECOFLOW_DEVICE_SN)"
    );
  }

  const nonce = generateNonce();
  const timestamp = String(Date.now());

  const baseString = buildSignBaseString(accessKey, nonce, timestamp);
  const sign = hmacSha256Hex(secretKey, baseString);

  const host = getHost();
  const url = `${host.replace(/\/+$/, "")}/iot-open/sign/device/quota/all?sn=${encodeURIComponent(deviceSn)}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      accessKey,
      nonce,
      timestamp,
      sign,
    },
    signal: AbortSignal.timeout(15000),
  });

  const text = await res.text();
  let json: { code?: number | string; message?: string; errorMsg?: string; success?: boolean; data?: unknown };
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    throw new EcoFlowApiError(`EcoFlow invalid JSON (HTTP ${res.status}): ${text.slice(0, 150)}`);
  }

  const code = json.code;
  const ecoMsg = json.errorMsg ?? json.message;

  if (!res.ok) {
    throw new EcoFlowApiError(`EcoFlow HTTP ${res.status}: ${ecoMsg ?? text.slice(0, 150)}`, code, ecoMsg);
  }

  const ok = code === 0 || code === "0" || json.success === true;
  if (!ok) {
    throw new EcoFlowApiError(`EcoFlow API error: ${ecoMsg ?? String(code ?? "unknown")}`, code, ecoMsg);
  }

  return parseEcoFlowSnapshotFromResponse(json);
}

type EcoFlowApiResponse = {
  code?: number | string;
  message?: string;
  success?: boolean;
  data?: Record<string, unknown> | { data?: Record<string, unknown> };
};

function parseEcoFlowSnapshotFromResponse(json: unknown): EcoFlowSnapshot {
  const typed = json as EcoFlowApiResponse | undefined;
  if (!typed || (typed.code !== 0 && typed.code !== "0" && typed.success !== true)) {
    throw new EcoFlowApiError("Worker/Direct response missing success code");
  }

  const rawData = typed.data;
  if (!rawData || typeof rawData !== "object") {
    throw new EcoFlowApiError("EcoFlow missing data field");
  }

  const inner = (rawData as { data?: Record<string, unknown> }).data ?? (rawData as Record<string, unknown>);

  const soc = extractNumber(inner, "pd.soc", "pd.bpPowerSoc", "soc", "socSum", "bat.soc", "bpSoC");
  const wattsIn = extractNumber(
    inner,
    "pd.inPower",
    "pd.wattsIn",
    "pd.acInPower",
    "pd.dcInPower",
    "wattsIn",
    "inputWatts"
  );
  const wattsOut = extractNumber(
    inner,
    "pd.outPower",
    "pd.acOutPower",
    "pd.dcOutPower",
    "wattsOut",
    "outputWatts"
  );

  return {
    soc: Math.min(100, Math.max(0, soc)),
    wattsIn,
    wattsOut,
    raw: json,
  };
}

/** Returns true when Worker credentials (WORKER_URL + WORKER_AUTH_TOKEN) are set. */
function isWorkerConfigured(): boolean {
  return !!(process.env.WORKER_URL?.trim() && process.env.WORKER_AUTH_TOKEN?.trim());
}

function isDirectConfigured(): boolean {
  return !!(
    process.env.ECOFLOW_ACCESS_KEY?.trim() &&
    process.env.ECOFLOW_SECRET_KEY?.trim() &&
    process.env.ECOFLOW_DEVICE_SN?.trim()
  );
}

export async function fetchEcoFlowSnapshot(): Promise<EcoFlowSnapshot> {
  const workerOk = isWorkerConfigured();
  const directOk = isDirectConfigured();
  const allowDirectFallback = process.env.ECOFLOW_ALLOW_DIRECT_FALLBACK === "1";

  if (workerOk) {
    try {
      return await fetchViaWorker();
    } catch (workerErr) {
      if (allowDirectFallback && directOk) {
        const host = getHost();
        console.warn(
          "[ecoflow] Worker failed, falling back to direct API:",
          (workerErr as Error).message,
          "| fallback host:",
          host
        );
        return await fetchViaDirectApi();
      }
      throw workerErr;
    }
  }

  if (directOk) {
    return await fetchViaDirectApi();
  }

  throw new EcoFlowApiError(
    "EcoFlow not configured (set WORKER_URL+WORKER_AUTH_TOKEN or ECOFLOW_ACCESS_KEY+SECRET_KEY+DEVICE_SN)"
  );
}
