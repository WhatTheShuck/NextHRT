"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import api from "@/lib/axios";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, ChevronDown, ChevronRight, Loader2, Share2 } from "lucide-react";

interface LineEmployee {
  id: number;
  name: string;
  title: string;
  department: string;
  reportsToId: number | null;
  external: boolean;
  hasLogin: boolean;
}

interface Grant {
  id: number;
  granteeEmployeeId: number;
  scopeManagerEmployeeId: number;
  department: string | null;
  jobFamily: string | null;
  level: "Act" | "View";
  source: string;
}

interface ReportingModel {
  byId: Map<number, LineEmployee>;
  children: Map<number, LineEmployee[]>;
  actsFor: Map<number, Grant[]>;
}

interface ReportingLinesData {
  employees: LineEmployee[];
  grants: Grant[];
}

/**
 * The person-to-person reporting tree (Employee.reportsToId), with delegated-access grants
 * shown in a different colour. Phase 1: display only; it doesn't drive permissions yet.
 */
export function ReportingLinesView({ search }: { search: string }) {
  const [data, setData] = useState<ReportingLinesData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<ReportingLinesData>("/api/org-chart/reporting-lines")
      .then((res) => setData(res.data))
      .catch(() => setError("Failed to load reporting lines."));
  }, []);

  const model = useMemo(() => {
    if (!data) return null;
    const byId = new Map(data.employees.map((e) => [e.id, e]));
    const children = new Map<number, LineEmployee[]>();
    for (const e of data.employees) {
      if (e.reportsToId !== null && byId.has(e.reportsToId)) {
        children.set(e.reportsToId, [...(children.get(e.reportsToId) ?? []), e]);
      }
    }
    for (const list of children.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    const actsFor = new Map<number, Grant[]>();
    for (const g of data.grants) actsFor.set(g.granteeEmployeeId, [...(actsFor.get(g.granteeEmployeeId) ?? []), g]);

    // Roots: no manager (or a manager who is inactive) but with reports.
    const unplaced = data.employees.filter((e) => (e.reportsToId === null || !byId.has(e.reportsToId)));
    const roots = unplaced.filter((e) => children.has(e.id)).sort((a, b) => a.name.localeCompare(b.name));
    const loose = unplaced.filter((e) => !children.has(e.id)).sort((a, b) => a.name.localeCompare(b.name));
    return { byId, children, actsFor, roots, loose };
  }, [data]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!model) {
    return (
      <p className="text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading reporting lines…
      </p>
    );
  }

  const q = search.trim().toLowerCase();
  const matches = (e: LineEmployee) =>
    !q || [e.name, e.title, e.department].some((s) => s.toLowerCase().includes(q));
  const subtreeMatches = (e: LineEmployee, seen = new Set<number>()): boolean => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return matches(e) || (model.children.get(e.id) ?? []).some((c) => subtreeMatches(c, seen));
  };

  if (model.roots.length === 0) {
    return (
      <Card data-tour="org-lines-empty">
        <CardContent className="p-6 text-sm text-muted-foreground space-y-2">
          <p>No reporting lines yet.</p>
          <p>
            Upload a Workday export on the{" "}
            <Link href="/admin/org-chart/import" className="underline">
              Workday Import
            </Link>{" "}
            page and apply the &ldquo;Reports to&rdquo; suggestions, or set &ldquo;Reports To&rdquo; on an employee.
          </p>
        </CardContent>
      </Card>
    );
  }

  const looseShown = model.loose.filter(matches);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground" data-tour="org-lines-legend">
        <span className="flex items-center gap-1.5">
          <Share2 className="h-3.5 w-3.5 text-violet-500" /> Delegated access (acts at another manager&apos;s level; no effect
          until line-manager authority is switched on)
        </span>
        <span className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[10px] py-0">External</Badge> Not in Workday; manager set in HRT
        </span>
      </div>

      <Card data-tour="org-lines-tree">
        <CardContent className="p-4">
          {model.roots.filter((r) => subtreeMatches(r)).map((root) => (
            <TreeNode key={root.id} employee={root} model={model} depth={0} subtreeMatches={subtreeMatches} forceOpen={!!q} path={new Set()} />
          ))}
        </CardContent>
      </Card>

      {looseShown.length > 0 && (
        <Card className="border-amber-300 dark:border-amber-700" data-tour="org-lines-unplaced">
          <CardContent className="p-4">
            <p className="font-semibold flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Not in a reporting line yet ({looseShown.length})
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              Active employees with no manager and no reports. Everyone needs a line before line-manager authority is switched on.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
              {looseShown.map((e) => (
                <Link key={e.id} href={`/employees/${e.id}`} className="text-sm rounded px-2 py-1 hover:bg-muted/50">
                  <span className="font-medium">{e.name}</span>
                  <span className="text-xs text-muted-foreground ml-1.5">{e.title}</span>
                  {e.external && <Badge variant="outline" className="ml-1.5 text-[10px] py-0">External</Badge>}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TreeNode({
  employee,
  model,
  depth,
  subtreeMatches,
  forceOpen,
  path,
}: {
  employee: LineEmployee;
  model: ReportingModel;
  depth: number;
  subtreeMatches: (e: LineEmployee) => boolean;
  forceOpen: boolean;
  path: Set<number>;
}) {
  const [open, setOpen] = useState(depth < 2);
  if (path.has(employee.id)) return null; // a loop slipped past the write checks
  const kids = (model.children.get(employee.id) ?? []).filter((c) => subtreeMatches(c));
  const grants = model.actsFor.get(employee.id) ?? [];
  const expanded = open || forceOpen;
  const nextPath = new Set(path).add(employee.id);

  return (
    <div className={depth > 0 ? "border-l-2 border-muted pl-3 ml-2" : ""}>
      <div className="flex items-center gap-1.5 py-1">
        {kids.length > 0 ? (
          <button type="button" onClick={() => setOpen(!open)} className="text-muted-foreground hover:text-foreground" aria-label={expanded ? "Collapse" : "Expand"}>
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <Link href={`/employees/${employee.id}`} className="text-sm font-medium hover:underline">
          {employee.name}
        </Link>
        <span className="text-xs text-muted-foreground truncate">
          {employee.title} · {employee.department}
        </span>
        {employee.external && <Badge variant="outline" className="text-[10px] py-0">External</Badge>}
        {kids.length > 0 && <Badge variant="secondary" className="text-[10px] py-0">{kids.length}</Badge>}
        {grants.map((g) => (
          <TooltipProvider key={g.id}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1 rounded-full border border-violet-300 bg-violet-50 px-2 py-0 text-[10px] text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300">
                  <Share2 className="h-3 w-3" />
                  {g.level === "View" ? "sees" : "acts for"} {model.byId.get(g.scopeManagerEmployeeId)?.name ?? "a former manager"}
                  {(g.department || g.jobFamily) && ` (${[g.department, g.jobFamily].filter(Boolean).join(" / ")})`}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {g.level === "View" ? "View-only" : "Acting"} delegated access ({g.source === "Manual" ? "set by hand" : "from Workday import"}).
                No effect until line-manager authority is switched on.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>
      {expanded &&
        kids.map((c) => (
          <TreeNode key={c.id} employee={c} model={model} depth={depth + 1} subtreeMatches={subtreeMatches} forceOpen={forceOpen} path={nextPath} />
        ))}
    </div>
  );
}
