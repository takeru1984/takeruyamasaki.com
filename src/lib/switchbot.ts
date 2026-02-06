/**
 * SwitchBot API v1.0/v1.1 client (fetch wrapper).
 * Uses SWITCHBOT_TOKEN, SWITCHBOT_SECRET (optional for sign), SWITCHBOT_PLUG_DEVICE_ID.
 * Ref: https://github.com/OpenWonderLabs/SwitchBotAPI
 */

const SWITCHBOT_BASE = "https://api.switch-bot.com";
// Status: v1.1; Commands: v1.0 (OpenWonderLabs/SwitchBotAPI)

export type SwitchBotPlugState = "ON" | "OFF" | "UNKNOWN";

export async function getSwitchBotPlugState(deviceId: string): Promise<SwitchBotPlugState> {
  const token = process.env.SWITCHBOT_TOKEN;
  if (!token) {
    throw new Error("SWITCHBOT_TOKEN not configured");
  }

  const res = await fetch(`${SWITCHBOT_BASE}/v1.1/devices/${deviceId}/status`, {
    method: "GET",
    headers: {
      "Authorization": token,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SwitchBot status error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as { body?: { power?: string }; message?: string };
  const power = data.body?.power?.toUpperCase();
  if (power === "ON") return "ON";
  if (power === "OFF") return "OFF";
  return "UNKNOWN";
}

export async function setSwitchBotPlugState(
  deviceId: string,
  on: boolean
): Promise<{ ok: boolean; raw: unknown }> {
  const token = process.env.SWITCHBOT_TOKEN;
  if (!token) {
    throw new Error("SWITCHBOT_TOKEN not configured");
  }

  const res = await fetch(`${SWITCHBOT_BASE}/v1.0/devices/${deviceId}/commands`, {
    method: "POST",
    headers: {
      "Authorization": token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      command: on ? "turnOn" : "turnOff",
      parameter: "default",
      commandType: "command",
    }),
    signal: AbortSignal.timeout(10000),
  });

  const raw = await res.json().catch(() => ({}));
  const ok = res.ok && (raw as { statusCode?: number }).statusCode === 100;
  return { ok, raw };
}
