import type { Audience, PageTour, TourStep, Who } from "./types";

/**
 * Builds the audience from the session role. The effective role can be a
 * comma-separated list (a fire warden who also has a team is
 * "FireWarden,DepartmentManager"), so it's split rather than compared.
 */
export function audienceFor(
  role: string | null | undefined,
  linked: boolean,
): Audience {
  const roles = (role || "User").split(",").map((r) => r.trim());
  return {
    admin: roles.includes("Admin"),
    manager: roles.includes("DepartmentManager"),
    warden: roles.includes("FireWarden"),
    linked,
  };
}

/** Ready-made `when` filters for tour steps, tips and What's new items. */
export const who = {
  admin: (a: Audience) => a.admin,
  nonAdmin: (a: Audience) => !a.admin,
  manager: (a: Audience) => a.manager,
  /** Managers and admins: the people who approve and see other people's records. */
  managerOrAdmin: (a: Audience) => a.manager || a.admin,
  /** Anyone with the Reports card. */
  reports: (a: Audience) => a.admin || a.manager || a.warden,
  linked: (a: Audience) => a.linked,
  unlinked: (a: Audience) => !a.linked,
} satisfies Record<string, Who>;

export const tourKey = (tour: Pick<PageTour, "id" | "version">) =>
  `${tour.id}@${tour.version}`;

export const whatsNewKey = (releaseId: string) => `whats-new@${releaseId}`;

export function stepsFor(tour: PageTour, audience: Audience): TourStep[] {
  return tour.steps.filter((s) => !s.when || s.when(audience));
}
