/**
 * SoC status utility: データが5分以上古いか null の場合は「不明」と判定。
 * /api/control の charge_off ガードで使用。
 */

import { prisma } from "@/lib/db";

const STALE_MINUTES = 5;

export type SocStatus = {
  lastSuccessSoc: number | null;
  lastPollAt: Date | null;
  isStale: boolean;
  isUnknown: boolean;
};

export async function getSocStatus(): Promise<SocStatus> {
  const status = await prisma.systemStatus.findUnique({ where: { id: 1 } });
  const lastSuccessSoc = status?.lastSuccessSoc ?? null;
  const lastPollAt = status?.lastPollAt ?? null;

  let isStale = false;
  if (lastPollAt) {
    const elapsed = (Date.now() - lastPollAt.getTime()) / (60 * 1000);
    isStale = elapsed > STALE_MINUTES;
  } else {
    isStale = true;
  }

  const isUnknown = lastSuccessSoc === null || isStale;

  return { lastSuccessSoc, lastPollAt, isStale, isUnknown };
}
