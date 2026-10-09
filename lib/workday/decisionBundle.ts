import { z } from "zod";
import { normaliseText } from "./types";

/**
 * Review decisions moved from one copy of HRT to another, e.g. reviewed on a prod snapshot
 * and replayed on prod at go-live. Replaying goes through the normal apply path, so every
 * line is re-checked against the target's data and anything that changed is skipped.
 */

export const DECISION_BUNDLE_FORMAT = "hrt-workday-decisions";

const rowSchema = z.object({
  uid: z.string(),
  name: z.string(),
  nameKey: z.string(),
  managerUid: z.string().nullable(),
  title: z.string(),
});

export const decisionBundleSchema = z.object({
  format: z.literal(DECISION_BUNDLE_FORMAT),
  version: z.literal(1),
  exportedAt: z.string(),
  /** Every employee and department in the source, so the target can prove it's the same HRT. */
  employees: z.record(z.string(), z.string()),
  departments: z.record(z.string(), z.string()),
  /** Job family names by id. Matched by name on replay, since cleanup scripts create them per copy (absent in older exports). */
  jobFamilies: z.record(z.string(), z.string()).optional(),
  links: z.array(z.object({ workdayNameKey: z.string(), workdayName: z.string(), employeeId: z.number().int().nullable() })),
  ignoreRules: z.array(
    z.object({
      subjectKey: z.string(),
      field: z.string(),
      value: z.string(),
      note: z.string().nullable(),
      workdayName: z.string().nullable(),
    }),
  ),
  grants: z.array(
    z.object({
      granteeEmployeeId: z.number().int(),
      scopeManagerEmployeeId: z.number().int(),
      departmentId: z.number().int().nullable(),
      /** Absent in older exports: those grants are unfiltered by job family and Act. */
      jobFamilyId: z.number().int().nullable().optional(),
      level: z.enum(["Act", "View"]).optional(),
      source: z.string(),
    }),
  ),
  /** Import sessions that had applies, oldest first, each with its applies in order. */
  sessions: z.array(
    z.object({
      fileName: z.string(),
      uploadedAt: z.string(),
      rows: z.array(rowSchema),
      runs: z.array(
        z.object({
          at: z.string(),
          applied: z.array(z.string()),
          choices: z.record(z.string(), z.number().int()),
          /** Edited name splits and department filters (absent in older exports). */
          names: z.record(z.string(), z.object({ first: z.string(), last: z.string() })).optional(),
          departments: z.record(z.string(), z.number().int()).optional(),
        }),
      ),
    }),
  ),
});

export type DecisionBundle = z.infer<typeof decisionBundleSchema>;

export interface IdentityMismatch {
  kind: "employee" | "department";
  id: number;
  expected: string;
  found: string | null;
}

/**
 * Ids are only meaningful between copies of the same database. Every employee and department
 * the source had must exist in the target under the same id and name; anything added to the
 * target since is fine.
 */
export function checkIdentity(
  bundle: Pick<DecisionBundle, "employees" | "departments">,
  target: { employees: Map<number, string>; departments: Map<number, string> },
): IdentityMismatch[] {
  const mismatches: IdentityMismatch[] = [];
  const compare = (kind: IdentityMismatch["kind"], expected: Record<string, string>, found: Map<number, string>) => {
    for (const [key, name] of Object.entries(expected)) {
      const id = Number(key);
      const actual = found.get(id) ?? null;
      if (actual === null || normaliseText(actual) !== normaliseText(name)) mismatches.push({ kind, id, expected: name, found: actual });
    }
  };
  compare("employee", bundle.employees, target.employees);
  compare("department", bundle.departments, target.departments);
  return mismatches;
}
