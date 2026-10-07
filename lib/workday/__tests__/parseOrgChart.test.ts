import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseOrgChart, validateTree, WorkdayParseError } from "../parseOrgChart";
import type { WorkdayRow } from "../types";

const HEADER = ["Unique Identifier", "Name", "Reports To", "Line Detail 1", "Line Detail 2", "Line Detail 3", "Organization Name"];

function workbook(rows: unknown[][], sheetName = "Org Chart"): Uint8Array {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheetName);
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }));
}

const row = (uid: string, name: string, managerUid: string | null, title = ""): WorkdayRow => ({
  uid,
  name,
  nameKey: name.toLowerCase().replace(/[^a-z]/g, ""),
  managerUid,
  title,
});

describe("parseOrgChart", () => {
  it("reads a Workday export shaped like the real one, ignoring location", () => {
    const data = workbook([
      HEADER,
      ["0_Pat_Root", "Pat Root", "", "Managing Director", "", "Bundamba", ""],
      ["1_Sam_Lead", "Sam Lead", "0_Pat_Root", "Service Manager", "", "Hope Valley", ""],
      ["2_CRAIG_WHELAN", "  CRAIG   WHELAN ", "1_Sam_Lead", "Trades  Assistant", "", "Hope Valley", ""],
    ]);

    const { rows, problems } = parseOrgChart(data);

    expect(problems).toEqual([]);
    expect(rows).toEqual([
      { uid: "0_Pat_Root", name: "Pat Root", nameKey: "patroot", managerUid: null, title: "Managing Director" },
      { uid: "1_Sam_Lead", name: "Sam Lead", nameKey: "samlead", managerUid: "0_Pat_Root", title: "Service Manager" },
      { uid: "2_CRAIG_WHELAN", name: "CRAIG WHELAN", nameKey: "craigwhelan", managerUid: "1_Sam_Lead", title: "Trades Assistant" },
    ]);
    expect(JSON.stringify(rows)).not.toContain("Hope Valley");
  });

  it("finds columns by header text, in any order, on the first sheet when 'Org Chart' is absent", () => {
    const data = workbook(
      [
        ["Line Detail 1", "reports to", "NAME", "Unique Identifier"],
        ["Boss", "", "Pat Root", "0_Pat_Root"],
      ],
      "Sheet1",
    );
    expect(parseOrgChart(data).rows[0]).toMatchObject({ name: "Pat Root", title: "Boss", managerUid: null });
  });

  it("rejects a file without the columns it needs", () => {
    const data = workbook([["Name", "Title"], ["Pat Root", "Boss"]]);
    expect(() => parseOrgChart(data)).toThrow(WorkdayParseError);
    expect(() => parseOrgChart(data)).toThrow(/"Unique Identifier", "Reports To"/);
  });

  it("rejects something that isn't a spreadsheet", () => {
    expect(() => parseOrgChart(new TextEncoder().encode(""))).toThrow(WorkdayParseError);
  });

  it("skips blank rows", () => {
    const data = workbook([HEADER, ["0_A", "Pat Root", ""], ["", "", ""], ["1_B", "Sam Lead", "0_A"]]);
    expect(parseOrgChart(data).rows).toHaveLength(2);
  });
});

describe("validateTree", () => {
  it("accepts a single-rooted tree", () => {
    expect(validateTree([row("0", "Pat Root", null), row("1", "Sam Lead", "0")])).toEqual([]);
  });

  it("reports a missing root and a loop", () => {
    const problems = validateTree([row("0", "Ann A", "1"), row("1", "Bob B", "0")]);
    expect(problems.map((p) => p.kind)).toEqual(["noRoot", "cycle"]);
    expect(problems[1].uids.sort()).toEqual(["0", "1"]);
  });

  it("reports each loop once even when several people hang off it", () => {
    const problems = validateTree([
      row("r", "Root R", null),
      row("0", "Ann A", "1"),
      row("1", "Bob B", "0"),
      row("2", "Cat C", "0"),
    ]);
    expect(problems.filter((p) => p.kind === "cycle")).toHaveLength(1);
  });

  it("reports several roots, an unknown manager and duplicate names", () => {
    const kinds = validateTree([
      row("0", "Pat Root", null),
      row("1", "Sam Lead", null),
      row("2", "Michael Smith", "9"),
      row("3", "Michael  Smith", "0"),
    ]).map((p) => p.kind);
    expect(kinds).toEqual(["multipleRoots", "unknownManager", "duplicateName"]);
  });
});
