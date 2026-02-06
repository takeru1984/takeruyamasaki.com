import { describe, it, expect, vi, beforeEach } from "vitest";

const mockNotifications: { alertSlug: string; sentAt: Date }[] = [];
const mockOperationLogs: unknown[] = [];

const mockPrisma = vi.hoisted(() => ({
  notification: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  operationLog: {
    create: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

// Prevent actual fetch
vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true })));

import { sendAlert } from "../src/lib/notify";

describe("sendAlert cooldown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LINE_NOTIFY_TOKEN = "test-token";
    mockNotifications.length = 0;
    mockOperationLogs.length = 0;
    mockPrisma.notification.findFirst.mockResolvedValue(null);
    mockPrisma.notification.create.mockImplementation((args: { data: { alertSlug: string } }) => {
      mockNotifications.push({ alertSlug: args.data.alertSlug, sentAt: new Date() });
      return Promise.resolve({});
    });
    mockPrisma.operationLog.create.mockImplementation((args: { data: unknown }) => {
      mockOperationLogs.push(args.data);
      return Promise.resolve({});
    });
  });

  it("suppresses second call within cooldown", async () => {
    const payload = { timestamp: new Date().toISOString(), reason: "test" };

    const r1 = await sendAlert("poll_failure", payload);
    expect(r1.sent).toBe(true);
    expect(mockPrisma.notification.create).toHaveBeenCalledTimes(1);

    mockPrisma.notification.findFirst.mockResolvedValue({
      sentAt: new Date(Date.now() - 1 * 60 * 1000),
    });

    const r2 = await sendAlert("poll_failure", payload);
    expect(r2.suppressed).toBe(true);
    expect(r2.sent).toBe(false);
    expect(mockPrisma.notification.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.operationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "NOTIFY_SUPPRESSED",
          target: "notifications",
        }),
      })
    );
  });

  it("sends again after cooldown elapsed", async () => {
    const payload = { timestamp: new Date().toISOString(), reason: "test" };

    await sendAlert("poll_failure", payload);
    expect(mockPrisma.notification.create).toHaveBeenCalledTimes(1);

    mockPrisma.notification.findFirst.mockResolvedValue({
      sentAt: new Date(Date.now() - 20 * 60 * 1000),
    });

    const r2 = await sendAlert("poll_failure", payload);
    expect(r2.suppressed).toBeFalsy();
    expect(mockPrisma.notification.create).toHaveBeenCalledTimes(2);
  });
});
