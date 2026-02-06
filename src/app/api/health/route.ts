/**
 * GET /api/health — Cron monitor (Upstash/Heartbeat) 用。
 * 2回連続で失敗した場合はアラートを想定。
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
