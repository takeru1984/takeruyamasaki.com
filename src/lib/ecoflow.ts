/**
 * EcoFlow REST API client (fetch wrapper).
 * Uses ECOFLOW_ACCESS_KEY, ECOFLOW_SECRET_KEY, ECOFLOW_DEVICE_SN.
 * Reference: EcoFlow Open API / device data endpoints.
 */

export type EcoFlowSnapshot = {
  soc: number;
  wattsIn: number;
  wattsOut: number;
  raw: unknown;
};

const ECOFLOW_BASE = "https://api.ecoflow.com";

export async function fetchEcoFlowSnapshot(): Promise<EcoFlowSnapshot> {
  const accessKey = process.env.ECOFLOW_ACCESS_KEY;
  const secretKey = process.env.ECOFLOW_SECRET_KEY;
  const deviceSn = process.env.ECOFLOW_DEVICE_SN;

  if (!accessKey || !secretKey || !deviceSn) {
    throw new Error("EcoFlow env not configured (ECOFLOW_ACCESS_KEY, ECOFLOW_SECRET_KEY, ECOFLOW_DEVICE_SN)");
  }

  // Typical Open API path for device data; adjust if your product uses a different endpoint
  const url = `${ECOFLOW_BASE}/iot-open-api/device/query?sn=${encodeURIComponent(deviceSn)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessKey}`,
      "X-Access-Key": accessKey,
      "X-Secret-Key": secretKey,
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`EcoFlow API error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as Record<string, unknown>;
  // Normalize from common response shapes (socSum, watts in/out fields)
  const dataInner = (data.data as Record<string, unknown>) ?? data;
  const soc = typeof dataInner.soc === "number" ? dataInner.soc
    : typeof (dataInner.socSum as number) === "number" ? (dataInner.socSum as number)
    : 0;
  const wattsIn = typeof dataInner.wattsIn === "number" ? dataInner.wattsIn
    : typeof (dataInner.inputWatts as number) === "number" ? (dataInner.inputWatts as number) : 0;
  const wattsOut = typeof dataInner.wattsOut === "number" ? dataInner.wattsOut
    : typeof (dataInner.outputWatts as number) === "number" ? (dataInner.outputWatts as number) : 0;

  return {
    soc: Math.min(100, Math.max(0, soc)),
    wattsIn,
    wattsOut,
    raw: data,
  };
}
