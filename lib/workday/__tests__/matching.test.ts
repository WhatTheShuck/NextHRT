import { describe, it, expect } from "vitest";
import { matchRows, rankCandidates, type MatchEmployee } from "../matching";
import { normaliseNameKey, type WorkdayRow } from "../types";

let nextId = 1;
const emp = (
  legal: string,
  opts: { preferred?: string; active?: boolean; id?: number } = {},
): MatchEmployee => {
  const [legalFirstName, ...rest] = legal.split(" ");
  const [preferredFirstName, ...prefRest] = opts.preferred?.split(" ") ?? [];
  return {
    id: opts.id ?? nextId++,
    legalFirstName,
    legalLastName: rest.join(" "),
    preferredFirstName: preferredFirstName ?? null,
    preferredLastName: prefRest.length ? prefRest.join(" ") : null,
    isActive: opts.active ?? true,
  };
};
const row = (name: string, uid = name): WorkdayRow => ({
  uid,
  name,
  nameKey: normaliseNameKey(name),
  managerUid: null,
  title: "",
});

describe("matchRows", () => {
  it("matches exactly on legal or preferred names, ignoring case and spacing", () => {
    const craig = emp("Craig Whelan");
    const dylan = emp("Dylan De Wit");
    const jo = emp("Josephine Bloggs", { preferred: "Jo Bloggs" });
    const results = matchRows([row("CRAIG WHELAN"), row("Dylan De Wit"), row("Jo Bloggs")], [craig, dylan, jo], []);

    expect(results.get("CRAIG WHELAN")).toEqual({ kind: "linked", employeeId: craig.id, via: "exact" });
    expect(results.get("Dylan De Wit")).toEqual({ kind: "linked", employeeId: dylan.id, via: "exact" });
    expect(results.get("Jo Bloggs")).toEqual({ kind: "linked", employeeId: jo.id, via: "exact" });
  });

  it("prefers the active record when an inactive namesake exists", () => {
    const old = emp("Maree Toa", { active: false });
    const current = emp("Rosemaree Toa");
    const results = matchRows([row("Maree Toa")], [old, current], []);
    // The exact name is only on the inactive record, so it isn't trusted, and the active
    // Rosemaree is offered to link instead.
    expect(results.get("Maree Toa")).toMatchObject({
      kind: "inactive",
      employeeId: old.id,
      via: "exact",
      candidates: [{ employeeId: current.id, score: 70 }],
    });
  });

  it("flags a row whose only exact match is inactive", () => {
    const troy = emp("Troy Phillips", { active: false });
    expect(matchRows([row("Troy Phillips")], [troy], []).get("Troy Phillips")).toEqual({
      kind: "inactive",
      employeeId: troy.id,
      via: "exact",
      candidates: [],
    });
  });

  it("trusts a remembered link over name matching", () => {
    const frederik = emp("Frederik Botma");
    const results = matchRows(
      [row("Fred Botma")],
      [frederik],
      [{ workdayNameKey: "fredbotma", employeeId: frederik.id }],
    );
    expect(results.get("Fred Botma")).toEqual({ kind: "linked", employeeId: frederik.id, via: "link" });
  });

  it("stops trusting a link once the linked employee is inactive", () => {
    const leaver = emp("Maree Toa", { active: false });
    const results = matchRows([row("Maree Toa")], [leaver], [{ workdayNameKey: "mareetoa", employeeId: leaver.id }]);
    expect(results.get("Maree Toa")).toEqual({ kind: "inactive", employeeId: leaver.id, via: "link", candidates: [] });
  });

  it("honours a confirmed 'not in HRT' link", () => {
    expect(matchRows([row("New Starter")], [], [{ workdayNameKey: "newstarter", employeeId: null }]).get("New Starter")).toEqual({
      kind: "notInHrt",
    });
  });

  it("never offers an employee already linked to someone else", () => {
    const michael = emp("Michael Smith");
    const results = matchRows(
      [row("Michael Smith")],
      [michael],
      [{ workdayNameKey: "mikesmith", employeeId: michael.id }],
    );
    expect(results.get("Michael Smith")).toEqual({ kind: "unmatched", candidates: [] });
  });

  it("marks duplicate row names ambiguous instead of guessing", () => {
    const michael = emp("Michael Smith");
    const results = matchRows([row("Michael Smith", "a"), row("Michael Smith", "b")], [michael], []);
    expect(results.get("a")?.kind).toBe("ambiguous");
    expect(results.get("b")?.kind).toBe("ambiguous");
  });

  it("marks a row ambiguous when two active employees share the name", () => {
    const results = matchRows([row("Anthony Smith")], [emp("Anthony Smith"), emp("Anthony Smith")], []);
    expect(results.get("Anthony Smith")?.kind).toBe("ambiguous");
  });
});

describe("rankCandidates", () => {
  it("ranks the real name variants above surname-only matches, active first", () => {
    const frederik = emp("Frederik Botma");
    const nicholas = emp("Nicholas Todeschino");
    const hayley = emp("Hayley-Ann Hargrave");
    const rosemaree = emp("Rosemaree Toa");
    const muhamad = emp("Muhamad Hamim");
    const all = [frederik, nicholas, hayley, rosemaree, muhamad];

    expect(rankCandidates(row("Fred Botma"), all)[0]).toMatchObject({ employeeId: frederik.id, score: 80 });
    expect(rankCandidates(row("Nick Todeschino"), all)[0]).toMatchObject({ employeeId: nicholas.id, score: 80 });
    expect(rankCandidates(row("Hayley Hargrave"), all)[0]).toMatchObject({ employeeId: hayley.id, score: 80 });
    expect(rankCandidates(row("Maree Toa"), all)[0]).toMatchObject({ employeeId: rosemaree.id, score: 70 });
    expect(rankCandidates(row("Tommy Hamim"), all)[0]).toMatchObject({ employeeId: muhamad.id, score: 50 });
  });

  it("handles multi-word surnames and lists inactive candidates last", () => {
    const active = emp("Andy Staunton Smith");
    const inactive = emp("Andrew Staunton Smith", { active: false });
    const ranked = rankCandidates(row("Andrew Staunton Smith"), [inactive, active]);
    expect(ranked.map((c) => c.employeeId)).toEqual([active.id, inactive.id]);
    expect(ranked[1].reason).toContain("(inactive)");
  });

  it("ignores people with a different surname", () => {
    expect(rankCandidates(row("Fred Botma"), [emp("Fred Jones")])).toEqual([]);
  });
});
