import prisma from "@/lib/prisma";
import { audienceFor, whatsNewKey } from "@/lib/tours/audience";
import { currentRelease, whatsNewItemsFor } from "@/lib/tours/whats-new";
import type { Audience, TutorialMode } from "@/lib/tours/types";

export const TUTORIAL_MODES: readonly TutorialMode[] = ["Off", "FirstVisit", "Always"];

// "dashboard@1", "whats-new@2026-10"
const KEY_PATTERN = /^[a-z0-9-]{1,48}@[a-z0-9.-]{1,16}$/;

export function isTutorialMode(value: unknown): value is TutorialMode {
  return typeof value === "string" && (TUTORIAL_MODES as readonly string[]).includes(value);
}

export function isTutorialKey(value: unknown): value is string {
  return typeof value === "string" && KEY_PATTERN.test(value);
}

export interface TutorialState {
  mode: TutorialMode;
  /** Keys of tours (and What's new releases) the user has finished or closed. */
  seen: string[];
  audience: Audience;
  /** True once per release, for linked people who used HRT before it was deployed. */
  showWhatsNew: boolean;
}

export const tutorialService = {
  async getState(userId: string, role: string | null | undefined): Promise<TutorialState | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        tutorialMode: true,
        employeeId: true,
        createdAt: true,
        tutorialViews: { select: { key: true } },
      },
    });
    if (!user) return null;

    const audience = audienceFor(role, user.employeeId !== null);
    const seen = user.tutorialViews.map((v) => v.key);

    // Someone still waiting to be linked can't use any of it yet; their dashboard explains why.
    let showWhatsNew = false;
    if (
      (audience.linked || audience.admin) &&
      !seen.includes(whatsNewKey(currentRelease.id)) &&
      whatsNewItemsFor(currentRelease, audience).length > 0
    ) {
      showWhatsNew = user.createdAt < (await this.releaseDeployedAt());
    }

    return { mode: user.tutorialMode, seen, audience, showWhatsNew };
  },

  /**
   * When this server first served the current release, which stands in for
   * when it was deployed. Anyone whose account is older was using HRT before,
   * so they get What's new; anyone newer gets the page tours instead.
   */
  async releaseDeployedAt(): Promise<Date> {
    const key = `tutorials.whatsNew.${currentRelease.id}.deployedAt`;
    const row = await prisma.appSetting.upsert({
      where: { key },
      create: {
        key,
        value: new Date().toISOString(),
        description: "When this release was first served. Accounts created before it see What's new.",
      },
      update: {},
    });
    return new Date(row.value);
  },

  async setMode(userId: string, mode: TutorialMode): Promise<void> {
    await prisma.user.update({ where: { id: userId }, data: { tutorialMode: mode } });
  },

  async markSeen(userId: string, key: string): Promise<void> {
    await prisma.tutorialView.upsert({
      where: { userId_key: { userId, key } },
      create: { userId, key },
      update: { seenAt: new Date() },
    });
  },

  /** "Replay all tutorials": every page tour shows again. What's new stays seen. */
  async resetPageTours(userId: string): Promise<void> {
    await prisma.tutorialView.deleteMany({
      where: { userId, NOT: { key: { startsWith: "whats-new@" } } },
    });
  },
};
