/**
 * SoC status utility: データが5分以上古いか null の場合は「不明」と判定。
 * /api/control の charge_off ガードで使用。
 */

import { prisma } from "@/lib/db";
import { isDbConfigured } from "@/lib/env-status";

const STALE_MINUTES = 5;

export type SocStatus = {
  lastSuccessSoc: number | null;
  lastPollAt: Date | null;
  isStale: boolean;
  isUnknown: boolean;
};

const STALE_DEFAULT: SocStatus = {
  lastSuccessSoc: null,
  lastPollAt: null,
  isStale: true,
  isUnknown: true,
};

export async function getSocStatus(): Promise<SocStatus> {
  if (!isDbConfigured()) {
    return Promise.resolve(STALE_DEFAULT);
  }

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
