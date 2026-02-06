/**
 * Poll service: fetch EcoFlow + SwitchBot, evaluate safety, persist, and optionally
 * trigger fail-safe (SwitchBot ON + operation_log + notification stub).
 * Used by /api/poll (Vercel Cron only). See docs/SCHEMA.md and docs/SAFETY.md.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireDbConfigured } from "@/lib/env-status";
import { config } from "@/lib/config";
import { fetchEcoFlowSnapshot } from "@/lib/ecoflow";
import {
  getSwitchBotPlugState,
  setSwitchBotPlugState,
  type SwitchBotPlugState,
} from "@/lib/switchbot";
import { sendAlert } from "@/lib/notify";

const FAILURE_THRESHOLD = config.pollFailureThreshold;
const TARGET_PLUG = "switchbot_plug_1";

export type PollResult = {
  ok: boolean;
  failSafeTriggered?: boolean;
  reason?: string;
  ecoflowSoc?: number;
  switchbotState?: SwitchBotPlugState;
  pollFailureCount?: number;
}

async function ensureSystemStatus() {
  const one = await prisma.systemStatus.findUnique({ where: { id: 1 } });
  if (!one) {
    await prisma.systemStatus.create({
      data: {
        id: 1,
        pollFailureCount: 0,
      },
    });
  }
}

export type ForceChargeOptions = {
  reason: string;
  isAuto: boolean;
  alertSlug: "low_soc_caution" | "low_soc_critical" | "low_soc_panic" | "poll_failure" | "api_fatal_error";
  currentSoc?: number;
}

async function forceChargeOn(opts: ForceChargeOptions): Promise<void> {
  const deviceId = config.switchbot.plugDeviceId();
  const payload = {
    timestamp: new Date().toISOString(),
    reason: opts.reason,
    currentSoc: opts.currentSoc,
    deviceId: deviceId ?? undefined,
    actionTaken: "SwitchBot.turnOn()",
  };

  if (!deviceId) return;

  const { ok, raw } = await setSwitchBotPlugState(deviceId, true);
  await prisma.operationLog.create({
    data: {
      actorId: "system",
      action: "CHARGE_ON",
      target: TARGET_PLUG,
      reason: opts.reason,
      isAuto: opts.isAuto,
      details: { apiOk: ok, raw: JSON.parse(JSON.stringify(raw ?? {})) } as Prisma.InputJsonValue,
    },
  });

  let slug = opts.alertSlug;
  if (!ok) {
    slug = "api_fatal_error";
  }
  await sendAlert(slug, payload);
}

export async function runPoll(): Promise<PollResult> {
  requireDbConfigured();
  await ensureSystemStatus();

  const status = await prisma.systemStatus.findUnique({ where: { id: 1 } });
  const currentFailureCount = status?.pollFailureCount ?? 0;

  // 1) Consecutive failure threshold: bypass normal flow, force ON
  if (currentFailureCount >= FAILURE_THRESHOLD) {
    await forceChargeOn({
      reason: `Poll failure count >= ${FAILURE_THRESHOLD} (fail-safe)`,
      isAuto: true,
      alertSlug: "poll_failure",
    });
    return {
      ok: false,
      failSafeTriggered: true,
      reason: "poll_failure_threshold",
      pollFailureCount: currentFailureCount,
    };
  }

  try {
    const [eco, plugState] = await Promise.all([
      fetchEcoFlowSnapshot(),
      config.switchbot.plugDeviceId()
        ? getSwitchBotPlugState(config.switchbot.plugDeviceId()).catch(() => "UNKNOWN" as SwitchBotPlugState)
        : Promise.resolve("UNKNOWN" as SwitchBotPlugState),
    ]);

    const now = new Date();
    await prisma.deviceState.createMany({
      data: [
        {
          collectedAt: now,
          source: "ecoflow",
          soc: eco.soc,
          wattsIn: eco.wattsIn,
          wattsOut: eco.wattsOut,
          switchbotState: null,
          rawPayload: JSON.parse(JSON.stringify(eco.raw ?? {})) as Prisma.InputJsonValue,
        },
        ...(config.switchbot.plugDeviceId()
          ? [{
              collectedAt: now,
              source: "switchbot",
              soc: null,
              wattsIn: null,
              wattsOut: null,
              switchbotState: plugState,
              rawPayload: {} as Prisma.InputJsonValue,
            }]
          : []),
      ],
    });

    await prisma.systemStatus.update({
      where: { id: 1 },
      data: {
        lastPollAt: now,
        pollFailureCount: 0,
        lastSuccessSoc: eco.soc,
      },
    });

    const socCriticalMin = config.socCriticalMin();
    const socCautionMin = config.socCautionMin();
    const socPanicMin = config.socPanicMin();

    if (eco.soc <= socCriticalMin && plugState !== "ON") {
      const alertSlug = eco.soc <= socPanicMin ? "low_soc_panic" : "low_soc_critical";
      await forceChargeOn({
        reason: `SoC ${eco.soc}% <= ${alertSlug === "low_soc_panic" ? "panic" : "critical"} min`,
        isAuto: true,
        alertSlug,
        currentSoc: eco.soc,
      });
      return {
        ok: true,
        failSafeTriggered: true,
        reason: alertSlug,
        ecoflowSoc: eco.soc,
        switchbotState: plugState,
        pollFailureCount: 0,
      };
    }
    if (eco.soc <= socCautionMin && plugState !== "ON") {
      await forceChargeOn({
        reason: `SoC ${eco.soc}% <= caution min ${socCautionMin}%`,
        isAuto: true,
        alertSlug: "low_soc_caution",
        currentSoc: eco.soc,
      });
      return {
        ok: true,
        failSafeTriggered: true,
        reason: "low_soc_caution",
        ecoflowSoc: eco.soc,
        switchbotState: plugState,
        pollFailureCount: 0,
      };
    }

    return {
      ok: true,
      ecoflowSoc: eco.soc,
      switchbotState: plugState,
      pollFailureCount: 0,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const newCount = currentFailureCount + 1;
    await prisma.systemStatus.update({
      where: { id: 1 },
      data: {
        pollFailureCount: newCount,
      },
    }).catch(() => {});

    if (newCount >= FAILURE_THRESHOLD) {
      await forceChargeOn({
        reason: `Poll error and failure count >= ${FAILURE_THRESHOLD}: ${message}`,
        isAuto: true,
        alertSlug: "poll_failure",
      });
      return {
        ok: false,
        failSafeTriggered: true,
        reason: "poll_error_then_threshold",
        pollFailureCount: newCount,
      };
    }

    return {
      ok: false,
      reason: message,
      pollFailureCount: newCount,
    };
  }
}
