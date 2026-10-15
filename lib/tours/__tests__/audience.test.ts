import { describe, it, expect } from "vitest";
import { audienceFor, stepsFor, who } from "../audience";
import type { PageTour } from "../types";

describe("audienceFor", () => {
  it("treats a missing role as a plain user", () => {
    expect(audienceFor(null, true)).toEqual({
      admin: false,
      manager: false,
      warden: false,
      linked: true,
    });
  });

  it("splits the comma-separated effective role", () => {
    const a = audienceFor("FireWarden,DepartmentManager", true);
    expect(a.warden).toBe(true);
    expect(a.manager).toBe(true);
    expect(a.admin).toBe(false);
  });

  it("carries the linked flag through", () => {
    expect(audienceFor("Admin", false)).toMatchObject({ admin: true, linked: false });
  });
});

describe("who", () => {
  it("gives reports to wardens, managers and admins only", () => {
    expect(who.reports(audienceFor("User", true))).toBe(false);
    expect(who.reports(audienceFor("FireWarden", true))).toBe(true);
    expect(who.reports(audienceFor("DepartmentManager", true))).toBe(true);
    expect(who.reports(audienceFor("Admin", true))).toBe(true);
  });
});

describe("stepsFor", () => {
  const tour: PageTour = {
    id: "t",
    version: 1,
    path: /^\/t$/,
    title: "T",
    summary: "",
    steps: [
      { title: "everyone", body: "" },
      { title: "admins", body: "", when: who.admin },
    ],
  };

  it("drops steps meant for other people", () => {
    expect(stepsFor(tour, audienceFor("User", true)).map((s) => s.title)).toEqual(["everyone"]);
    expect(stepsFor(tour, audienceFor("Admin", true))).toHaveLength(2);
  });
});
