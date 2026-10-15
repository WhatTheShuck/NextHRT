import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    tutorialView: { upsert: vi.fn(), deleteMany: vi.fn() },
    appSetting: { upsert: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { isTutorialKey, isTutorialMode, tutorialService } from "@/lib/services/tutorialService";
import { currentRelease } from "@/lib/tours/whats-new";

const DEPLOYED = new Date("2026-10-12T00:00:00Z");
const whatsNew = `whats-new@${currentRelease.id}`;

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.appSetting.upsert.mockResolvedValue({ value: DEPLOYED.toISOString() });
});

function user(overrides: Record<string, unknown> = {}) {
  return {
    tutorialMode: "FirstVisit",
    employeeId: 7,
    createdAt: new Date("2026-01-01"),
    tutorialViews: [],
    ...overrides,
  };
}

describe("getState", () => {
  it("is null for an unknown user", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    expect(await tutorialService.getState("u1", "User")).toBeNull();
  });

  it("shows What's new to people who used HRT before the release", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(user());
    const state = await tutorialService.getState("u1", "User");
    expect(state).toMatchObject({
      mode: "FirstVisit",
      seen: [],
      showWhatsNew: true,
      audience: { admin: false, linked: true },
    });
  });

  it("skips What's new for people who first signed in after the release", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(user({ createdAt: new Date("2026-10-13") }));
    expect((await tutorialService.getState("u1", "User"))?.showWhatsNew).toBe(false);
  });

  it("shows What's new only once", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(user({ tutorialViews: [{ key: whatsNew }] }));
    const state = await tutorialService.getState("u1", "User");
    expect(state?.showWhatsNew).toBe(false);
    expect(mockPrisma.appSetting.upsert).not.toHaveBeenCalled();
  });

  it("doesn't show What's new to someone still waiting to be linked", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(user({ employeeId: null }));
    expect((await tutorialService.getState("u1", "User"))?.showWhatsNew).toBe(false);
  });

  it("treats an account with no employee record as unlinked", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(user({ employeeId: null }));
    expect((await tutorialService.getState("u1", "Admin"))?.audience).toMatchObject({
      admin: true,
      linked: false,
    });
  });
});

describe("releaseDeployedAt", () => {
  it("records the first time the release was served and never moves it", async () => {
    await tutorialService.releaseDeployedAt();
    expect(mockPrisma.appSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: `tutorials.whatsNew.${currentRelease.id}.deployedAt` },
        update: {},
      }),
    );
  });
});

describe("resetPageTours", () => {
  it("keeps What's new marked as seen", async () => {
    await tutorialService.resetPageTours("u1");
    expect(mockPrisma.tutorialView.deleteMany).toHaveBeenCalledWith({
      where: { userId: "u1", NOT: { key: { startsWith: "whats-new@" } } },
    });
  });
});

describe("validation", () => {
  it("accepts only the three modes", () => {
    expect(isTutorialMode("Always")).toBe(true);
    expect(isTutorialMode("always")).toBe(false);
    expect(isTutorialMode(undefined)).toBe(false);
  });

  it("accepts versioned keys only", () => {
    expect(isTutorialKey("dashboard@1")).toBe(true);
    expect(isTutorialKey(whatsNew)).toBe(true);
    expect(isTutorialKey("dashboard")).toBe(false);
    expect(isTutorialKey("x".repeat(60) + "@1")).toBe(false);
    expect(isTutorialKey("<script>@1")).toBe(false);
  });
});
