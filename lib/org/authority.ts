import { descendants } from "./reportingLine";

/**
 * Line-manager authority (docs/workday-org-import-spec.md §9). Pure rules over the active
 * reporting tree and delegated-access grants; callers load the data.
 */

export type AuthorityMode = "department" | "lineManager";

export interface OrgGraph {
  /** Active employees only: employeeId → manager id (null when none, or the manager is inactive). */
  managers: Map<number, number | null>;
  /** managerId → direct reports (active). */
  children: Map<number, number[]>;
  /** employeeId → departmentId (active). */
  departmentOf: Map<number, number>;
  /** employeeId → jobFamilyId (active; null when unset). */
  jobFamilyOf: Map<number, number | null>;
}

/** Act: sees the scope, approves and gets expiry emails as the scope manager. View: sees only. */
export type GrantLevel = "Act" | "View";

export interface Grant {
  granteeEmployeeId: number;
  scopeManagerEmployeeId: number;
  departmentId: number | null;
  jobFamilyId: number | null;
  level: GrantLevel;
}

export function buildOrgGraph(
  employees: { id: number; reportsToId: number | null; departmentId: number; jobFamilyId?: number | null }[],
): OrgGraph {
  const active = new Set(employees.map((e) => e.id));
  const managers = new Map<number, number | null>();
  const children = new Map<number, number[]>();
  const departmentOf = new Map<number, number>();
  const jobFamilyOf = new Map<number, number | null>();
  for (const e of employees) {
    const manager = e.reportsToId !== null && active.has(e.reportsToId) && e.reportsToId !== e.id ? e.reportsToId : null;
    managers.set(e.id, manager);
    departmentOf.set(e.id, e.departmentId);
    jobFamilyOf.set(e.id, e.jobFamilyId ?? null);
    if (manager !== null) children.set(manager, [...(children.get(manager) ?? []), e.id]);
  }
  return { managers, children, departmentOf, jobFamilyOf };
}

/** Who a grant covers: the scope manager's sub-tree (∩ the exact department, ∩ the job family), minus the grantee (§8.1). */
export function delegatedScope(grant: Pick<Grant, "granteeEmployeeId" | "scopeManagerEmployeeId" | "departmentId" | "jobFamilyId">, graph: OrgGraph): Set<number> {
  const out = new Set<number>();
  for (const id of descendants(grant.scopeManagerEmployeeId, graph.children)) {
    if (id === grant.granteeEmployeeId) continue;
    if (grant.departmentId !== null && graph.departmentOf.get(id) !== grant.departmentId) continue;
    if (grant.jobFamilyId !== null && graph.jobFamilyOf.get(id) !== grant.jobFamilyId) continue;
    out.add(id);
  }
  return out;
}

/** Everyone an employee can see: their whole sub-tree plus their delegated scopes, Act and View (§9.1). */
export function lineScope(employeeId: number, graph: OrgGraph, grants: Grant[]): Set<number> {
  const scope = descendants(employeeId, graph.children);
  for (const g of grants) {
    if (g.granteeEmployeeId !== employeeId) continue;
    for (const id of delegatedScope(g, graph)) scope.add(id);
  }
  scope.delete(employeeId);
  return scope;
}

/**
 * Everyone an employee may act for (submit documents on behalf of): their whole sub-tree plus
 * Act-level delegated scopes. View grants see but never act. Unlike `approvableBy` this is not
 * limited to two levels: a skip-level manager can still act for their people.
 */
export function actScope(employeeId: number, graph: OrgGraph, grants: Grant[]): Set<number> {
  return lineScope(employeeId, graph, grants.filter((g) => g.level === "Act"));
}

/**
 * Whose stage-1 requests an employee may decide (§9.2): their direct reports and those
 * reports' reports (they're the one-up manager), plus the same for every manager they act for
 * through an Act grant, within that grant's scope. Value = the manager acted for, or null when it's
 * the actor's own line. Never includes the actor.
 */
export function approvableBy(actorEmployeeId: number, graph: OrgGraph, grants: Grant[]): Map<number, number | null> {
  const out = new Map<number, number | null>();
  const twoLevels = (managerId: number) => {
    const direct = graph.children.get(managerId) ?? [];
    return [...direct, ...direct.flatMap((d) => graph.children.get(d) ?? [])];
  };

  for (const id of twoLevels(actorEmployeeId)) if (id !== actorEmployeeId) out.set(id, null);

  for (const g of grants) {
    if (g.granteeEmployeeId !== actorEmployeeId || g.level !== "Act") continue;
    const scope = delegatedScope(g, graph);
    for (const id of twoLevels(g.scopeManagerEmployeeId)) {
      if (id === actorEmployeeId || out.has(id) || !scope.has(id)) continue;
      out.set(id, g.scopeManagerEmployeeId);
    }
  }
  return out;
}

export interface Approver {
  employeeId: number;
  /** The manager this person acts for, when they approve through delegated access. */
  actingFor: number | null;
  /** "manager" = direct manager, "oneUp" = their manager, "delegate" = acts for one of them. */
  relation: "manager" | "oneUp" | "delegate";
}

/** Who may decide an employee's stage-1 request: the inverse of `approvableBy`. */
export function approversFor(requesterEmployeeId: number, graph: OrgGraph, grants: Grant[]): Approver[] {
  const manager = graph.managers.get(requesterEmployeeId) ?? null;
  if (manager === null) return [];
  const oneUp = graph.managers.get(manager) ?? null;

  const out: Approver[] = [{ employeeId: manager, actingFor: null, relation: "manager" }];
  if (oneUp !== null && oneUp !== requesterEmployeeId) out.push({ employeeId: oneUp, actingFor: null, relation: "oneUp" });
  const seen = new Set(out.map((a) => a.employeeId));

  for (const actingFor of [manager, oneUp]) {
    if (actingFor === null) continue;
    for (const g of grants) {
      if (g.level !== "Act" || g.scopeManagerEmployeeId !== actingFor || g.granteeEmployeeId === requesterEmployeeId) continue;
      if (seen.has(g.granteeEmployeeId) || !delegatedScope(g, graph).has(requesterEmployeeId)) continue;
      seen.add(g.granteeEmployeeId);
      out.push({ employeeId: g.granteeEmployeeId, actingFor, relation: "delegate" });
    }
  }
  return out;
}

/**
 * Expiry-notification recipients (§9.3): the direct manager plus anyone acting at the direct
 * manager's level whose scope includes the employee. Nobody higher up.
 */
export function expiryRecipientsFor(employeeId: number, graph: OrgGraph, grants: Grant[]): number[] {
  return approversFor(employeeId, graph, grants)
    .filter((a) => a.relation === "manager" || (a.relation === "delegate" && a.actingFor === graph.managers.get(employeeId)))
    .map((a) => a.employeeId);
}

/**
 * The role a session acts with (§9.1, DECIDED: derived, not assigned). Better Auth splits a role
 * string on commas and grants a permission if any listed role has it, so a Fire Warden with
 * people in scope keeps their own permissions and gains the manager ones.
 */
export function effectiveRole(baseRole: string | null | undefined, mode: AuthorityMode, hasScope: boolean): string {
  const base = baseRole || "User";
  if (mode !== "lineManager" || base === "Admin") return base;
  if (!hasScope) return base === "DepartmentManager" ? "User" : base; // department grants no longer give authority
  if (base === "FireWarden") return "FireWarden,DepartmentManager";
  return "DepartmentManager";
}

/** One line describing a grant, e.g. "Sees Peter Thomas's team, Storeperson only". */
export function describeGrant(g: {
  level: GrantLevel;
  scopeName: string;
  departmentName?: string | null;
  jobFamilyName?: string | null;
}): string {
  const head = g.level === "View" ? `Sees ${g.scopeName}'s team` : `Acts at ${g.scopeName}'s level`;
  const filters = [g.departmentName, g.jobFamilyName].filter(Boolean);
  return filters.length > 0 ? `${head}, ${filters.join(" / ")} only` : head;
}
