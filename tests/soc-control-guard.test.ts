import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    systemStatus: { findUnique: vi.fn() },
  },
}));

import { getSocStatus } from "../src/lib/soc-status";
import { prisma } from "@/lib/db";

describe("getSocStatus", () => {
  beforeEach(() => {
    vi.mocked(prisma.systemStatus.findUnique).mockReset();
  });

  it("returns isUnknown when lastSuccessSoc is null", async () => {
    vi.mocked(prisma.systemStatus.findUnique).mockResolvedValue({
      id: 1,
      lastPollAt: new Date(),
      pollFailureCount: 0,
      lastSuccessSoc: null,
    });

    const status = await getSocStatus();
    expect(status.isUnknown).toBe(true);
    expect(status.lastSuccessSoc).toBeNull();
  });

  it("returns isUnknown when lastPollAt is stale (>5 min)", async () => {
    vi.mocked(prisma.systemStatus.findUnique).mockResolvedValue({
      id: 1,
      lastPollAt: new Date(Date.now() - 10 * 60 * 1000),
      pollFailureCount: 0,
      lastSuccessSoc: 50,
    });

    const status = await getSocStatus();
    expect(status.isStale).toBe(true);
    expect(status.isUnknown).toBe(true);
  });

  it("returns known when data is fresh", async () => {
    vi.mocked(prisma.systemStatus.findUnique).mockResolvedValue({
      id: 1,
      lastPollAt: new Date(Date.now() - 2 * 60 * 1000),
      pollFailureCount: 0,
      lastSuccessSoc: 50,
    });

    const status = await getSocStatus();
    expect(status.isStale).toBe(false);
    expect(status.isUnknown).toBe(false);
    expect(status.lastSuccessSoc).toBe(50);
  });
});
