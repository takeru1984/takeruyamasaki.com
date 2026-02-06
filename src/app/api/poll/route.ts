/**
 * GET /api/poll
 *
 * Vercel Cron 専用エンドポイント。EcoFlow + SwitchBot の状態を取得し、
 * device_state に保存。フェイルセーフ条件時は SwitchBot を ON にし、
 * operation_logs と notifications（スタブ）に記録する。
 *
 * Vercel Cron から呼ぶ場合: vercel.json で schedule を設定し、
 * Vercel が Authorization: Bearer <CRON_SECRET> を付与する前提。
 * ローカル検証時は .env の CRON_SECRET を Bearer で渡すこと。
 *
 * vercel.json 例 (2分間隔):
 *   "crons": [{ "path": "/api/poll", "schedule": "*\/2 * * * *" }]
 */
import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { isDbConfigured } from "@/lib/env-status";
import { runPoll } from "@/lib/poll-service";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  const expected = config.cronSecret();

  if (!expected || token !== expected) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Cron secret required" },
      { status: 401 }
    );
  }

  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: "Database not configured", message: "Set POSTGRES_* env" },
      { status: 500 }
    );
  }

  try {
    const result = await runPoll();
    return NextResponse.json({
      ok: result.ok,
      failSafeTriggered: result.failSafeTriggered ?? false,
      reason: result.reason,
      ecoflowSoc: result.ecoflowSoc,
      switchbotState: result.switchbotState,
      pollFailureCount: result.pollFailureCount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[poll]", message);
    return NextResponse.json(
      { error: "Poll failed", message },
      { status: 500 }
    );
  }
}
