import { descendants, findCycles, managerChain, toChildrenIndex, toManagerMap } from "./reportingLine";

/**
 * Phase 2 preparation (docs/workday-org-import-spec.md §9.4, §9.6): who would be stranded by
 * switching authority to reporting lines, and what each of today's department-manager grants
 * becomes. Pure; nothing here changes permissions.
 */

export interface SwitchoverEmployee {
  id: number;
  name: string;
  reportsToId: number | null;
  isActive: boolean;
  departmentId: number;
  external: boolean;
}

export interface SwitchoverDepartment {
  id: number;
  name: string;
  level: number;
  parentDepartmentId: number | null;
}

/** One user's department-manager grants today. */
export interface DepartmentGrant {
  userId: string;
  userName: string;
  employeeId: number | null;
  departmentIds: number[];
}

export interface SwitchoverInput {
  employees: SwitchoverEmployee[];
  departments: SwitchoverDepartment[];
  departmentGrants: DepartmentGrant[];
  delegatedGrants: {
    granteeEmployeeId: number;
    scopeManagerEmployeeId: number;
    departmentId: number | null;
    jobFamilyId: number | null;
    level: string;
  }[];
}

export interface SuggestedGrant {
  /** `grantee:scopeManager:department`, stable for ticking and re-checking. */
  key: string;
  granteeEmployeeId: number;
  scopeManagerEmployeeId: number;
  scopeManagerName: string;
  departmentId: number;
  departmentName: string;
  /** People in the department the grantee's own reporting line doesn't cover. */
  uncovered: string[];
  alreadyGranted: boolean;
}

export type GrantOutcome =
  /** Everyone the grant covers today is already below them in the reporting line. */
  | "coveredByLine"
  /** Needs delegated access (one suggestion per department it covers today). */
  | "needsGrant"
  /** Every suggested grant already exists. */
  | "migrated"
  /** Some people the grant covers have no reporting line yet, so no scope can be worked out. */
  | "blocked"
  /** The user isn't linked to an employee, so their access ends at the switch-over. */
  | "noEmployee"
  /** The linked employee is inactive, so their access ends at the switch-over. */
  | "inactive";

export interface GrantMigration {
  userId: string;
  userName: string;
  employeeId: number | null;
  departmentId: number;
  departmentName: string;
  /** The departments this grant reaches today (itself, plus children for a level-0 grant). */
  coversDepartments: string[];
  outcome: GrantOutcome;
  suggestions: SuggestedGrant[];
  blockedBy: string[];
  /** The holder has no reporting line themselves, often a sign they've left (e.g. not in Workday). */
  holderUnlined: boolean;
}

export interface SwitchoverReport {
  root: { id: number; name: string } | null;
  /** Active employees other than the root with no (active) manager. Must be empty to switch. */
  unlined: { id: number; name: string; external: boolean }[];
  cycles: string[][];
  grants: GrantMigration[];
  ready: boolean;
}

export function grantKey(granteeId: number, scopeManagerId: number, departmentId: number): string {
  return `${granteeId}:${scopeManagerId}:${departmentId}`;
}

export function buildSwitchoverReport(input: SwitchoverInput): SwitchoverReport {
  const active = input.employees.filter((e) => e.isActive);
  const byId = new Map(active.map((e) => [e.id, e]));
  // Only active people count; an inactive manager leaves their reports unlined.
  const nodes = active.map((e) => ({ id: e.id, reportsToId: e.reportsToId !== null && byId.has(e.reportsToId) ? e.reportsToId : null }));
  const managers = toManagerMap(nodes);
  const children = toChildrenIndex(nodes);
  const nameOf = (id: number) => byId.get(id)?.name ?? `#${id}`;

  // The root is the top of the largest tree.
  const tops = nodes.filter((n) => n.reportsToId === null);
  let root: SwitchoverEmployee | null = null;
  let rootSize = 0;
  for (const t of tops) {
    const size = descendants(t.id, children).size;
    if (size > rootSize) [root, rootSize] = [byId.get(t.id)!, size];
  }

  const unlined = tops
    .filter((t) => t.id !== root?.id)
    .map((t) => byId.get(t.id)!)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((e) => ({ id: e.id, name: e.name, external: e.external }));
  const unlinedIds = new Set(unlined.map((u) => u.id));
  const cycles = findCycles(managers).map((c) => c.map(nameOf));

  const deptById = new Map(input.departments.map((d) => [d.id, d]));
  const childDepts = new Map<number, number[]>();
  for (const d of input.departments) {
    if (d.parentDepartmentId !== null) childDepts.set(d.parentDepartmentId, [...(childDepts.get(d.parentDepartmentId) ?? []), d.id]);
  }
  // Only an Act grant on the whole department keeps what a department-manager grant gives today.
  const existing = new Set(
    input.delegatedGrants
      .filter((g) => g.departmentId !== null && g.jobFamilyId === null && g.level === "Act")
      .map((g) => grantKey(g.granteeEmployeeId, g.scopeManagerEmployeeId, g.departmentId!)),
  );
  const allEmployees = new Map(input.employees.map((e) => [e.id, e]));

  const grants: GrantMigration[] = [];
  for (const grant of input.departmentGrants) {
    for (const departmentId of grant.departmentIds) {
      const dept = deptById.get(departmentId);
      if (!dept) continue;
      // What the grant reaches today: the broadest current rule (§3) gives level-0 managers their children.
      const covers = dept.level === 0 ? [departmentId, ...(childDepts.get(departmentId) ?? [])] : [departmentId];
      const base = {
        userId: grant.userId,
        userName: grant.userName,
        employeeId: grant.employeeId,
        departmentId,
        departmentName: dept.name,
        coversDepartments: covers.map((id) => deptById.get(id)?.name ?? `#${id}`),
        suggestions: [] as SuggestedGrant[],
        blockedBy: [] as string[],
        holderUnlined: grant.employeeId !== null && unlinedIds.has(grant.employeeId),
      };

      if (grant.employeeId === null) {
        grants.push({ ...base, outcome: "noEmployee" });
        continue;
      }
      if (!allEmployees.get(grant.employeeId)?.isActive) {
        grants.push({ ...base, outcome: "inactive" });
        continue;
      }

      const grantee = grant.employeeId;
      const below = descendants(grantee, children);
      const blockedBy = new Set<string>();
      for (const c of covers) {
        const people = active.filter((e) => e.departmentId === c && e.id !== grantee);
        const uncovered = people.filter((p) => !below.has(p.id));
        if (uncovered.length === 0) continue;

        // Act at the level of the lowest manager above everyone in the department.
        const scope = lowestCommonManager(people.map((p) => p.id), managers, root?.id ?? null);
        if (scope.unreachable.length > 0) {
          scope.unreachable.forEach((id) => blockedBy.add(nameOf(id)));
          continue;
        }
        if (scope.managerId === null) continue;
        base.suggestions.push({
          key: grantKey(grantee, scope.managerId, c),
          granteeEmployeeId: grantee,
          scopeManagerEmployeeId: scope.managerId,
          scopeManagerName: nameOf(scope.managerId),
          departmentId: c,
          departmentName: deptById.get(c)?.name ?? `#${c}`,
          uncovered: uncovered.map((p) => p.name).sort(),
          alreadyGranted: existing.has(grantKey(grantee, scope.managerId, c)),
        });
      }

      const outcome: GrantOutcome =
        blockedBy.size > 0
          ? "blocked"
          : base.suggestions.length === 0
            ? "coveredByLine"
            : base.suggestions.every((s) => s.alreadyGranted)
              ? "migrated"
              : "needsGrant";
      grants.push({ ...base, outcome, blockedBy: [...blockedBy].sort() });
    }
  }

  return {
    root: root ? { id: root.id, name: root.name } : null,
    unlined,
    cycles,
    grants,
    ready: unlined.length === 0 && cycles.length === 0 && grants.every((g) => g.outcome !== "needsGrant" && g.outcome !== "blocked"),
  };
}

/**
 * The nearest manager above every id (a person never counts as their own manager here, so a
 * department's own head is still inside the scope). People whose chain doesn't reach the root
 * are returned as unreachable.
 */
export function lowestCommonManager(
  ids: number[],
  managers: Map<number, number | null>,
  rootId: number | null,
): { managerId: number | null; unreachable: number[] } {
  if (ids.length === 0) return { managerId: null, unreachable: [] };
  const chains = ids.map((id) => ({ id, chain: managerChain(id, managers) }));
  const unreachable = chains
    .filter(({ id, chain }) => rootId === null || (id !== rootId && !chain.includes(rootId)))
    .map(({ id }) => id);
  if (unreachable.length > 0) return { managerId: null, unreachable };
  // The root has no manager; if it's in the department, nobody sits above everyone.
  if (ids.includes(rootId!)) return { managerId: rootId, unreachable: [] };

  const [first, ...rest] = chains;
  const common = first.chain.find((m) => rest.every(({ chain }) => chain.includes(m)));
  return { managerId: common ?? rootId, unreachable: [] };
}
