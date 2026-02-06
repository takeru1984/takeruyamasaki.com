/**
 * Notification pipeline: LINE Notify + SMTP/Resend email.
 * docs/ALERTING.md に沿ったクールダウン付き送信。
 * 環境変数が無ければスキップ＆ログ。
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/** Cooldown minutes per alert_slug (docs/ALERTING.md) */
const COOLDOWNS: Record<string, number> = {
  low_soc_caution: 60,
  low_soc_critical: 30,
  low_soc_panic: 5,
  poll_failure: 15,
  api_fatal_error: 5,
};

const DEFAULT_COOLDOWN = 15;

export type AlertPayload = {
  timestamp: string;
  currentSoc?: number;
  deviceId?: string;
  actionTaken?: string;
  reason?: string;
  [key: string]: unknown;
};

export type NotifyResult = {
  sent: boolean;
  suppressed?: boolean;
  reason?: string;
  channels?: string[];
}

/**
 * Check if alert should be sent (cooldown) and optionally record/log suppression.
 */
async function shouldSend(alertSlug: string): Promise<{ send: boolean; lastSentAt: Date | null }> {
  const last = await prisma.notification.findFirst({
    where: { alertSlug },
    orderBy: { sentAt: "desc" },
  });
  const cooldownMin = COOLDOWNS[alertSlug] ?? DEFAULT_COOLDOWN;
  const now = new Date();
  if (!last) return { send: true, lastSentAt: null };
  const elapsed = (now.getTime() - last.sentAt.getTime()) / (60 * 1000);
  return {
    send: elapsed >= cooldownMin,
    lastSentAt: last.sentAt,
  };
}

async function sendLineNotify(token: string, message: string): Promise<boolean> {
  try {
    const res = await fetch("https://notify-api.line.me/api/notify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Bearer ${token}`,
      },
      body: new URLSearchParams({ message }),
      signal: AbortSignal.timeout(10000),
    });
    return res.ok;
  } catch (e) {
    console.error("[notify] LINE error:", e);
    return false;
  }
}

async function sendEmail(payload: AlertPayload, subject: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.SMTP_FROM ?? process.env.ALERT_EMAIL_FROM ?? "alerts@example.com";
  const to = process.env.ALERT_EMAIL_TO ?? process.env.ALERT_EMAIL;
  if (!to) {
    console.warn("[notify] ALERT_EMAIL_TO not set, skipping email");
    return false;
  }
  if (apiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject,
          text: formatEmailText(payload),
        }),
        signal: AbortSignal.timeout(10000),
      });
      return res.ok;
    } catch (e) {
      console.error("[notify] Resend error:", e);
      return false;
    }
  }
  console.warn("[notify] RESEND_API_KEY not set, skipping email");
  return false;
}

function formatEmailText(payload: AlertPayload): string {
  const lines = [
    `Timestamp: ${payload.timestamp}`,
    payload.currentSoc != null ? `Current SoC: ${payload.currentSoc}%` : null,
    payload.deviceId ? `Device: ${payload.deviceId}` : null,
    payload.actionTaken ? `Action: ${payload.actionTaken}` : null,
    payload.reason ? `Reason: ${payload.reason}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

/**
 * Send alert with cooldown. Returns sent=true if at least one channel sent; otherwise suppressed.
 * Records to notifications table on send; logs suppression to operation_logs when suppressed.
 */
export async function sendAlert(
  alertSlug: string,
  payload: AlertPayload,
  channels: ("line" | "email")[] = ["line", "email"]
): Promise<NotifyResult> {
  const { send, lastSentAt } = await shouldSend(alertSlug);
  if (!send) {
    await prisma.operationLog.create({
      data: {
        actorId: "system",
        action: "NOTIFY_SUPPRESSED",
        target: "notifications",
        reason: `Alert ${alertSlug} suppressed (cooldown), last sent ${lastSentAt?.toISOString() ?? "never"}`,
        isAuto: true,
        details: JSON.parse(JSON.stringify({ alertSlug, payload, lastSentAt: lastSentAt?.toISOString() })) as Prisma.InputJsonValue,
      },
    }).catch(() => {});
    return {
      sent: false,
      suppressed: true,
      reason: "cooldown",
      channels: [],
    };
  }

  const subject = `[EcoFlow] ${alertSlug.replace(/_/g, " ")}`;
  const message = formatEmailText(payload);
  const sentChannels: string[] = [];

  if (channels.includes("line")) {
    const token = process.env.LINE_NOTIFY_TOKEN;
    if (token) {
      const ok = await sendLineNotify(token, `${subject}\n${message}`);
      if (ok) sentChannels.push("line");
    } else {
      console.warn("[notify] LINE_NOTIFY_TOKEN not set, skipping LINE");
    }
  }
  if (channels.includes("email")) {
    const ok = await sendEmail(payload, subject);
    if (ok) sentChannels.push("email");
  }

  if (sentChannels.length > 0) {
    await prisma.notification.create({
      data: {
        alertSlug,
        sentAt: new Date(),
        channel: sentChannels.join(","),
        payload: JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue,
      },
    });
  }

  return {
    sent: sentChannels.length > 0,
    channels: sentChannels,
  };
}
