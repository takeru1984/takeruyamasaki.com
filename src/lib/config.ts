function getEnvOptional(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

function getEnvInt(key: string, defaultValue: number): number {
  const v = process.env[key];
  if (v === undefined || v === "") return defaultValue;
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return defaultValue;
  return n;
}

export const config = {
  // Cron: only Vercel Cron (or caller with CRON_SECRET) may call /api/poll
  cronSecret: () => getEnvOptional("CRON_SECRET", ""),

  // EcoFlow
  ecoflow: {
    accessKey: () => getEnvOptional("ECOFLOW_ACCESS_KEY", ""),
    secretKey: () => getEnvOptional("ECOFLOW_SECRET_KEY", ""),
    deviceSn: () => getEnvOptional("ECOFLOW_DEVICE_SN", ""),
  },

  // SwitchBot
  switchbot: {
    token: () => getEnvOptional("SWITCHBOT_TOKEN", ""),
    secret: () => getEnvOptional("SWITCHBOT_SECRET", ""),
    plugDeviceId: () => getEnvOptional("SWITCHBOT_PLUG_DEVICE_ID", ""),
  },

  // Safety thresholds (docs/SAFETY.md, docs/ALERTING.md)
  socSafeMin: () => getEnvInt("SOC_SAFE_MIN", 40),
  socCautionMin: () => getEnvInt("SOC_CAUTION_MIN", 35),
  socCriticalMin: () => getEnvInt("SOC_CRITICAL_MIN", 25),
  socPanicMin: () => getEnvInt("SOC_PANIC_MIN", 15),

  // Fail-safe: consecutive poll failures before forcing charger ON
  pollFailureThreshold: 3,
} as const;
