// Department → job family cleanup (2026-10-09), now that Workday shows the real structure.
// Several HRT "departments" were really job families (Finance had four). This:
//
//   1. tidies the job family list (renames, one merge, four new ones);
//   2. moves view-only leading hands and planners onto View grants, re-pointing grants whose
//      department is about to go (Zane: Stores → the Storeperson job family);
//   3. folds sub-departments into the real department. Only merges whose training and ticket
//      requirements are identical, so nobody's required training changes. Everything that
//      points at a merged department is re-pointed, then the department is deleted;
//   4. moves people whose department disagrees with their Workday role;
//   5. fills in empty job families from titles (never overwrites one that's set);
//   6. adds the site-resourcing View grants: service and production managers and
//      coordinators see each other's teams, to find who holds the tickets a job needs.
//
// Matched by name, not id, so the same run works on a prod copy. Idempotent: a second run
// finds nothing to do. Run it on prod before replaying Workday decisions exported after it
// ran on the snapshot, since a replay needs both copies to have the same departments.
//
//   pnpm tsx scripts/department-cleanup.ts          # dry run
//   pnpm tsx scripts/department-cleanup.ts --apply
import { PrismaClient, type Prisma } from "@/generated/prisma_client/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const url = (process.env.DATABASE_URL ?? "file:./prisma/dev.db").replace(/^file:/, "");
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });

const APPLY = process.argv.includes("--apply");

// ── What to do ──────────────────────────────────────────────────────────────────

const JOB_FAMILY_RENAMES: [from: string, to: string][] = [
  ["Engineering", "Engineer"],
  ["External Sales/Service Engineer", "External Sales Engineer"],
  ["Internal Sales", "Internal Sales / Customer Service"],
  ["Operations Technician", "Tradesperson"],
  ["Purchasing", "Purchasing Officer"],
  ["Service Admin", "Service Coordinator"],
  ["Workshop Foreman", "Supervisor / Foreman"],
];
/** People and onboarding requests move to the target; the source is deleted. */
const JOB_FAMILY_MERGES: [from: string, into: string][] = [["Service Management", "Manager"]];
const JOB_FAMILY_NEW = ["Accounts & Payroll Officer", "Applications Engineer", "Estimator", "Storeperson"];

/**
 * Title → job family, first match wins. Titles nobody could place from the title alone
 * (Document Controller, Production Planner, Trainee, Labour Hire…) are left for a person.
 */
const TITLE_RULES: [RegExp, string | ((department: string) => string)][] = [
  [/^it /i, "IT"],
  [/^ims /i, "IMS"],
  [/marketing/i, "Marketing"],
  [/purchasing/i, "Purchasing Officer"],
  [/^accountant$/i, "Accountant"],
  [/assistant accountant|accounts payable|payroll/i, "Accounts & Payroll Officer"],
  [
    /managing director|general manager|national .*manager|country manager|financial controller|finance manager|human resources manager|operations manager|service manager|applications manager|tss manager|business unit manager/i,
    "Manager",
  ],
  [/supervisor|forman|foreman/i, "Supervisor / Foreman"],
  [/estimator/i, "Estimator"],
  [/application/i, "Applications Engineer"],
  [/^bdm|business development|b\.d\.|product manager|products manager/i, "BDM/Product Manager"],
  [/sales engineer|external sales|territory man/i, "External Sales Engineer"],
  [/customer service coordinator|spare parts coordinator/i, "Internal Sales / Customer Service"],
  [/project manager/i, "Project Manager"],
  [/project engineer|mechanical (design )?engineer|trainee engineer/i, "Engineer"],
  [/service (contract )?coordinator|service administrator/i, "Service Coordinator"],
  [/service technician|trades assistant|supreserv engineer|trades apprentice|apprentice tradesperson/i, "Service Technician"],
  [/^apprentice$|^electrician$/i, (d) => (d === "Service" ? "Service Technician" : "Tradesperson")],
  [/tradesperson|workshop electrician|employee assembling/i, "Tradesperson"],
  [/store|warehouse trainee/i, "Storeperson"],
];

const DEPARTMENT_MERGES: { into: string; from: string[]; carryManagers: boolean }[] = [
  {
    into: "Finance",
    from: ["Finance Accountant Assistant", "Finance Accountant Management", "Finance Management", "Finance Payables"],
    carryManagers: true,
  },
  // Product Management's only manager is Peter Thomas; carrying it would hand him all of Sales.
  { into: "Sales", from: ["Sales Internal", "Sales External", "Sales Management", "TSS", "Product Management"], carryManagers: false },
  { into: "Projects", from: ["Engineering", "Projects & Planning", "Projects Coordination"], carryManagers: true },
  // Operations is a level-0 parent, so its managers see every operations department: carrying
  // the Stores/Test Bay managers (Peter, Kerrod, Rodrigo) would widen them far past Stores.
  { into: "Operations", from: ["Stores", "Test Bay"], carryManagers: false },
];

const PEOPLE_MOVES: [name: string, to: string][] = [
  ["Githa Labuschagne", "Purchasing"],
  ["Tracey Dawson", "Purchasing"],
  ["Muhammad Daud", "Spare Parts"],
  ["Stephen Wood", "Spare Parts"],
  ["Anthony Smith", "Production"],
  ["Shaun Wooldridge", "Production"],
  ["Craig Dederer", "Production"],
  ["Philip Needham", "Production"],
  ["Frank Radovanovic", "Production"],
];

/** Existing grants (matched by grantee and manager) and what they become. */
const GRANT_UPDATES: { grantee: string; manager: string; level: "View"; department?: string | null; jobFamily?: string | null }[] = [
  { grantee: "Zane Mair", manager: "Peter Thomas", level: "View", department: null, jobFamily: "Storeperson" },
  { grantee: "Kerrod Ward", manager: "Peter Thomas", level: "View", department: "Production" },
  { grantee: "Nathan Dale", manager: "Peter Thomas", level: "View" },
  { grantee: "Hayley Hargrave", manager: "Peter Thomas", level: "View", department: "Production" },
];

const SITE_RESOURCING = {
  grantees: [
    "Marcos Tilly",
    "Rodrigo Monteiro",
    "Peter Thomas",
    "Jaco Tromp",
    "Scott Hertrick",
    "Joshua Noakes",
    "Carolyn Molony",
    "Brody Wagner",
    "Sandra Burkhardt",
  ],
  scopes: [
    { manager: "Marcos Tilly", department: null },
    { manager: "Rodrigo Monteiro", department: null },
    { manager: "Jaco Tromp", department: "Production" },
  ],
};

// ── Helpers ─────────────────────────────────────────────────────────────────────

type Tx = Prisma.TransactionClient;
const key = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
const log = (s: string) => console.log(s);
const problems: string[] = [];

async function history(tx: Tx, tableName: string, recordId: number | string, action: string, oldValues: object | null, newValues: object | null) {
  await tx.history.create({
    data: {
      tableName,
      recordId: String(recordId),
      action,
      changedFields: newValues ? JSON.stringify(Object.keys(newValues)) : null,
      oldValues: oldValues ? JSON.stringify(oldValues) : null,
      newValues: newValues ? JSON.stringify(newValues) : null,
      userId: null,
    },
  });
}

async function employeeIndex(tx: Tx) {
  const all = await tx.employee.findMany({
    select: {
      id: true,
      isActive: true,
      legalFirstName: true,
      legalLastName: true,
      preferredFirstName: true,
      preferredLastName: true,
      reportsToId: true,
      departmentId: true,
    },
  });
  const byName = new Map<string, typeof all>();
  for (const e of all) {
    const names = new Set([
      key(`${e.legalFirstName}${e.legalLastName}`),
      key(`${e.preferredFirstName || e.legalFirstName}${e.preferredLastName || e.legalLastName}`),
    ]);
    for (const n of names) byName.set(n, [...(byName.get(n) ?? []), e]);
  }
  const find = (name: string) => {
    const matches = (byName.get(key(name)) ?? []).filter((e) => e.isActive);
    if (matches.length !== 1) {
      problems.push(`${name}: ${matches.length === 0 ? "no active employee" : "several active employees"} by that name`);
      return null;
    }
    return matches[0];
  };
  const below = (managerId: number) => {
    const out = new Set<number>();
    const queue = [managerId];
    while (queue.length) {
      const m = queue.pop()!;
      for (const e of all) {
        if (!e.isActive || e.reportsToId !== m || out.has(e.id)) continue;
        out.add(e.id);
        queue.push(e.id);
      }
    }
    return out;
  };
  return { find, below, all };
}

async function departmentId(tx: Tx, name: string) {
  const d = await tx.department.findUnique({ where: { name }, select: { id: true } });
  if (!d) problems.push(`Department "${name}" not found`);
  return d?.id ?? null;
}

async function jobFamilyId(tx: Tx, name: string) {
  const j = await tx.jobFamily.findUnique({ where: { name }, select: { id: true } });
  if (!j) problems.push(`Job family "${name}" not found`);
  return j?.id ?? null;
}

// ── Steps ───────────────────────────────────────────────────────────────────────

async function jobFamilies(tx: Tx) {
  log("\n== Job families");
  for (const [from, to] of JOB_FAMILY_RENAMES) {
    const jf = await tx.jobFamily.findUnique({ where: { name: from } });
    if (!jf) continue; // already renamed
    if (await tx.jobFamily.findUnique({ where: { name: to } })) {
      problems.push(`Can't rename job family "${from}": "${to}" already exists`);
      continue;
    }
    log(`  rename  ${from} → ${to}`);
    await tx.jobFamily.update({ where: { id: jf.id }, data: { name: to } });
    await history(tx, "JobFamily", jf.id, "UPDATE", { name: from }, { name: to });
  }
  for (const [from, into] of JOB_FAMILY_MERGES) {
    const source = await tx.jobFamily.findUnique({ where: { name: from } });
    if (!source) continue;
    const target = await jobFamilyId(tx, into);
    if (target === null) continue;
    const people = await tx.employee.findMany({ where: { jobFamilyId: source.id }, select: { id: true } });
    log(`  merge   ${from} → ${into} (${people.length} people)`);
    for (const p of people) {
      await tx.employee.update({ where: { id: p.id }, data: { jobFamilyId: target } });
      await history(tx, "Employee", p.id, "UPDATE", { jobFamilyId: source.id }, { jobFamilyId: target });
    }
    await tx.onboardingRequest.updateMany({ where: { jobFamilyId: source.id }, data: { jobFamilyId: target } });
    await tx.delegatedAccess.updateMany({ where: { jobFamilyId: source.id }, data: { jobFamilyId: target } });
    await tx.jobFamily.delete({ where: { id: source.id } });
    await history(tx, "JobFamily", source.id, "DELETE", { name: from }, null);
  }
  for (const name of JOB_FAMILY_NEW) {
    if (await tx.jobFamily.findUnique({ where: { name } })) continue;
    log(`  create  ${name}`);
    const created = await tx.jobFamily.create({ data: { name } });
    await history(tx, "JobFamily", created.id, "CREATE", null, { name });
  }
}

async function grantUpdates(tx: Tx) {
  log("\n== Leading-hand grants become view-only");
  const { find } = await employeeIndex(tx);
  for (const u of GRANT_UPDATES) {
    const [grantee, manager] = [find(u.grantee), find(u.manager)];
    if (!grantee || !manager) continue;
    const grants = await tx.delegatedAccess.findMany({ where: { granteeEmployeeId: grantee.id, scopeManagerEmployeeId: manager.id } });
    if (grants.length !== 1) {
      if (grants.length > 1) problems.push(`${u.grantee} has ${grants.length} grants on ${u.manager}'s team; expected one`);
      else log(`  -       ${u.grantee}: no grant on ${u.manager}'s team, nothing to change`);
      continue;
    }
    const [g] = grants;
    const data: { level: string; departmentId?: number | null; jobFamilyId?: number | null } = { level: u.level };
    if (u.department !== undefined) data.departmentId = u.department === null ? null : await departmentId(tx, u.department);
    if (u.jobFamily !== undefined) data.jobFamilyId = u.jobFamily === null ? null : await jobFamilyId(tx, u.jobFamily);
    const old = { level: g.level, departmentId: g.departmentId, jobFamilyId: g.jobFamilyId };
    const changed = Object.entries(data).filter(([k, v]) => old[k as keyof typeof old] !== v);
    if (changed.length === 0) continue;
    log(`  ${u.grantee} on ${u.manager}'s team: ${changed.map(([k, v]) => `${k} ${old[k as keyof typeof old]} → ${v}`).join(", ")}`);
    await tx.delegatedAccess.update({ where: { id: g.id }, data });
    await history(tx, "DelegatedAccess", g.id, "UPDATE", old, Object.fromEntries(changed));
  }
}

async function requirementSet(tx: Tx, deptId: number) {
  const [training, tickets] = await Promise.all([
    tx.trainingRequirement.findMany({ where: { departmentId: deptId }, select: { trainingId: true, locationId: true } }),
    tx.ticketRequirement.findMany({ where: { departmentId: deptId }, select: { ticketId: true, locationId: true } }),
  ]);
  return [...training.map((r) => `t${r.trainingId}@${r.locationId}`), ...tickets.map((r) => `k${r.ticketId}@${r.locationId}`)].sort().join(",");
}

/** Active employees whose department changed, so their cached requirements get rebuilt. */
const movedEmployees = new Set<number>();

async function moveEmployee(tx: Tx, e: { id: number; isActive: boolean }, from: number, to: number) {
  await tx.employee.update({ where: { id: e.id }, data: { departmentId: to } });
  await history(tx, "Employee", e.id, "UPDATE", { departmentId: from }, { departmentId: to });
  if (e.isActive) movedEmployees.add(e.id);
}

async function departmentMerges(tx: Tx) {
  log("\n== Department merges");
  for (const merge of DEPARTMENT_MERGES) {
    const target = await departmentId(tx, merge.into);
    if (target === null) continue;
    const targetReqs = await requirementSet(tx, target);
    for (const name of merge.from) {
      const source = await tx.department.findUnique({ where: { name } });
      if (!source) continue; // already merged
      if ((await requirementSet(tx, source.id)) !== targetReqs) {
        problems.push(`${name} → ${merge.into}: training or ticket requirements differ, so merging would change people's required training. Skipped.`);
        continue;
      }
      const employees = await tx.employee.findMany({ where: { departmentId: source.id }, select: { id: true, isActive: true } });
      const managers = await tx.$queryRaw<{ B: string }[]>`SELECT B FROM _DepartmentManager WHERE A = ${source.id}`;
      log(
        `  ${name} → ${merge.into}: ${employees.filter((e) => e.isActive).length} active (+${employees.filter((e) => !e.isActive).length} inactive), ` +
          `${managers.length} department-manager grant(s) ${merge.carryManagers ? "carried" : "dropped"}`,
      );

      for (const e of employees) await moveEmployee(tx, e, source.id, target);
      await tx.onboardingRequest.updateMany({ where: { departmentId: source.id }, data: { departmentId: target } });
      await tx.department.updateMany({ where: { parentDepartmentId: source.id }, data: { parentDepartmentId: target } });
      if (merge.carryManagers) {
        await tx.$executeRaw`INSERT OR IGNORE INTO _DepartmentManager (A, B) SELECT ${target}, B FROM _DepartmentManager WHERE A = ${source.id}`;
      }
      if (managers.length > 0) {
        const users = await tx.user.findMany({ where: { id: { in: managers.map((m) => m.B) } }, select: { id: true, name: true } });
        for (const u of users) {
          log(`      ${u.name}: ${merge.carryManagers ? `manages ${merge.into} instead` : `stops managing ${name}`}`);
          await history(tx, "User", u.id, "UPDATE", { managedDepartments: [name] }, { managedDepartments: merge.carryManagers ? [merge.into] : [] });
        }
      }

      // Delegated grants filtered to the merged department now filter to the real one.
      for (const g of await tx.delegatedAccess.findMany({ where: { departmentId: source.id } })) {
        const duplicate = await tx.delegatedAccess.findFirst({
          where: { granteeEmployeeId: g.granteeEmployeeId, scopeManagerEmployeeId: g.scopeManagerEmployeeId, departmentId: target, jobFamilyId: g.jobFamilyId },
        });
        if (duplicate) {
          await tx.delegatedAccess.delete({ where: { id: g.id } });
          await history(tx, "DelegatedAccess", g.id, "DELETE", g, null);
        } else {
          await tx.delegatedAccess.update({ where: { id: g.id }, data: { departmentId: target } });
          await history(tx, "DelegatedAccess", g.id, "UPDATE", { departmentId: source.id }, { departmentId: target });
        }
        log(`      delegated grant #${g.id} now filters to ${merge.into}`);
      }

      // Ignore rules hold department ids in their value; keep them pointing at the same choice.
      for (const r of await tx.workdayIgnoreRule.findMany({ where: { field: { in: ["department", "delegatedAccess", "staleDelegatedAccess"] } } })) {
        const value =
          r.field === "department"
            ? r.value === String(source.id) ? String(target) : r.value
            : r.value.replace(new RegExp(`^([^:]+):${source.id}(:|$)`), `$1:${target}$2`);
        if (value === r.value) continue;
        const clash = await tx.workdayIgnoreRule.findUnique({ where: { subjectKey_field_value: { subjectKey: r.subjectKey, field: r.field, value } } });
        if (clash) await tx.workdayIgnoreRule.delete({ where: { id: r.id } });
        else await tx.workdayIgnoreRule.update({ where: { id: r.id }, data: { value } });
      }

      // Requirements are identical to the target's (checked above); they go with the department.
      await tx.department.delete({ where: { id: source.id } });
      await history(tx, "Department", source.id, "DELETE", { name: source.name, mergedInto: merge.into }, null);
    }
  }
}

async function peopleMoves(tx: Tx) {
  log("\n== People in the wrong department");
  const { find } = await employeeIndex(tx);
  for (const [name, to] of PEOPLE_MOVES) {
    const e = find(name);
    const target = await departmentId(tx, to);
    if (!e || target === null || e.departmentId === target) continue;
    const from = await tx.department.findUnique({ where: { id: e.departmentId }, select: { name: true, id: true } });
    const [before, after] = [await requirementSet(tx, e.departmentId), await requirementSet(tx, target)];
    const count = (s: string) => (s ? s.split(",").length : 0);
    const training = before === after ? "no training change" : `requirements ${count(before)} → ${count(after)} (all locations)`;
    log(`  ${name}: ${from?.name} → ${to} (${training})`);
    await moveEmployee(tx, e, e.departmentId, target);
  }
}

async function assignJobFamilies(tx: Tx) {
  log("\n== Job families from titles (empty ones only)");
  const [employees, families] = await Promise.all([
    tx.employee.findMany({
      where: { isActive: true },
      select: {
        id: true,
        title: true,
        jobFamilyId: true,
        legalFirstName: true,
        legalLastName: true,
        department: { select: { name: true } },
        jobFamily: { select: { name: true } },
      },
      orderBy: { title: "asc" },
    }),
    tx.jobFamily.findMany({ select: { id: true, name: true } }),
  ]);
  const familyId = new Map(families.map((f) => [f.name, f.id]));
  const unplaced: string[] = [];
  const disagrees: string[] = [];
  const counts = new Map<string, number>();
  for (const e of employees) {
    const title = e.title.trim();
    const rule = TITLE_RULES.find(([re]) => re.test(title));
    const family = rule ? (typeof rule[1] === "string" ? rule[1] : rule[1](e.department.name)) : null;
    const who = `${e.legalFirstName} ${e.legalLastName} (${title || "no title"})`;
    if (e.jobFamilyId !== null) {
      if (family && e.jobFamily?.name !== family) disagrees.push(`${who}: has ${e.jobFamily?.name}, title says ${family}`);
      continue;
    }
    if (!family) {
      unplaced.push(who);
      continue;
    }
    const id = familyId.get(family);
    if (id === undefined) {
      problems.push(`Job family "${family}" missing (rule for "${title}")`);
      continue;
    }
    counts.set(family, (counts.get(family) ?? 0) + 1);
    await tx.employee.update({ where: { id: e.id }, data: { jobFamilyId: id } });
    await history(tx, "Employee", e.id, "UPDATE", { jobFamilyId: null }, { jobFamilyId: id });
  }
  for (const [family, n] of [...counts].sort()) log(`  ${String(n).padStart(3)}  ${family}`);
  if (disagrees.length) log(`  Already set, left alone, title suggests otherwise:\n${disagrees.map((d) => `    - ${d}`).join("\n")}`);
  if (unplaced.length) log(`  No rule fits, set by hand:\n${unplaced.map((u) => `    - ${u}`).join("\n")}`);
}

async function siteResourcingGrants(tx: Tx) {
  log("\n== Site-resourcing View grants");
  const { find, below } = await employeeIndex(tx);
  for (const scope of SITE_RESOURCING.scopes) {
    const manager = find(scope.manager);
    const dept = scope.department === null ? null : await departmentId(tx, scope.department);
    if (!manager || (scope.department !== null && dept === null)) continue;
    for (const name of SITE_RESOURCING.grantees) {
      const grantee = find(name);
      if (!grantee) continue;
      // Their own line already covers that team.
      if (grantee.id === manager.id || below(grantee.id).has(manager.id)) continue;
      const existing = await tx.delegatedAccess.findFirst({
        where: { granteeEmployeeId: grantee.id, scopeManagerEmployeeId: manager.id, departmentId: dept, jobFamilyId: null },
      });
      if (existing) continue;
      log(`  ${name} sees ${scope.manager}'s team${scope.department ? `, ${scope.department} only` : ""}`);
      const created = await tx.delegatedAccess.create({
        data: { granteeEmployeeId: grantee.id, scopeManagerEmployeeId: manager.id, departmentId: dept, jobFamilyId: null, level: "View", source: "Manual" },
      });
      await history(tx, "DelegatedAccess", created.id, "CREATE", null, created);
    }
  }
}

async function invalidateRequirementCaches(tx: Tx) {
  for (const employeeId of movedEmployees) {
    const payload = JSON.stringify({ employeeId });
    const pending = await tx.backgroundJob.findFirst({ where: { type: "REQUIREMENTS_CACHE_INVALIDATE", status: "Pending", payload } });
    if (!pending) await tx.backgroundJob.create({ data: { type: "REQUIREMENTS_CACHE_INVALIDATE", payload, scheduledAt: new Date() } });
  }
  if (movedEmployees.size) log(`\nQueued requirement-cache refreshes for ${movedEmployees.size} people.`);
}

class DryRun extends Error {}

async function main() {
  try {
    await prisma.$transaction(
      async (tx) => {
        await jobFamilies(tx);
        await grantUpdates(tx); // before the merges delete Stores out from under Zane's grant
        await departmentMerges(tx);
        await peopleMoves(tx);
        await assignJobFamilies(tx);
        await siteResourcingGrants(tx);
        await invalidateRequirementCaches(tx);
        if (problems.length) throw new Error(`Stopped, nothing written:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
        if (!APPLY) throw new DryRun();
      },
      { timeout: 60_000 },
    );
    log("\nApplied.");
  } catch (error) {
    if (!(error instanceof DryRun)) throw error;
    log("\nDry run: everything above was rolled back. Re-run with --apply to write it.");
  }
}

main().finally(() => prisma.$disconnect());
