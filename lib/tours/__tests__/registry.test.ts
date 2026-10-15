import { describe, it, expect } from "vitest";
import { allTours, tourForPath } from "../registry";
import { tourKey, whatsNewKey } from "../audience";
import { currentRelease } from "../whats-new";
import { isTutorialKey } from "@/lib/services/tutorialService";

describe("tour registry", () => {
  it("has unique ids", () => {
    const ids = allTours.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("stores keys the API will accept", () => {
    for (const tour of allTours) expect(isTutorialKey(tourKey(tour)), tour.id).toBe(true);
    expect(isTutorialKey(whatsNewKey(currentRelease.id))).toBe(true);
  });

  it("gives every tour at least one step and a summary", () => {
    for (const tour of allTours) {
      expect(tour.steps.length, tour.id).toBeGreaterThan(0);
      expect(tour.summary.length, tour.id).toBeGreaterThan(0);
    }
  });

  it("has no two tours claiming the same page", () => {
    // A path that two tours match means the second is unreachable.
    const samples = [
      "/", "/profile", "/employees", "/employees/12", "/my-sops", "/my-sops/3",
      "/quiz", "/quiz/4", "/access-check", "/sop-reviews", "/sop-reviews/5",
      "/forms", "/forms/training-request", "/forms/training-request/6",
      "/forms/my-requests", "/forms/new-employee", "/forms/document-upload",
      "/expiring", "/expiring/review/11", "/approvals", "/required-training",
      "/reports", "/reports/training", "/reports/training/needs-analysis",
      "/reports/tickets/expiring", "/reports/employee/list",
      "/admin/access", "/admin/permissions", "/admin/org-chart",
      "/admin/org-chart/import", "/admin/org-chart/import/7", "/admin/org-chart/import/rules",
      "/admin/org-chart/access", "/admin/org-chart/switchover", "/admin/api-keys",
      "/admin/email", "/admin/email/log", "/admin/email/attachments", "/admin/email/templates",
      "/admin/system", "/admin/settings", "/admin/jobs", "/admin/logs",
      "/admin/field-editor", "/admin/field-editor/sops", "/admin/quiz-results",
      "/admin/quiz-results/8", "/admin/quiz-editor/9", "/admin/onboarding", "/admin/onboarding/10",
    ];
    for (const path of samples) {
      const matches = allTours.filter((t) => t.path.test(path)).map((t) => t.id);
      expect(matches.length, `${path}: ${matches.join(", ")}`).toBeLessThanOrEqual(1);
    }
  });

  it("points every What's new link at a page with a tour", () => {
    for (const item of currentRelease.items) {
      if (item.href) expect(tourForPath(item.href), item.href).toBeDefined();
    }
  });
});
