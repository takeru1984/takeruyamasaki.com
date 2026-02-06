/**
 * POST /api/control
 *
 * SwitchBot 充電 ON/OFF 制御。admin ロール必須。OFF 時は PIN/再認証モック必須。
 * SoC が不明（null または5分以上古い）の場合は charge_off 拒否。overrideLowSoc でも解禁しない。
 * SoC が安全域 (>SOC_SAFE_MIN) で override 指定 + 理由必須 + PIN OK のときのみ OFF 許可。
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { config } from "@/lib/config";
import { setSwitchBotPlugState } from "@/lib/switchbot";
import { getMockAuth, checkPinForOff } from "@/lib/auth-mock";
import { getSocStatus } from "@/lib/soc-status";

const TARGET_PLUG = "switchbot_plug_1";

export const dynamic = "force-dynamic";

type Body = { action?: string; reason?: string; overrideLowSoc?: boolean };

export async function POST(request: Request) {
  const user = getMockAuth(request);
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Auth required" },
      { status: 401 }
    );
  }
  if (user.role !== "admin") {
    return NextResponse.json(
      { error: "Forbidden", message: "Admin role required" },
      { status: 403 }
    );
  }

  let body: Body = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Bad request", message: "JSON body required" },
      { status: 400 }
    );
  }

  const action = body.action === "charge_off" ? "charge_off" : "charge_on";
  const wantOn = action === "charge_on";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const overrideLowSoc = body.overrideLowSoc === true;

  const socStatus = await getSocStatus();
  const { lastSuccessSoc, isUnknown } = socStatus;
  const socSafeMin = config.socSafeMin();
  const socCriticalMin = config.socCriticalMin();

  if (!wantOn) {
    if (!checkPinForOff(request)) {
      return NextResponse.json(
        { error: "Forbidden", message: "PIN or re-auth required for charge_off" },
        { status: 403 }
      );
    }

    if (overrideLowSoc && !reason) {
      return NextResponse.json(
        { error: "Bad request", message: "overrideLowSoc requires non-empty reason" },
        { status: 400 }
      );
    }

    if (isUnknown) {
      return NextResponse.json(
        {
          error: "Rejected",
          message: "SoC data is unknown or stale (>5 min). charge_off not allowed. Ensure polling is healthy.",
        },
        { status: 400 }
      );
    }

    if (lastSuccessSoc !== null && lastSuccessSoc < socCriticalMin) {
      return NextResponse.json(
        {
          error: "Rejected",
          message: `SoC ${lastSuccessSoc}% is below critical ${socCriticalMin}%. OFF not allowed.`,
        },
        { status: 400 }
      );
    }

    if (lastSuccessSoc !== null && lastSuccessSoc < socSafeMin) {
      if (!overrideLowSoc || !reason) {
        return NextResponse.json(
          {
            error: "Rejected",
            message: `SoC ${lastSuccessSoc}% is below safe minimum ${socSafeMin}%. Use overrideLowSoc with reason.`,
          },
          { status: 400 }
        );
      }
    }
  }

  const deviceId = config.switchbot.plugDeviceId();
  if (!deviceId) {
    return NextResponse.json(
      { error: "Config error", message: "SWITCHBOT_PLUG_DEVICE_ID not set" },
      { status: 500 }
    );
  }

  const { ok, raw } = await setSwitchBotPlugState(deviceId, wantOn);
  const logAction = wantOn ? "CHARGE_ON" : "CHARGE_OFF";

  const logDetails: Record<string, unknown> = { apiOk: ok, raw };
  if (!wantOn) {
    logDetails.overrideLowSoc = overrideLowSoc;
    logDetails.staleData = socStatus.isStale;
    if (overrideLowSoc && reason) logDetails.overrideReason = reason;
  }

  await prisma.operationLog.create({
    data: {
      actorId: user.id,
      action: logAction,
      target: TARGET_PLUG,
      reason: reason || (wantOn ? "Manual charge ON" : "Manual charge OFF"),
      isAuto: false,
      details: logDetails,
    },
  });

  return NextResponse.json({
    ok: true,
    action: logAction,
    switchbotResult: ok,
    message: wantOn ? "Charge ON sent" : "Charge OFF sent",
  });
}
