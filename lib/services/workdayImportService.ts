import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma_client/client";
import { findCycles, toManagerMap } from "@/lib/org/reportingLine";
import { matchRows, type MatchEmployee } from "@/lib/workday/matching";
import { parseOrgChart } from "@/lib/workday/parseOrgChart";
import {
  buildSuggestions,
  displayName,
  FLAG_FIELDS,
  isSplitOf,
  preferredNameChange,
  type Line,
  type LineChange,
  type LineField,
  type SuggestEmployee,
} from "@/lib/workday/suggestions";
import { normaliseText, rowLinkKeys, type TreeProblem, type WorkdayRow } from "@/lib/workday/types";
import { buildOrgGraph, delegatedScope, describeGrant, type AuthorityMode, type GrantLevel } from "@/lib/org/authority";
import { getAuthorityMode } from "./authorityService";
import { requirementService } from "./requirementService";
import { validateTree } from "@/lib/workday/parseOrgChart";
import {
  checkIdentity,
  DECISION_BUNDLE_FORMAT,
  type DecisionBundle,
  type IdentityMismatch,
} from "@/lib/workday/decisionBundle";
import { enqueueRequirementsCacheInvalidate } from "./employeeRehire";

/**
 * Workday org import sessions (docs/workday-org-import-spec.md §10–11). A session stores only
 * the parsed rows; every view and every apply recomputes the lines from current HRT data.
 */

const LINE_FIELDS: LineField[] = [
  "reportsTo",
  "title",
  "preferredName",
  "department",
  "delegatedAccess",
  "staleDelegatedAccess",
  "externalReportsTo",
  "externalManagerLeft",
  "notInHrt",
  "inactiveMatch",
  "missingFromWorkday",
];

export interface DepartmentImpact {
  trainingsAdded: string[];
  trainingsRemoved: string[];
  ticketsAdded: string[];
  ticketsRemoved: string[];
  /**
   * Newly required items they haven't satisfied (no record, an expired ticket, or a revision
   * needing retraining; exemptions excluded), so overdue as soon as they move.
   */
  outstanding: string[];
  /** Who would start / stop having authority over them, one entry per rule that applies today. */
  authority: { label: string; gained: string[]; lost: string[] }[];
}

export type ImportLine = Line & { impact?: DepartmentImpact };

export interface ApplyRequest {
  ticked: string[];
  crossed: string[];
  /** lineId → chosen manager, for externalReportsTo lines with several options. */
  choices?: Record<string, number>;
  /** lineId → an edited first/last split, for preferredName lines (§7.3). */
  names?: Record<string, { first: string; last: string }>;
  /** lineId → an edited department filter, for Signal B delegatedAccess lines (§8.2). */
  departments?: Record<string, number>;
}

export interface AppliedChange {
  lineId: string;
  field: LineField;
  employeeId: number;
  employeeName: string;
  /** The manager picked, for a line with several possible managers (needed to replay it). */
  choice?: number;
  /** An edited name split (needed to replay it). */
  split?: { first: string; last: string };
  /** An edited department filter on a delegated grant (needed to replay it). */
  departmentFilter?: number;
  from: string | null;
  to: string | null;
}

export interface ApplyRun {
  userId: string;
  at: string;
  applied: AppliedChange[];
  crossed: string[];
  stale: string[];
}

export class ReplayMismatchError extends Error {
  constructor(public readonly mismatches: IdentityMismatch[]) {
    super("REPLAY_MISMATCH");
  }
}

export interface SkippedLine {
  lineId: string;
  field: string;
  employeeName: string | null;
  /** What the line would have set, readable. */
  value: string;
  /** alreadyDone: HRT already says this (e.g. applied earlier). changed: HRT differs now; review it. */
  status: "alreadyDone" | "changed";
}

export interface ReplayReport {
  links: number;
  ignoreRules: number;
  runs: { fileName: string; at: string; applied: number; skipped: SkippedLine[]; error: string | null }[];
  grantsCreated: number;
  grantsSkipped: number;
  importId: number | null;
}

/** A remembered Workday identity for a row in the session's file. */
export interface RememberedLink {
  key: string;
  workdayName: string;
  /** Null = confirmed "not in HRT". */
  employeeId: number | null;
  employeeName: string | null;
  employeeActive: boolean | null;
}

export class ApplyCycleError extends Error {
  constructor(public readonly people: string[][]) {
    super("CYCLE");
  }
}

export interface PersonSummary {
  id: number;
  name: string;
  title: string;
  isActive: boolean;
  department: string;
  location: string;
  reportsTo: string | null;
}

class WorkdayImportService {
  async createImport(data: ArrayBuffer | Uint8Array, fileName: string, userId: string) {
    const { rows } = parseOrgChart(data);
    return this.createImportFromRows(rows, fileName, userId);
  }

  /** Start a session from already-parsed rows (an upload, or a replayed session). */
  private async createImportFromRows(rows: WorkdayRow[], fileName: string, userId: string) {
    const problems = validateTree(rows);
    return prisma.$transaction(async (tx) => {
      await tx.workdayImport.updateMany({ where: { status: "Open" }, data: { status: "Superseded" } });
      return tx.workdayImport.create({
        data: {
          fileName,
          uploadedByUserId: userId,
          rowCount: rows.length,
          rows: JSON.stringify(rows),
          problems: problems.length ? JSON.stringify(problems) : null,
          status: "Open",
        },
        select: { id: true },
      });
    });
  }

  async listImports() {
    const imports = await prisma.workdayImport.findMany({
      orderBy: { uploadedAt: "desc" },
      take: 20,
      select: { id: true, fileName: true, uploadedAt: true, uploadedByUserId: true, rowCount: true, status: true, runs: true },
    });
    const users = await userNames(imports.map((i) => i.uploadedByUserId));
    return imports.map(({ runs, ...i }) => ({
      ...i,
      uploadedBy: users.get(i.uploadedByUserId) ?? null,
      runCount: (JSON.parse(runs) as ApplyRun[]).length,
    }));
  }

  /** Everything the review page needs, computed fresh. */
  async getImportView(id: number) {
    const session = await prisma.workdayImport.findUnique({ where: { id } });
    if (!session) throw new Error("IMPORT_NOT_FOUND");

    const rows = JSON.parse(session.rows) as WorkdayRow[];
    const runs = JSON.parse(session.runs) as ApplyRun[];
    const users = await userNames([session.uploadedByUserId, ...runs.map((r) => r.userId)]);
    const meta = {
      id: session.id,
      fileName: session.fileName,
      uploadedAt: session.uploadedAt,
      uploadedBy: users.get(session.uploadedByUserId) ?? null,
      rowCount: session.rowCount,
      status: session.status,
      problems: (session.problems ? JSON.parse(session.problems) : []) as TreeProblem[],
      runs: runs.map((r) => ({ ...r, userName: users.get(r.userId) ?? null })),
    };
    if (session.status !== "Open") {
      return {
        ...meta,
        rows,
        lines: [] as ImportLine[],
        ignoredCount: 0,
        people: {} as Record<number, PersonSummary>,
        linkKeys: {} as Record<string, string>,
        links: [] as RememberedLink[],
        departments: [] as { id: number; name: string }[],
        authorityMode: "department" as AuthorityMode,
      };
    }

    const { lines, ignoredCount, people, links, employees, departments, authorityMode } = await this.computeLines(rows, {
      impact: true,
    });
    const linkKeyByUid = rowLinkKeys(rows);
    const rowNameByKey = new Map(rows.map((r) => [linkKeyByUid.get(r.uid)!, r.name]));
    const empById = new Map(employees.map((e) => [e.id, e]));
    // Every remembered link for a row in this file, so any of them can be undone (§6), even
    // for people with nothing left to review.
    const remembered: RememberedLink[] = links
      .filter((l) => rowNameByKey.has(l.workdayNameKey))
      .map((l) => {
        const e = l.employeeId !== null ? empById.get(l.employeeId) : undefined;
        return {
          key: l.workdayNameKey,
          workdayName: rowNameByKey.get(l.workdayNameKey)!,
          employeeId: l.employeeId,
          employeeName: e ? displayName(e) : null,
          employeeActive: e?.isActive ?? null,
        };
      })
      .sort((a, b) => a.workdayName.localeCompare(b.workdayName));
    return {
      ...meta,
      rows,
      lines,
      ignoredCount,
      people,
      linkKeys: Object.fromEntries(linkKeyByUid),
      links: remembered,
      departments: departments.map((d) => ({ id: d.id, name: d.name })).sort((a, b) => a.name.localeCompare(b.name)),
      authorityMode,
    };
  }

  private async computeLines(rows: WorkdayRow[], options: { impact: boolean }) {
    const [employees, departments, links, ignoreRules, existingGrants, onboarding, deptManagers, authorityMode, jobFamilies] = await Promise.all([
      prisma.employee.findMany({
        select: {
          id: true,
          legalFirstName: true,
          legalLastName: true,
          preferredFirstName: true,
          preferredLastName: true,
          title: true,
          isActive: true,
          status: true,
          startDate: true,
          departmentId: true,
          jobFamilyId: true,
          locationId: true,
          reportsToId: true,
          location: { select: { name: true } },
          User: { select: { email: true, role: true } },
        },
      }),
      prisma.department.findMany({ select: { id: true, name: true, parentDepartmentId: true } }),
      prisma.workdayLink.findMany({ select: { workdayNameKey: true, employeeId: true } }),
      prisma.workdayIgnoreRule.findMany({ select: { subjectKey: true, field: true, value: true } }),
      prisma.delegatedAccess.findMany({
        select: { id: true, granteeEmployeeId: true, scopeManagerEmployeeId: true, departmentId: true, jobFamilyId: true, level: true },
      }),
      prisma.onboardingRequest.findMany({
        where: { status: "Approved", createdEmployeeId: { not: null }, managerEmployeeId: { not: null } },
        select: { createdEmployeeId: true, managerEmployeeId: true },
        orderBy: { id: "asc" },
      }),
      prisma.user.findMany({
        where: { employeeId: { not: null }, managedDepartments: { some: {} } },
        select: { employeeId: true, managedDepartments: { select: { id: true } } },
      }),
      getAuthorityMode(),
      prisma.jobFamily.findMany({ select: { id: true, name: true } }),
    ]);

    const suggestEmployees: SuggestEmployee[] = employees.map((e) => ({
      ...e,
      userEmail: e.User?.email ?? null,
      userRole: e.User?.role ?? null,
    }));
    const matches = matchRows(rows, employees as MatchEmployee[], links);

    const onboardingManagers = new Map<number, number>();
    for (const o of onboarding) onboardingManagers.set(o.createdEmployeeId!, o.managerEmployeeId!); // latest wins
    const departmentManagers = new Map<number, number[]>();
    for (const u of deptManagers) {
      for (const d of u.managedDepartments) departmentManagers.set(d.id, [...(departmentManagers.get(d.id) ?? []), u.employeeId!]);
    }

    const result = buildSuggestions({
      rows,
      matches,
      employees: suggestEmployees,
      departments,
      ignoreRules,
      existingGrants,
      jobFamilies: new Map(jobFamilies.map((j) => [j.id, j.name])),
      onboardingManagers,
      departmentManagers,
      lineManagerAuthority: authorityMode === "lineManager",
      now: new Date(),
    });

    const deptName = new Map(departments.map((d) => [d.id, d.name]));
    const empById = new Map(employees.map((e) => [e.id, e]));
    const people: Record<number, PersonSummary> = {};
    const mention = (id: number | null) => {
      if (id === null || people[id]) return;
      const e = empById.get(id);
      if (!e) return;
      const manager = e.reportsToId !== null ? empById.get(e.reportsToId) : undefined;
      people[id] = {
        id,
        name: displayName(e),
        title: e.title,
        isActive: e.isActive,
        department: deptName.get(e.departmentId) ?? "",
        location: e.location.name,
        reportsTo: manager ? displayName(manager) : null,
      };
    };
    for (const l of result.lines) {
      mention(l.employeeId);
      l.candidates?.forEach((c) => mention(c.employeeId));
    }

    const lines: ImportLine[] = options.impact
      ? await this.withDepartmentImpact(result.lines, employees, departments, authorityMode)
      : result.lines;
    return { lines, ignoredCount: result.ignoredCount, people, employees, departments, links, authorityMode };
  }

  /**
   * §7.4: what a department move changes. Training comes from requirementService itself, run
   * as a dry run with the new department. Authority follows whichever mode is on: department
   * mode shows each of today's rules separately (they differ, §3); line-manager mode only
   * department-filtered delegated grants depend on the department.
   */
  private async withDepartmentImpact(
    lines: Line[],
    employees: { id: number; departmentId: number; jobFamilyId: number | null; reportsToId: number | null; isActive: boolean }[],
    departments: { id: number; name: string; parentDepartmentId: number | null }[],
    mode: AuthorityMode,
  ): Promise<ImportLine[]> {
    const deptLines = lines.filter((l) => l.change?.kind === "department");
    if (deptLines.length === 0) return lines;

    const authorityChanges = mode === "lineManager"
      ? await this.lineManagerImpact(employees)
      : await this.departmentModeImpact(departments);

    const out: ImportLine[] = [];
    for (const line of lines) {
      if (line.change?.kind !== "department") {
        out.push(line);
        continue;
      }
      const { employeeId, departmentId: to } = line.change;
      const from = employees.find((e) => e.id === employeeId)?.departmentId;
      if (from === undefined) {
        out.push(line);
        continue;
      }
      const [before, after] = await Promise.all([
        requirementService.getEmployeeRequirements(employeeId),
        requirementService.getEmployeeRequirements(employeeId, { departmentId: to }),
      ]);
      const trainings = (r: typeof before) => new Map(r.allTrainingRequirements.map((q) => [q.trainingId, q.training.title]));
      const tickets = (r: typeof before) => new Map(r.allTicketRequirements.map((q) => [q.ticketId, q.ticket.ticketName]));
      const [oldTraining, newTraining, oldTickets, newTickets] = [trainings(before), trainings(after), tickets(before), tickets(after)];
      const added = <K,>(was: Map<K, string>, now: Map<K, string>) => [...now].filter(([k]) => !was.has(k)).map(([, name]) => name).sort();

      out.push({
        ...line,
        impact: {
          trainingsAdded: added(oldTraining, newTraining),
          trainingsRemoved: added(newTraining, oldTraining),
          ticketsAdded: added(oldTickets, newTickets),
          ticketsRemoved: added(newTickets, oldTickets),
          outstanding: [
            ...new Map(after.trainingRequired.filter((q) => !oldTraining.has(q.trainingId)).map((q) => [q.trainingId, q.training.title])).values(),
            ...new Map(after.ticketRequired.filter((q) => !oldTickets.has(q.ticketId)).map((q) => [q.ticketId, q.ticket.ticketName])).values(),
          ].sort(),
          authority: authorityChanges(employeeId, from, to),
        },
      });
    }
    return out;
  }

  /**
   * Department mode: who sees, approves and gets expiry emails for someone, by department, using
   * each site's own rule (§3). Admins see and approve everyone, so they're left out of those two.
   */
  private async departmentModeImpact(departments: { id: number; parentDepartmentId: number | null }[]) {
    const users = await prisma.user.findMany({
      where: { managedDepartments: { some: {} } },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        employeeId: true,
        canManageChildrenDepartments: true,
        managedDepartments: { select: { id: true, level: true } },
      },
    });
    const childrenOf = new Map<number, number[]>();
    for (const d of departments) {
      if (d.parentDepartmentId !== null) childrenOf.set(d.parentDepartmentId, [...(childrenOf.get(d.parentDepartmentId) ?? []), d.id]);
    }
    const label = (u: (typeof users)[number]) => u.name ?? u.email ?? u.id;
    // apiRBAC.hasAccessToEmployee: DepartmentManager role; level 0 → itself and its children, level 1 → itself.
    const sees = (u: (typeof users)[number], dept: number) =>
      u.role === "DepartmentManager" &&
      u.managedDepartments.some((m) => (m.level === 0 && (m.id === dept || childrenOf.get(m.id)?.includes(dept))) || (m.level === 1 && m.id === dept));
    // approvalService.decidableFilter: any user managing the department; children only with canManageChildrenDepartments.
    const approves = (u: (typeof users)[number], dept: number) =>
      u.role !== "Admin" &&
      u.managedDepartments.some((m) => m.id === dept || (u.canManageChildrenDepartments && childrenOf.get(m.id)?.includes(dept)));
    // expiryNotificationRecipients: managers of the exact department.
    const emailed = (u: (typeof users)[number], dept: number) => !!u.email && u.managedDepartments.some((m) => m.id === dept);

    return (employeeId: number, from: number, to: number) =>
      (
        [
          ["See and manage their records", sees],
          ["Approve their training requests (manager stage)", approves],
          ["Get their ticket expiry emails", emailed],
        ] as const
      ).map(([text, rule]) => {
        const eligible = users.filter((u) => u.employeeId !== employeeId);
        return {
          label: text,
          gained: eligible.filter((u) => rule(u, to) && !rule(u, from)).map(label).sort(),
          lost: eligible.filter((u) => rule(u, from) && !rule(u, to)).map(label).sort(),
        };
      });
  }

  /** Line-manager mode: only grants limited to a department change with someone's department (§8.1). */
  private async lineManagerImpact(employees: { id: number; departmentId: number; jobFamilyId: number | null; reportsToId: number | null; isActive: boolean }[]) {
    const active = employees.filter((e) => e.isActive);
    const [grants, names] = await Promise.all([
      prisma.delegatedAccess.findMany({
        where: { departmentId: { not: null }, grantee: { isActive: true }, scopeManager: { isActive: true } },
        select: { granteeEmployeeId: true, scopeManagerEmployeeId: true, departmentId: true, jobFamilyId: true },
      }),
      prisma.employee.findMany({
        select: { id: true, legalFirstName: true, legalLastName: true, preferredFirstName: true, preferredLastName: true },
      }),
    ]);
    const nameOf = new Map(names.map((e) => [e.id, displayName(e)]));

    return (employeeId: number, _from: number, to: number) => {
      const graph = buildOrgGraph(active);
      const moved = buildOrgGraph(active.map((e) => (e.id === employeeId ? { ...e, departmentId: to } : e)));
      const covering = (g: typeof graph) =>
        new Set(grants.filter((grant) => delegatedScope(grant, g).has(employeeId)).map((grant) => grant.granteeEmployeeId));
      const [before, after] = [covering(graph), covering(moved)];
      const people = (ids: number[]) => ids.map((id) => nameOf.get(id) ?? `#${id}`).sort();
      return [
        {
          label: "Delegated access limited to a department (sees them; an Act grant also approves and gets expiry emails)",
          gained: people([...after].filter((id) => !before.has(id))),
          lost: people([...before].filter((id) => !after.has(id))),
        },
      ];
    };
  }

  // ── Links (saved immediately, §6) ───────────────────────────────────────────────

  async setLink(workdayNameKey: string, workdayName: string, employeeId: number | null, userId: string) {
    if (!/^[a-z_]+$/.test(workdayNameKey)) throw new Error("INVALID_NAME_KEY");
    if (employeeId !== null) {
      const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true } });
      if (!employee) throw new Error("EMPLOYEE_NOT_FOUND");
      // One employee, one Workday identity.
      await prisma.workdayLink.deleteMany({ where: { employeeId, workdayNameKey: { not: workdayNameKey } } });
    }
    return prisma.workdayLink.upsert({
      where: { workdayNameKey },
      create: { workdayNameKey, workdayName, employeeId, confirmedByUserId: userId },
      update: { workdayName, employeeId, confirmedByUserId: userId, confirmedAt: new Date() },
    });
  }

  /**
   * Can a link on this key identify anyone? Not when several rows in the open session share it:
   * matching ignores such a link (§13a), and saving it would only drop the employee's real link.
   */
  async isLinkableKey(workdayNameKey: string): Promise<boolean> {
    const open = await prisma.workdayImport.findMany({ where: { status: "Open" }, select: { rows: true } });
    return open.every((session) => {
      const keys = [...rowLinkKeys(JSON.parse(session.rows) as WorkdayRow[]).values()];
      return keys.filter((k) => k === workdayNameKey).length <= 1;
    });
  }

  async removeLink(workdayNameKey: string) {
    await prisma.workdayLink.deleteMany({ where: { workdayNameKey } });
  }

  // ── Ignore rules ────────────────────────────────────────────────────────────────

  async addIgnoreRule(
    rule: { subjectKey: string; field: string; value: string; note?: string | null; workdayName?: string | null },
    userId: string,
  ) {
    if (!LINE_FIELDS.includes(rule.field as LineField)) throw new Error("INVALID_FIELD");
    const empMatch = rule.subjectKey.match(/^emp:(\d+)$/);
    if (!empMatch && !/^wd:[a-z_]+$/.test(rule.subjectKey)) throw new Error("INVALID_SUBJECT");
    const employeeId = empMatch ? Number(empMatch[1]) : null;

    return prisma.workdayIgnoreRule.upsert({
      where: { subjectKey_field_value: { subjectKey: rule.subjectKey, field: rule.field, value: rule.value } },
      create: {
        subjectKey: rule.subjectKey,
        employeeId,
        field: rule.field,
        value: rule.value,
        workdayName: rule.workdayName ?? null,
        note: rule.note?.trim() || null,
        createdByUserId: userId,
      },
      update: { note: rule.note?.trim() || null },
    });
  }

  async listIgnoreRules() {
    const rules = await prisma.workdayIgnoreRule.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        employee: {
          select: { legalFirstName: true, legalLastName: true, preferredFirstName: true, preferredLastName: true },
        },
      },
    });
    const [users, employees, departments] = await Promise.all([
      userNames(rules.map((r) => r.createdByUserId)),
      prisma.employee.findMany({
        select: { id: true, legalFirstName: true, legalLastName: true, preferredFirstName: true, preferredLastName: true },
      }),
      prisma.department.findMany({ select: { id: true, name: true } }),
    ]);
    const empName = new Map(employees.map((e) => [String(e.id), displayName(e)]));
    const deptName = new Map(departments.map((d) => [String(d.id), d.name]));

    // Turn the normalised stored value (§7) back into something readable.
    const valueLabel = (field: string, value: string): string => {
      if (value === "") return "";
      if (value === "none") return "No manager";
      // A line blocked on an unlinked row stores its link key (delegated access adds ":<dept>").
      if (value.startsWith("wd:")) return `Workday: ${value.slice(3).replace(/:\d*$/, "")}`;
      if (value.startsWith("pick:")) {
        return `One of ${value.slice(5).split(",").map((id) => empName.get(id) ?? `#${id}`).join(", ")}`;
      }
      switch (field) {
        case "reportsTo":
        case "externalReportsTo":
        case "externalManagerLeft":
          return empName.get(value) ?? `#${value}`;
        case "department":
          return deptName.get(value) ?? `#${value}`;
        case "preferredName":
          return value.replace("|", " ");
        case "delegatedAccess":
        case "staleDelegatedAccess": {
          const [manager, dept] = value.split(":");
          const scope = `Acts at ${empName.get(manager) ?? `#${manager}`}'s level`;
          const grant = dept ? `${scope}, ${deptName.get(dept) ?? `#${dept}`} only` : scope;
          return field === "staleDelegatedAccess" ? `Remove: ${grant}` : grant;
        }
        default:
          return value;
      }
    };

    return rules.map(({ employee, ...r }) => ({
      ...r,
      personName: employee ? displayName(employee) : r.workdayName,
      valueLabel: valueLabel(r.field, r.value),
      createdBy: users.get(r.createdByUserId) ?? null,
    }));
  }

  async removeIgnoreRule(id: number) {
    await prisma.workdayIgnoreRule.delete({ where: { id } });
  }

  async discard(id: number) {
    await prisma.workdayImport.update({ where: { id }, data: { status: "Discarded" } });
  }

  // ── Apply (§10) ─────────────────────────────────────────────────────────────────

  async apply(id: number, request: ApplyRequest, userId: string): Promise<ApplyRun> {
    const session = await prisma.workdayImport.findUnique({ where: { id } });
    if (!session) throw new Error("IMPORT_NOT_FOUND");
    if (session.status !== "Open") throw new Error("IMPORT_NOT_OPEN");

    const rows = JSON.parse(session.rows) as WorkdayRow[];
    const { lines, employees, departments } = await this.computeLines(rows, { impact: false });
    const byId = new Map(lines.map((l) => [l.id, l]));
    const deptIds = new Set(departments.map((d) => d.id));

    // Re-check every ticked line against the fresh calculation; never apply a stored value.
    const stale: string[] = [];
    const changes: { line: Line; change: LineChange }[] = [];
    for (const lineId of new Set(request.ticked)) {
      const line = byId.get(lineId);
      if (!line || line.blocked || !line.change || FLAG_FIELDS.includes(line.field)) {
        stale.push(lineId);
        continue;
      }
      let change = line.change;
      if (line.options && change.kind === "reportsTo") {
        const choice = request.choices?.[lineId];
        if (choice === undefined || !line.options.some((o) => o.employeeId === choice)) {
          stale.push(lineId);
          continue;
        }
        change = { ...change, reportsToId: choice };
      }
      // An edited split must be the same Workday name, re-divided; anything else is refused.
      const split = request.names?.[lineId];
      if (split && change.kind === "preferredName") {
        const subjectId = change.employeeId;
        const e = employees.find((x) => x.id === subjectId);
        if (!e || !line.workdayName || !isSplitOf(line.workdayName, split.first, split.last)) {
          stale.push(lineId);
          continue;
        }
        change = { ...change, ...preferredNameChange(e, split.first, split.last) };
      }
      const filter = request.departments?.[lineId];
      if (filter !== undefined && change.kind === "delegatedAccess") {
        if (!line.departmentEditable || !deptIds.has(filter)) {
          stale.push(lineId);
          continue;
        }
        change = { ...change, departmentId: filter };
      }
      changes.push({ line, change });
    }
    const chosen = (lineId: string) => (byId.get(lineId)?.options ? request.choices?.[lineId] : undefined);
    const editedSplit = (lineId: string) => (byId.get(lineId)?.split ? request.names?.[lineId] : undefined);

    const empById = new Map(employees.map((e) => [e.id, e]));
    const deptName = new Map(departments.map((d) => [d.id, d.name]));
    const nameOf = (eid: number | null) => {
      if (eid === null) return null;
      const e = empById.get(eid);
      return e ? displayName(e) : `#${eid}`;
    };
    const order: LineChange["kind"][] = [
      "preferredName",
      "title",
      "reportsTo",
      "department",
      "removeDelegatedAccess",
      "delegatedAccess",
    ];
    changes.sort((a, b) => order.indexOf(a.change.kind) - order.indexOf(b.change.kind));

    const applied: AppliedChange[] = [];
    const departmentMoves: number[] = [];

    await prisma.$transaction(async (tx) => {
      const updates = new Map<number, { data: Prisma.EmployeeUncheckedUpdateInput; fields: string[] }>();
      const updateFor = (eid: number) => {
        let u = updates.get(eid);
        if (!u) updates.set(eid, (u = { data: {}, fields: [] }));
        return u;
      };
      const managers = toManagerMap(employees.map((e) => ({ id: e.id, reportsToId: e.reportsToId })));

      for (const { line, change } of changes) {
        if (change.kind === "removeDelegatedAccess") {
          const removed = await deleteGrantInTx(tx, change.grantId, userId);
          if (removed) {
            applied.push({
              lineId: line.id,
              field: line.field,
              employeeId: change.granteeEmployeeId,
              employeeName: nameOf(change.granteeEmployeeId) ?? "",
              from: line.current,
              to: null,
            });
          }
          continue;
        }
        if (change.kind === "delegatedAccess") {
          const grant = await createGrantInTx(tx, {
            granteeEmployeeId: change.granteeEmployeeId,
            scopeManagerEmployeeId: change.scopeManagerEmployeeId,
            departmentId: change.departmentId,
            jobFamilyId: null,
            level: change.level,
            source: change.source,
            createdByUserId: userId,
          });
          const filter = line.departmentEditable ? request.departments?.[line.id] : undefined;
          if (grant) {
            const scope = nameOf(change.scopeManagerEmployeeId);
            applied.push({
              lineId: line.id,
              field: line.field,
              employeeId: change.granteeEmployeeId,
              employeeName: nameOf(change.granteeEmployeeId) ?? "",
              departmentFilter: filter,
              from: null,
              to: describeGrant({
                level: change.level,
                scopeName: scope ?? `#${change.scopeManagerEmployeeId}`,
                departmentName: change.departmentId === null ? null : (deptName.get(change.departmentId) ?? "one department"),
              }),
            });
          } else {
            stale.push(line.id); // an identical grant already exists (e.g. the edited filter)
          }
          continue;
        }
        const e = empById.get(change.employeeId);
        if (!e) continue;
        const u = updateFor(e.id);
        let from: string | null = null;
        let to: string | null = null;
        if (change.kind === "title") {
          u.data.title = change.title;
          u.fields.push("title");
          [from, to] = [e.title, change.title];
        } else if (change.kind === "preferredName") {
          u.data.preferredFirstName = change.preferredFirstName;
          u.data.preferredLastName = change.preferredLastName;
          u.fields.push("preferredFirstName", "preferredLastName");
          [from, to] = [displayName(e), displayName({ ...e, ...change })];
        } else if (change.kind === "reportsTo") {
          u.data.reportsToId = change.reportsToId;
          u.fields.push("reportsToId");
          managers.set(e.id, change.reportsToId);
          [from, to] = [nameOf(e.reportsToId), nameOf(change.reportsToId)];
        } else if (change.kind === "department") {
          u.data.departmentId = change.departmentId;
          u.fields.push("departmentId");
          departmentMoves.push(e.id);
          [from, to] = [deptName.get(e.departmentId) ?? null, deptName.get(change.departmentId) ?? null];
        }
        applied.push({
          lineId: line.id,
          field: line.field,
          employeeId: e.id,
          employeeName: displayName(e),
          choice: chosen(line.id),
          split: change.kind === "preferredName" ? editedSplit(line.id) : undefined,
          from,
          to,
        });
      }

      // Only loops this apply would create; an existing hand-made loop shouldn't block every import.
      const cycles = findCycles(managers).filter((c) => c.some((eid) => updates.get(eid)?.fields.includes("reportsToId")));
      if (cycles.length > 0) {
        throw new ApplyCycleError(cycles.map((c) => c.map((eid) => nameOf(eid) ?? `#${eid}`)));
      }

      for (const [eid, { data, fields }] of updates) {
        const before = await tx.employee.findUniqueOrThrow({ where: { id: eid } });
        await tx.employee.update({ where: { id: eid }, data });
        const oldValues = Object.fromEntries(fields.map((f) => [f, before[f as keyof typeof before]]));
        await tx.history.create({
          data: {
            tableName: "Employee",
            recordId: String(eid),
            action: "UPDATE",
            changedFields: JSON.stringify(fields),
            oldValues: JSON.stringify(oldValues),
            newValues: JSON.stringify({ ...data, source: `WorkdayImport#${id}` }),
            userId,
          },
        });
      }

      const ticked = new Set(request.ticked);
      const run: ApplyRun = {
        userId,
        at: new Date().toISOString(),
        applied,
        crossed: [...new Set(request.crossed)].filter((l) => !ticked.has(l)),
        stale,
      };
      const runs = JSON.parse(session.runs) as ApplyRun[];
      await tx.workdayImport.update({ where: { id }, data: { runs: JSON.stringify([...runs, run]) } });
    });

    // A department move changes required training (§4).
    for (const eid of departmentMoves) await enqueueRequirementsCacheInvalidate(eid);

    const saved = await prisma.workdayImport.findUniqueOrThrow({ where: { id }, select: { runs: true } });
    const runs = JSON.parse(saved.runs) as ApplyRun[];
    return runs[runs.length - 1];
  }

  // ── Moving decisions between copies of HRT ──────────────────────────────────────

  /**
   * Explain replayed lines that weren't applied: already true here (nothing to do), or HRT has
   * changed since the export (needs a look). Line ids are `subjectKey~field~value` (§7).
   */
  private async describeSkipped(
    lineIds: string[],
    choices: Record<string, number>,
    names: Record<string, { first: string; last: string }> = {},
    filters: Record<string, number> = {},
  ): Promise<SkippedLine[]> {
    if (lineIds.length === 0) return [];
    const [employees, departments, grants] = await Promise.all([
      prisma.employee.findMany({
        select: {
          id: true,
          legalFirstName: true,
          legalLastName: true,
          preferredFirstName: true,
          preferredLastName: true,
          title: true,
          departmentId: true,
          reportsToId: true,
        },
      }),
      prisma.department.findMany({ select: { id: true, name: true } }),
      prisma.delegatedAccess.findMany({ select: { id: true, granteeEmployeeId: true, scopeManagerEmployeeId: true, departmentId: true } }),
    ]);
    const empById = new Map(employees.map((e) => [e.id, e]));
    const deptName = new Map(departments.map((d) => [d.id, d.name]));
    const nameOf = (id: number) => (empById.get(id) ? displayName(empById.get(id)!) : `Employee #${id}`);

    return lineIds.map((lineId): SkippedLine => {
      const [subjectKey, field, value = ""] = lineId.split("~");
      const empId = subjectKey.startsWith("emp:") ? Number(subjectKey.slice(4)) : null;
      const e = empId !== null ? empById.get(empId) : undefined;
      let label = value;
      let done = false;
      switch (field) {
        case "reportsTo":
        case "externalReportsTo": {
          const target = value === "none" ? null : value.startsWith("pick:") ? (choices[lineId] ?? NaN) : Number(value);
          label = target === null ? "No manager" : Number.isNaN(target) ? "a chosen manager" : nameOf(target);
          done = !!e && e.reportsToId === target;
          break;
        }
        case "title":
          done = !!e && normaliseText(e.title) === value;
          break;
        case "preferredName": {
          const [first, last] = names[lineId] ? [normaliseText(names[lineId].first), normaliseText(names[lineId].last)] : value.split("|");
          label = `${first} ${last}`;
          done =
            !!e &&
            normaliseText(e.preferredFirstName || e.legalFirstName) === first &&
            normaliseText(e.preferredLastName || e.legalLastName) === last;
          break;
        }
        case "department":
          label = deptName.get(Number(value)) ?? `#${value}`;
          done = !!e && e.departmentId === Number(value);
          break;
        case "delegatedAccess":
        case "staleDelegatedAccess": {
          const [manager, stored] = value.split(":");
          const dept = field === "delegatedAccess" && filters[lineId] !== undefined ? String(filters[lineId]) : stored;
          const grant = `Acts at ${nameOf(Number(manager))}'s level${dept ? `, ${deptName.get(Number(dept)) ?? `#${dept}`} only` : ""}`;
          const exists = grants.some(
            (g) =>
              g.granteeEmployeeId === empId &&
              g.scopeManagerEmployeeId === Number(manager) &&
              g.departmentId === (dept ? Number(dept) : null),
          );
          label = field === "staleDelegatedAccess" ? `Remove: ${grant}` : grant;
          done = field === "staleDelegatedAccess" ? !exists : exists;
          break;
        }
      }
      return {
        lineId,
        field,
        employeeName: e ? displayName(e) : null,
        value: label,
        status: done ? "alreadyDone" : "changed",
      };
    });
  }

  /** Everything the review produced, for replaying on another copy (e.g. snapshot → prod). */
  async exportDecisions(): Promise<DecisionBundle> {
    const [employees, departments, jobFamilies, links, rules, grants, imports] = await Promise.all([
      prisma.employee.findMany({ select: { id: true, legalFirstName: true, legalLastName: true } }),
      prisma.department.findMany({ select: { id: true, name: true } }),
      prisma.jobFamily.findMany({ select: { id: true, name: true } }),
      prisma.workdayLink.findMany({ orderBy: { confirmedAt: "asc" } }),
      prisma.workdayIgnoreRule.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.delegatedAccess.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.workdayImport.findMany({ orderBy: { uploadedAt: "asc" } }),
    ]);

    return {
      format: DECISION_BUNDLE_FORMAT,
      version: 1,
      exportedAt: new Date().toISOString(),
      employees: Object.fromEntries(employees.map((e) => [e.id, `${e.legalFirstName} ${e.legalLastName}`])),
      departments: Object.fromEntries(departments.map((d) => [d.id, d.name])),
      jobFamilies: Object.fromEntries(jobFamilies.map((j) => [j.id, j.name])),
      links: links.map((l) => ({ workdayNameKey: l.workdayNameKey, workdayName: l.workdayName, employeeId: l.employeeId })),
      ignoreRules: rules.map((r) => ({
        subjectKey: r.subjectKey,
        field: r.field,
        value: r.value,
        note: r.note,
        workdayName: r.workdayName,
      })),
      grants: grants.map((g) => ({
        granteeEmployeeId: g.granteeEmployeeId,
        scopeManagerEmployeeId: g.scopeManagerEmployeeId,
        departmentId: g.departmentId,
        jobFamilyId: g.jobFamilyId,
        level: g.level === "Act" ? ("Act" as const) : ("View" as const),
        source: g.source,
      })),
      sessions: imports
        .map((i) => ({
          fileName: i.fileName,
          uploadedAt: i.uploadedAt.toISOString(),
          rows: JSON.parse(i.rows) as WorkdayRow[],
          runs: (JSON.parse(i.runs) as ApplyRun[])
            .filter((r) => r.applied.length > 0)
            .map((r) => ({
              at: r.at,
              applied: r.applied.map((a) => a.lineId),
              choices: Object.fromEntries(r.applied.filter((a) => a.choice !== undefined).map((a) => [a.lineId, a.choice!])),
              names: Object.fromEntries(r.applied.filter((a) => a.split !== undefined).map((a) => [a.lineId, a.split!])),
              departments: Object.fromEntries(
                r.applied.filter((a) => a.departmentFilter !== undefined).map((a) => [a.lineId, a.departmentFilter!]),
              ),
            })),
        }))
        .filter((s) => s.runs.length > 0),
    };
  }

  /**
   * Replay an exported bundle here. Refuses to touch anything unless this is a copy of the same
   * HRT (same ids and names). Each apply is re-run in order through the normal apply path, so
   * anything that changed since the export is skipped and reported, never forced.
   */
  async replayDecisions(bundle: DecisionBundle, userId: string): Promise<ReplayReport> {
    const [employees, departments] = await Promise.all([
      prisma.employee.findMany({ select: { id: true, legalFirstName: true, legalLastName: true } }),
      prisma.department.findMany({ select: { id: true, name: true } }),
    ]);
    const mismatches = checkIdentity(bundle, {
      employees: new Map(employees.map((e) => [e.id, `${e.legalFirstName} ${e.legalLastName}`])),
      departments: new Map(departments.map((d) => [d.id, d.name])),
    });
    if (mismatches.length > 0) throw new ReplayMismatchError(mismatches);

    // Identity and ignore rules first, so the replayed lines come out the same as they did there.
    for (const link of bundle.links) {
      await this.setLink(link.workdayNameKey, link.workdayName, link.employeeId, userId);
    }
    for (const rule of bundle.ignoreRules) await this.addIgnoreRule(rule, userId);

    const report: ReplayReport = {
      links: bundle.links.length,
      ignoreRules: bundle.ignoreRules.length,
      runs: [],
      grantsCreated: 0,
      grantsSkipped: 0,
      importId: null,
    };

    for (const session of bundle.sessions) {
      const { id } = await this.createImportFromRows(session.rows, `${session.fileName} (replayed)`, userId);
      report.importId = id;
      for (const run of session.runs) {
        try {
          const result = await this.apply(
            id,
            { ticked: run.applied, crossed: [], choices: run.choices, names: run.names, departments: run.departments },
            userId,
          );
          report.runs.push({
            fileName: session.fileName,
            at: run.at,
            applied: result.applied.length,
            skipped: await this.describeSkipped(result.stale, run.choices, run.names, run.departments),
            error: null,
          });
        } catch (error) {
          const message =
            error instanceof ApplyCycleError
              ? `Would create a reporting loop: ${error.people.map((l) => l.join(" → ")).join("; ")}`
              : error instanceof Error
                ? error.message
                : String(error);
          report.runs.push({
            fileName: session.fileName,
            at: run.at,
            applied: 0,
            skipped: await this.describeSkipped(run.applied, run.choices, run.names, run.departments),
            error: message,
          });
        }
      }
    }

    // Grants made outside the import (switch-over page) and any the runs didn't recreate.
    const jobFamilyByName = new Map(
      (await prisma.jobFamily.findMany({ select: { id: true, name: true } })).map((j) => [normaliseText(j.name), j.id]),
    );
    await prisma.$transaction(async (tx) => {
      for (const g of bundle.grants) {
        let jobFamilyId: number | null = null;
        if (g.jobFamilyId != null) {
          const name = bundle.jobFamilies?.[g.jobFamilyId];
          const target = name !== undefined ? jobFamilyByName.get(normaliseText(name)) : undefined;
          if (target === undefined) {
            report.grantsSkipped++; // never widen a grant by dropping a filter it can't map
            continue;
          }
          jobFamilyId = target;
        }
        const created = await createGrantInTx(tx, { ...g, jobFamilyId, level: g.level ?? "Act", createdByUserId: userId });
        if (created) report.grantsCreated++;
        else report.grantsSkipped++;
      }
    });

    return report;
  }
}

/**
 * Create a delegated-access grant inside a transaction, writing History. Returns null when a
 * grant with the same scope and filters already exists, whatever its level (NULL filters
 * aren't unique in SQLite, so check first).
 */
export async function createGrantInTx(
  tx: Prisma.TransactionClient,
  grant: {
    granteeEmployeeId: number;
    scopeManagerEmployeeId: number;
    departmentId: number | null;
    jobFamilyId?: number | null;
    level?: GrantLevel;
    source: string;
    createdByUserId: string;
  },
) {
  const existing = await tx.delegatedAccess.findFirst({
    where: {
      granteeEmployeeId: grant.granteeEmployeeId,
      scopeManagerEmployeeId: grant.scopeManagerEmployeeId,
      departmentId: grant.departmentId,
      jobFamilyId: grant.jobFamilyId ?? null,
    },
  });
  if (existing) return null;
  const created = await tx.delegatedAccess.create({ data: grant });
  await tx.history.create({
    data: {
      tableName: "DelegatedAccess",
      recordId: String(created.id),
      action: "CREATE",
      newValues: JSON.stringify(created),
      userId: grant.createdByUserId,
    },
  });
  return created;
}

/** Delete a delegated-access grant inside a transaction, writing History. Null if already gone. */
export async function deleteGrantInTx(tx: Prisma.TransactionClient, grantId: number, userId: string) {
  const existing = await tx.delegatedAccess.findUnique({ where: { id: grantId } });
  if (!existing) return null;
  await tx.delegatedAccess.delete({ where: { id: grantId } });
  await tx.history.create({
    data: {
      tableName: "DelegatedAccess",
      recordId: String(grantId),
      action: "DELETE",
      oldValues: JSON.stringify(existing),
      userId,
    },
  });
  return existing;
}

async function userNames(ids: string[]): Promise<Map<string, string>> {
  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set(ids)] } },
    select: { id: true, name: true, email: true },
  });
  return new Map(users.map((u) => [u.id, u.name ?? u.email ?? u.id]));
}

export const workdayImportService = new WorkdayImportService();
