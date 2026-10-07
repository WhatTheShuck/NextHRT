import type { LineField } from "./suggestions";

/** Client-safe labels and groupings for import lines (no server imports here). */

export const FIELD_LABELS: Record<LineField, string> = {
  reportsTo: "Reports to",
  title: "Title",
  preferredName: "Preferred name",
  department: "Department",
  delegatedAccess: "Delegated access",
  externalReportsTo: "Reports to (external)",
  externalManagerLeft: "Manager has left",
  notInHrt: "Not in HRT",
  inactiveMatch: "Matches an inactive employee",
  missingFromWorkday: "Missing from Workday",
};

/** Fields that only flag something; they can be ignored but never applied. */
export const FLAG_FIELDS: LineField[] = ["externalManagerLeft", "notInHrt", "inactiveMatch", "missingFromWorkday"];

/** Display order for the summary bar and within a person card. */
export const FIELD_ORDER: LineField[] = [
  "notInHrt",
  "inactiveMatch",
  "preferredName",
  "title",
  "reportsTo",
  "externalReportsTo",
  "department",
  "delegatedAccess",
  "externalManagerLeft",
  "missingFromWorkday",
];
