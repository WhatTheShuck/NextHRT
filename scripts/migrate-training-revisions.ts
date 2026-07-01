/**
 * migrate-training-revisions.ts
 *
 * Folds legacy per-edition Training rows into a single parent Training plus dated
 * TrainingRevision entries. Detects three title conventions:
 *
 *   1. year-suffix   "Base Title 2023" / "Base Title 2023 Edition"
 *   2. year-prefix   "2024 Base Title"
 *   3. sop-date      "Base Title 2014/02/20 - Task Sheet"  (date in the middle; the
 *                     part after the date — e.g. "Task Sheet" / "Practical" — is kept,
 *                     so Task Sheet and Practical fold into SEPARATE parents)
 *
 * For each detected concept the script: creates one revision per edition (effectiveDate
 * derived from the title, requiresRetraining left at the type default = false so
 * compliance is unchanged on day one — spec §4), re-points that edition's records onto
 * the parent stamped with the revision, moves the edition's requirements/exemptions onto
 * the parent, and marks the now-empty edition inactive (rows preserved for audit).
 *
 * Each cluster is applied in a single transaction.
 *
 * Usage:
 *   pnpm tsx scripts/migrate-training-revisions.ts          # dry-run report (default)
 *   pnpm tsx scripts/migrate-training-revisions.ts --apply  # apply changes
 */

import { PrismaClient, Category } from "@/generated/prisma_client/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const url = (process.env.DATABASE_URL ?? "file:./prisma/dev.db").replace(/^file:/, "");
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });

const APPLY = process.argv.includes("--apply");

type PatternKind = "year-suffix" | "year-prefix" | "date";

// "Base Title 2023" or "Base Title 2023 Edition"
const YEAR_SUFFIX_RE = /^(.+?)\s+((?:19|20)\d{2})(?:\s+Edition)?$/i;
// "2024 Base Title"
const YEAR_PREFIX_RE = /^((?:19|20)\d{2})\s+(.+)$/;
// "Base yy.mm.dd" / "Base yyyy/mm/dd", with an OPTIONAL trailing deliverable suffix
// in either "- Task Sheet" (dash) or "(Reviewer)" (paren) form. Handles 2- or 4-digit years.
const DATE_RE =
  /^(.+?)\s+((?:\d{4}|\d{2})[./]\d{2}[./]\d{2})(?:\s*-\s*(.+?)|\s*\((.+?)\))?\s*$/;
const DATE_PARTS_RE = /^(\d{4}|\d{2})[./](\d{2})[./](\d{2})$/;

// Known wording drift that should NOT split a concept (auto-merge — word-level, conservative).
const TYPO_FIXES: Record<string, string> = {
  continious: "continuous",
  communications: "communication",
  homes: "home",
};

// The canonical parent name defaults to the newest edition's title; override the few that
// come out awkward (the newest edition carried a typo or a verbose parenthetical).
const PARENT_TITLE_OVERRIDES: Record<string, string> = {
  "Working From Homes Policy": "Working From Home Policy",
  "Water Management (inc. stormwater, tradewaste)": "Water Management",
};

/** Expand a 2-digit year (10 -> 2010, 95 -> 1995); pass 4-digit years through. */
function fullYear(y: string): number {
  if (y.length === 4) return parseInt(y, 10);
  const n = parseInt(y, 10);
  return n <= 79 ? 2000 + n : 1900 + n;
}

/**
 * Normalise a concept base for CLUSTERING ONLY (not for display): lower-case, drop
 * incidental parentheticals like "(inc. stormwater)", strip a trailing "Policy", collapse
 * whitespace/punctuation, and fold known typos. Reviewer/Refresher are handled via the
 * separate suffix, so they are NOT stripped here and stay on their own parent.
 */
function normalizeBaseKey(base: string): string {
  let s = base.toLowerCase();
  s = s.replace(/\([^)]*\)/g, " "); // drop incidental parentheticals in the base
  s = s.replace(/[.,]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/\bpolicy$/, "").trim(); // "...Devices Policy" === "...Devices"
  s = s
    .split(" ")
    .map((w) => TYPO_FIXES[w] ?? w)
    .join(" ");
  return s.replace(/\s+/g, " ").trim();
}

interface Parsed {
  base: string; // concept name as written, before the date/year
  suffix: string | null; // deliverable distinction: Reviewer / Refresher / Task Sheet / Practical
  suffixStyle: "dash" | "paren" | null;
  revisionLabel: string;
  effectiveDate: Date;
  pattern: PatternKind;
}

/** Parse a training title into its concept base + the revision it represents, or null. */
function parseTitle(title: string): Parsed | null {
  const dm = title.match(DATE_RE);
  if (dm) {
    const [, base, dateStr, dashSuffix, parenSuffix] = dm;
    const parts = dateStr.match(DATE_PARTS_RE)!;
    const suffix = dashSuffix ?? parenSuffix ?? null;
    return {
      base: base.trim(),
      suffix: suffix ? suffix.trim() : null,
      suffixStyle: dashSuffix ? "dash" : parenSuffix ? "paren" : null,
      revisionLabel: dateStr,
      effectiveDate: new Date(
        Date.UTC(fullYear(parts[1]), parseInt(parts[2], 10) - 1, parseInt(parts[3], 10)),
      ),
      pattern: "date",
    };
  }
  const sm = title.match(YEAR_SUFFIX_RE);
  if (sm) {
    const [, base, y] = sm;
    return {
      base: base.trim(),
      suffix: null,
      suffixStyle: null,
      revisionLabel: `${y} Edition`,
      effectiveDate: new Date(`${y}-01-01T00:00:00.000Z`),
      pattern: "year-suffix",
    };
  }
  const pm = title.match(YEAR_PREFIX_RE);
  if (pm) {
    const [, y, base] = pm;
    return {
      base: base.trim(),
      suffix: null,
      suffixStyle: null,
      revisionLabel: `${y} Edition`,
      effectiveDate: new Date(`${y}-01-01T00:00:00.000Z`),
      pattern: "year-prefix",
    };
  }
  return null;
}

/** Display title for a parent, derived from one edition's parsed base + suffix. */
function formatParentTitle(p: Parsed): string {
  if (!p.suffix) return p.base;
  return p.suffixStyle === "paren" ? `${p.base} (${p.suffix})` : `${p.base} - ${p.suffix}`;
}

interface Edition {
  id: number;
  title: string;
  category: Category;
  isActive: boolean;
  recordCount: number;
  requirementCount: number;
  exemptionCount: number;
  parsed: Parsed;
}

interface Cluster {
  category: Category;
  parentTitle: string;
  pattern: PatternKind;
  editions: Edition[];
}

async function buildClusters(): Promise<Cluster[]> {
  const trainings = await prisma.training.findMany({
    include: {
      _count: {
        select: { trainingRecords: true, requirements: true, trainingExemptions: true },
      },
    },
    orderBy: [{ category: "asc" }, { title: "asc" }],
  });

  const editionsByKey = new Map<string, Edition[]>();
  for (const t of trainings) {
    const parsed = parseTitle(t.title);
    if (!parsed) continue;
    // Key folds wording drift (normalised base) but keeps the deliverable suffix distinct,
    // so "X" and "X (Reviewer)" land on separate parents.
    const key = `${t.category}::${normalizeBaseKey(parsed.base)}::${(parsed.suffix ?? "").toLowerCase()}`;
    const edition: Edition = {
      id: t.id,
      title: t.title,
      category: t.category,
      isActive: t.isActive,
      recordCount: t._count.trainingRecords,
      requirementCount: t._count.requirements,
      exemptionCount: t._count.trainingExemptions,
      parsed,
    };
    editionsByKey.set(key, [...(editionsByKey.get(key) ?? []), edition]);
  }

  const clusters: Cluster[] = [];
  for (const editions of editionsByKey.values()) {
    if (editions.length < 2) continue; // only multi-edition concepts are candidates
    editions.sort((a, b) => a.parsed.effectiveDate.getTime() - b.parsed.effectiveDate.getTime());
    const newest = editions[editions.length - 1]; // newest edition supplies the canonical parent name
    const derivedTitle = formatParentTitle(newest.parsed);
    clusters.push({
      category: newest.category,
      parentTitle: PARENT_TITLE_OVERRIDES[derivedTitle] ?? derivedTitle,
      pattern: newest.parsed.pattern,
      editions,
    });
  }
  return clusters.sort(
    (a, b) => a.category.localeCompare(b.category) || a.parentTitle.localeCompare(b.parentTitle),
  );
}

async function report(clusters: Cluster[]) {
  if (clusters.length === 0) {
    console.log("No multi-edition training clusters detected. Nothing to do.");
    return;
  }
  console.log(`\nDetected ${clusters.length} cluster(s):\n`);

  let totalRecords = 0;
  let totalConflicts = 0;
  let totalReqs = 0;

  for (const cluster of clusters) {
    const clusterRecords = cluster.editions.reduce((s, e) => s + e.recordCount, 0);
    const clusterReqs = cluster.editions.reduce((s, e) => s + e.requirementCount, 0);
    totalRecords += clusterRecords;
    totalReqs += clusterReqs;

    console.log(`  [${cluster.category}] "${cluster.parentTitle}"  (${cluster.pattern})`);
    for (const e of cluster.editions) {
      console.log(
        `      #${e.id} "${e.title}" — ${e.recordCount} record(s), ${e.requirementCount} requirement(s), ${e.exemptionCount} exemption(s)${e.isActive ? "" : " [inactive]"}`,
      );
    }

    const existingParent = await prisma.training.findFirst({
      where: { title: cluster.parentTitle, category: cluster.category },
    });
    console.log(
      existingParent
        ? `    Parent already exists: #${existingParent.id} "${existingParent.title}"`
        : `    Parent would be created: "${cluster.parentTitle}" [${cluster.category}]`,
    );

    // Conflict = a record whose (employeeId, dateCompleted) already exists on the parent
    // OR on an earlier edition in the same cluster (both re-point to the parent).
    const seen = new Set<string>();
    if (existingParent) {
      for (const r of await prisma.trainingRecords.findMany({
        where: { trainingId: existingParent.id },
        select: { employeeId: true, dateCompleted: true },
      })) {
        seen.add(`${r.employeeId}:${r.dateCompleted.getTime()}`);
      }
    }
    let clusterConflicts = 0;
    for (const e of cluster.editions) {
      if (e.id === existingParent?.id) continue;
      for (const r of await prisma.trainingRecords.findMany({
        where: { trainingId: e.id },
        select: { employeeId: true, dateCompleted: true },
      })) {
        const key = `${r.employeeId}:${r.dateCompleted.getTime()}`;
        if (seen.has(key)) clusterConflicts++;
        else seen.add(key);
      }
    }
    if (clusterConflicts > 0) {
      console.log(`    ⚠  ${clusterConflicts} record conflict(s) would be SKIPPED (duplicate employee+date)`);
      totalConflicts += clusterConflicts;
    }

    console.log(
      `    → Revisions: ${cluster.editions.map((e) => `${e.parsed.revisionLabel} (eff. ${e.parsed.effectiveDate.toISOString().slice(0, 10)})`).join(", ")}`,
    );
    console.log();
  }

  console.log(
    `Summary: ${clusters.length} cluster(s), ${totalRecords} record(s), ${totalReqs} requirement(s) affected, ${totalConflicts} record conflict(s) will be skipped`,
  );
}

async function apply(clusters: Cluster[]) {
  console.log("\nApplying...\n");

  for (const cluster of clusters) {
    await prisma.$transaction(async (tx) => {
      // Find or create the parent training.
      let parent = await tx.training.findFirst({
        where: { title: cluster.parentTitle, category: cluster.category },
      });
      if (!parent) {
        parent = await tx.training.create({
          data: { title: cluster.parentTitle, category: cluster.category, isActive: true },
        });
        console.log(`  Created parent #${parent.id} "${parent.title}" [${cluster.category}]`);
      } else {
        console.log(`  Using existing parent #${parent.id} "${parent.title}"`);
      }
      const parentId = parent.id;

      // (employeeId:dateCompleted) keys already attached to the parent — for dedupe.
      const parentKeys = new Set(
        (
          await tx.trainingRecords.findMany({
            where: { trainingId: parentId },
            select: { employeeId: true, dateCompleted: true },
          })
        ).map((r) => `${r.employeeId}:${r.dateCompleted.getTime()}`),
      );

      for (const edition of cluster.editions) {
        if (edition.id === parentId) continue; // the parent is one of its own editions — skip

        // Find-or-create the revision. Reusing an existing match keeps re-runs idempotent
        // (an already-folded edition is empty, so 0 records move) AND lets two editions that
        // share the same date fold onto one revision instead of being skipped.
        const revision =
          (await tx.trainingRevision.findFirst({
            where: {
              trainingId: parentId,
              revisionLabel: edition.parsed.revisionLabel,
              effectiveDate: edition.parsed.effectiveDate,
            },
          })) ??
          (await tx.trainingRevision.create({
            data: {
              trainingId: parentId,
              revisionLabel: edition.parsed.revisionLabel,
              effectiveDate: edition.parsed.effectiveDate,
            },
          }));

        // Re-point records, stamping the revision; skip (employee, date) conflicts.
        const records = await tx.trainingRecords.findMany({
          where: { trainingId: edition.id },
          select: { id: true, employeeId: true, dateCompleted: true },
        });
        let moved = 0;
        let skipped = 0;
        for (const r of records) {
          const key = `${r.employeeId}:${r.dateCompleted.getTime()}`;
          if (parentKeys.has(key)) {
            skipped++;
            continue;
          }
          await tx.trainingRecords.update({
            where: { id: r.id },
            data: { trainingId: parentId, revisionId: revision.id },
          });
          parentKeys.add(key);
          moved++;
        }

        // Re-point requirements onto the parent; drop ones that collide on the composite PK.
        let reqMoved = 0;
        let reqDropped = 0;
        for (const req of await tx.trainingRequirement.findMany({ where: { trainingId: edition.id } })) {
          const pk = { departmentId: req.departmentId, locationId: req.locationId };
          const exists = await tx.trainingRequirement.findUnique({
            where: { trainingId_departmentId_locationId: { trainingId: parentId, ...pk } },
          });
          if (exists) {
            await tx.trainingRequirement.delete({
              where: { trainingId_departmentId_locationId: { trainingId: edition.id, ...pk } },
            });
            reqDropped++;
          } else {
            await tx.trainingRequirement.update({
              where: { trainingId_departmentId_locationId: { trainingId: edition.id, ...pk } },
              data: { trainingId: parentId },
            });
            reqMoved++;
          }
        }

        // Exemptions have their own id PK — re-pointing never collides.
        const exempt = await tx.trainingTicketExemption.updateMany({
          where: { trainingId: edition.id },
          data: { trainingId: parentId },
        });

        if (edition.isActive) {
          await tx.training.update({ where: { id: edition.id }, data: { isActive: false } });
        }

        console.log(
          `    rev "${revision.revisionLabel}" (eff. ${edition.parsed.effectiveDate.toISOString().slice(0, 10)}) ` +
            `from #${edition.id}: ${moved} record(s) moved${skipped ? `, ${skipped} skipped` : ""}` +
            `${reqMoved ? `, ${reqMoved} req moved` : ""}${reqDropped ? `, ${reqDropped} req dropped` : ""}` +
            `${exempt.count ? `, ${exempt.count} exemption(s) moved` : ""}, edition marked inactive`,
        );
      }
      console.log(`  cluster "${cluster.parentTitle}" done.\n`);
    });
  }

  console.log("Done.");
}

async function main() {
  const clusters = await buildClusters();
  await report(clusters);
  if (!APPLY) {
    console.log("\nDry run — re-run with --apply to write changes.");
    return;
  }
  await apply(clusters);
}

main().finally(() => prisma.$disconnect());
