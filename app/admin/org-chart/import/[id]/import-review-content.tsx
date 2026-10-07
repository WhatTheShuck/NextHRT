"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";
import api from "@/lib/axios";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GenericCombobox, type ComboboxItem } from "@/components/ui/generic-combobox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FIELD_LABELS, FIELD_ORDER, FLAG_FIELDS } from "@/lib/workday/labels";
import type { LineField } from "@/lib/workday/suggestions";
import type { WorkdayRow, TreeProblem } from "@/lib/workday/types";
import type { ApplyRun, ImportLine, PersonSummary } from "@/lib/services/workdayImportService";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  EyeOff,
  Info,
  Link2,
  ListX,
  Loader2,
  Lock,
  RefreshCw,
  Search,
  Unlink,
  UserX,
  X,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ImportView {
  id: number;
  fileName: string;
  uploadedAt: string;
  uploadedBy: string | null;
  rowCount: number;
  status: "Open" | "Superseded" | "Discarded";
  problems: TreeProblem[];
  runs: (ApplyRun & { userName: string | null })[];
  rows: WorkdayRow[];
  lines: ImportLine[];
  ignoredCount: number;
  people: Record<number, PersonSummary>;
  linkedKeys: string[];
}

type Decision = "tick" | "cross";

interface Group {
  key: string;
  row: WorkdayRow | null;
  managerName: string | null;
  employeeId: number | null;
  lines: ImportLine[];
}

interface EmployeeOption {
  id: number;
  legalFirstName: string;
  legalLastName: string;
  preferredFirstName: string | null;
  preferredLastName: string | null;
  isActive: boolean;
  title: string;
}

function errorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { error?: string } } })?.response?.data;
  return data?.error ?? fallback;
}

const isFlag = (field: LineField) => FLAG_FIELDS.includes(field);
const canTick = (line: ImportLine) => !isFlag(line.field) && !line.blocked && !!line.change;

/** Workday rows in tree order (depth first from the root), so cards read like the org chart. */
function treeOrder(rows: WorkdayRow[]): WorkdayRow[] {
  const children = new Map<string | null, WorkdayRow[]>();
  for (const r of rows) children.set(r.managerUid, [...(children.get(r.managerUid) ?? []), r]);
  const known = new Set(rows.map((r) => r.uid));
  const out: WorkdayRow[] = [];
  const seen = new Set<string>();
  const visit = (r: WorkdayRow) => {
    if (seen.has(r.uid)) return;
    seen.add(r.uid);
    out.push(r);
    (children.get(r.uid) ?? []).forEach(visit);
  };
  rows.filter((r) => r.managerUid === null || !known.has(r.managerUid)).forEach(visit);
  rows.forEach(visit); // anything left (loops) at the end
  return out;
}

function readSaved(key: string): { decisions: Record<string, Decision>; choices: Record<string, number> } {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(key) ?? "{}");
    return { decisions: parsed.decisions ?? {}, choices: parsed.choices ?? {} };
  } catch {
    return { decisions: {}, choices: {} };
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

export function ImportReviewContent({ importId }: { importId: number }) {
  const [view, setView] = useState<ImportView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [choices, setChoices] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<LineField | "all">("all");
  const [search, setSearch] = useState("");
  const [ignoreTarget, setIgnoreTarget] = useState<ImportLine | null>(null);
  const [linkTarget, setLinkTarget] = useState<{ nameKey: string; name: string } | null>(null);
  const [confirmApply, setConfirmApply] = useState(false);
  const [applying, setApplying] = useState(false);
  const [lastRun, setLastRun] = useState<ApplyRun | null>(null);
  const [employees, setEmployees] = useState<EmployeeOption[] | null>(null);
  const loadEmployees = useCallback(() => {
    api
      .get<EmployeeOption[]>("/api/employees", { timeout: 30000 })
      .then((res) => setEmployees(res.data))
      .catch(() => setEmployees([]));
  }, []);

  // Ticks and manager choices survive a refresh or code reload: kept per import in this tab's
  // session storage and restored once the lines are known.
  const storageKey = `workday-import-${importId}`;
  const restored = useRef(false);

  // State is only set once the request settles, so this is safe to call from an effect.
  const fetchView = useCallback(
    () =>
      api
        .get<ImportView>(`/api/workday-import/${importId}`, { timeout: 60000 })
        .then((res) => {
          setError(null);
          setView(res.data);
          // Keep ticks for lines that still exist (ids are stable across recalculations).
          const ids = new Set(res.data.lines.map((l) => l.id));
          const keep = <T,>(entries: Record<string, T>) => Object.fromEntries(Object.entries(entries).filter(([id]) => ids.has(id)));
          if (!restored.current) {
            restored.current = true;
            const saved = readSaved(storageKey);
            setDecisions(keep(saved.decisions));
            setChoices(keep(saved.choices));
          } else {
            setDecisions((prev) => keep(prev));
          }
        })
        .catch((err) => setError(errorMessage(err, "Failed to load the import.")))
        .finally(() => setLoading(false)),
    [importId, storageKey],
  );
  const load = useCallback(() => {
    setLoading(true);
    return fetchView();
  }, [fetchView]);

  useEffect(() => {
    fetchView();
  }, [fetchView]);

  useEffect(() => {
    if (!restored.current) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ decisions, choices }));
    } catch {
      // Storage unavailable (private mode, quota): ticks just won't survive a refresh.
    }
  }, [storageKey, decisions, choices]);

  const rowsByUid = useMemo(() => new Map((view?.rows ?? []).map((r) => [r.uid, r])), [view]);

  const groups = useMemo<Group[]>(() => {
    if (!view) return [];
    const byKey = new Map<string, ImportLine[]>();
    for (const l of view.lines) {
      const key = l.workdayUid ? `wd:${l.workdayUid}` : `emp:${l.employeeId}`;
      byKey.set(key, [...(byKey.get(key) ?? []), l]);
    }
    const sortLines = (lines: ImportLine[]) =>
      [...lines].sort((a, b) => FIELD_ORDER.indexOf(a.field) - FIELD_ORDER.indexOf(b.field));
    const out: Group[] = [];
    for (const row of treeOrder(view.rows)) {
      const lines = byKey.get(`wd:${row.uid}`);
      if (!lines) continue;
      byKey.delete(`wd:${row.uid}`);
      const manager = row.managerUid ? rowsByUid.get(row.managerUid) : undefined;
      out.push({
        key: `wd:${row.uid}`,
        row,
        managerName: manager?.name ?? null,
        employeeId: lines.find((l) => l.employeeId !== null && l.field !== "inactiveMatch")?.employeeId ?? null,
        lines: sortLines(lines),
      });
    }
    const hrtOnly = [...byKey.entries()]
      .map(([key, lines]) => ({ key, row: null, managerName: null, employeeId: lines[0].employeeId, lines: sortLines(lines) }))
      .sort((a, b) => (a.lines[0].employeeName ?? "").localeCompare(b.lines[0].employeeName ?? ""));
    return [...out, ...hrtOnly];
  }, [view, rowsByUid]);

  const visibleGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groups
      .map((g) => ({ ...g, lines: g.lines.filter((l) => filter === "all" || l.field === filter) }))
      .filter((g) => g.lines.length > 0)
      .filter((g) => {
        if (!q) return true;
        const person = g.employeeId !== null ? view?.people[g.employeeId] : undefined;
        return [g.row?.name, g.row?.title, person?.name, person?.department, ...g.lines.map((l) => l.employeeName)]
          .some((s) => s?.toLowerCase().includes(q));
      });
  }, [groups, filter, search, view]);

  const counts = useMemo(() => {
    const c: Partial<Record<LineField, number>> = {};
    for (const l of view?.lines ?? []) c[l.field] = (c[l.field] ?? 0) + 1;
    return c;
  }, [view]);

  const ticked = Object.entries(decisions).filter(([, d]) => d === "tick").map(([id]) => id);
  const crossed = Object.entries(decisions).filter(([, d]) => d === "cross").map(([id]) => id);
  const linesById = useMemo(() => new Map((view?.lines ?? []).map((l) => [l.id, l])), [view]);
  const needsChoice = ticked.filter((id) => linesById.get(id)?.options && choices[id] === undefined);

  // Take the reviewer straight to a line that's holding up Apply, even if a filter or search
  // is hiding it. Repeated clicks step through them.
  const [jumpIndex, setJumpIndex] = useState(0);
  const showNextNeedingChoice = () => {
    if (needsChoice.length === 0) return;
    const id = needsChoice[jumpIndex % needsChoice.length];
    setJumpIndex((i) => i + 1);
    const hidden = !visibleGroups.some((g) => g.lines.some((l) => l.id === id));
    if (hidden) {
      setFilter("all");
      setSearch("");
    }
    // Wait for the (possibly re-filtered) list to render before scrolling.
    setTimeout(() => {
      const row = document.querySelector<HTMLElement>(`[data-line-id="${CSS.escape(id)}"]`);
      if (!row) return;
      row.scrollIntoView({ behavior: "smooth", block: "center" });
      row.querySelector<HTMLElement>('[role="combobox"]')?.focus({ preventScroll: true });
    }, hidden ? 100 : 0);
  };

  const decide = (ids: string[], decision: Decision | null) =>
    setDecisions((prev) => {
      const next = { ...prev };
      for (const id of ids) {
        if (decision === null) delete next[id];
        else next[id] = decision;
      }
      return next;
    });
  const toggle = (id: string, decision: Decision) => decide([id], decisions[id] === decision ? null : decision);
  const actionable = (lines: ImportLine[]) => lines.filter(canTick).map((l) => l.id);
  const decidable = (lines: ImportLine[]) => lines.filter((l) => !isFlag(l.field)).map((l) => l.id);

  const setLink = async (nameKey: string, name: string, employeeId: number | null) => {
    try {
      await api.put("/api/workday-import/links", { workdayNameKey: nameKey, workdayName: name, employeeId });
      toast.success(employeeId === null ? `${name} marked as not in HRT` : `${name} linked`);
      setLinkTarget(null);
      await load();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to save the link."));
    }
  };

  const removeLink = async (nameKey: string, name: string) => {
    try {
      await api.delete(`/api/workday-import/links?workdayNameKey=${nameKey}`);
      toast.success(`${name} will be matched afresh`);
      await load();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to remove the link."));
    }
  };

  const ignore = async (line: ImportLine, note: string) => {
    try {
      await api.post("/api/workday-import/rules", {
        subjectKey: line.subjectKey,
        field: line.field,
        value: line.value,
        note: note || null,
        workdayName: line.workdayName ?? line.employeeName,
      });
      toast.success("Ignored. You can undo this from Ignore rules.");
      setIgnoreTarget(null);
      decide([line.id], null);
      await load();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to save the rule."));
    }
  };

  const apply = async () => {
    setApplying(true);
    try {
      const chosen = Object.fromEntries(ticked.filter((id) => choices[id] !== undefined).map((id) => [id, choices[id]]));
      const res = await api.post<ApplyRun>(
        `/api/workday-import/${importId}/apply`,
        { ticked, crossed, choices: chosen },
        { timeout: 60000 },
      );
      setLastRun(res.data);
      setConfirmApply(false);
      decide([...ticked, ...crossed], null);
      toast.success(`Applied ${res.data.applied.length} change${res.data.applied.length === 1 ? "" : "s"}`);
      await load();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to apply."));
    } finally {
      setApplying(false);
    }
  };

  if (!view) {
    return (
      <div className="container mx-auto py-6 px-4">
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Comparing the export with HRT…
          </div>
        )}
      </div>
    );
  }

  const isOpen = view.status === "Open";
  const shownIds = visibleGroups.flatMap((g) => g.lines);

  return (
    <div className="container mx-auto py-6 px-4 space-y-5 pb-28">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold truncate">{view.fileName}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Uploaded {format(new Date(view.uploadedAt), "d MMM yyyy, h:mm a")} by {view.uploadedBy ?? "unknown"} ·{" "}
            {view.rowCount} people in Workday
            {view.ignoredCount > 0 && ` · ${view.ignoredCount} suggestion${view.ignoredCount === 1 ? "" : "s"} hidden by ignore rules`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isOpen && <Badge>Open</Badge>}
          {!isOpen && <Badge variant="outline">{view.status}</Badge>}
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/org-chart/import/rules">
              <ListX className="h-4 w-4 mr-2" />
              Ignore rules
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {!isOpen && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>This import is {view.status.toLowerCase()}</AlertTitle>
          <AlertDescription>
            It&apos;s kept as a record of what was applied. Upload a fresh export from the{" "}
            <Link href="/admin/org-chart/import" className="underline">
              Workday Import
            </Link>{" "}
            page to review current suggestions.
          </AlertDescription>
        </Alert>
      )}

      {view.problems.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Problems with the file&apos;s tree</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4 space-y-0.5">
              {view.problems.map((p, i) => (
                <li key={i}>{p.message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {lastRun && <RunSummary run={lastRun} onDismiss={() => setLastRun(null)} />}

      {isOpen && (
        <>
          {/* Summary + filters */}
          <div className="flex flex-wrap gap-1.5">
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="All" count={view.lines.length} />
            {FIELD_ORDER.filter((f) => counts[f]).map((f) => (
              <FilterChip
                key={f}
                active={filter === f}
                onClick={() => setFilter(f)}
                label={FIELD_LABELS[f]}
                count={counts[f]!}
                flag={isFlag(f)}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search people, titles, departments…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => decide(actionable(shownIds), "tick")}>
              <Check className="h-4 w-4 mr-1.5" />
              Tick all shown
            </Button>
            <Button variant="outline" size="sm" onClick={() => decide(decidable(shownIds), "cross")}>
              <X className="h-4 w-4 mr-1.5" />
              Cross all shown
            </Button>
            <Button variant="ghost" size="sm" onClick={() => decide(shownIds.map((l) => l.id), null)}>
              Clear shown
            </Button>
          </div>

          {/* Person cards */}
          <div className="space-y-3">
            {visibleGroups.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-10">
                {view.lines.length === 0 ? "HRT already matches this export. Nothing to review." : "No suggestions match the current filters."}
              </p>
            )}
            {visibleGroups.map((g) => (
              <PersonCard
                key={g.key}
                group={g}
                person={g.employeeId !== null ? view.people[g.employeeId] : undefined}
                people={view.people}
                linked={!!g.row && view.linkedKeys.includes(g.row.nameKey)}
                decisions={decisions}
                choices={choices}
                onToggle={toggle}
                onDecideAll={(d) => decide(d === "tick" ? actionable(g.lines) : decidable(g.lines), d)}
                onChoose={(id, employeeId) => setChoices((prev) => ({ ...prev, [id]: employeeId }))}
                onIgnore={setIgnoreTarget}
                onLink={setLink}
                onChooseOther={(nameKey, name) => setLinkTarget({ nameKey, name })}
                onUnlink={removeLink}
              />
            ))}
          </div>
        </>
      )}

      {view.runs.length > 0 && <RunHistory runs={view.runs} />}

      {/* Sticky apply bar */}
      {isOpen && (ticked.length > 0 || crossed.length > 0) && (
        <div className="fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur">
          <div className="container mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              <span className="font-semibold">{ticked.length}</span> ticked to apply ·{" "}
              <span className="font-semibold">{crossed.length}</span> crossed for this import
              {needsChoice.length > 0 && (
                <button
                  type="button"
                  onClick={showNextNeedingChoice}
                  className="ml-2 inline-flex items-center gap-1 text-amber-600 underline underline-offset-2 hover:text-amber-700"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {needsChoice.length} still {needsChoice.length === 1 ? "needs" : "need"} a manager chosen: show me
                  {needsChoice.length > 1 ? " (next)" : ""}
                </button>
              )}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setDecisions({})}>
                Clear all
              </Button>
              <Button onClick={() => setConfirmApply(true)} disabled={ticked.length === 0 || needsChoice.length > 0}>
                Apply {ticked.length} change{ticked.length === 1 ? "" : "s"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ApplyDialog
        open={confirmApply}
        onOpenChange={setConfirmApply}
        lines={ticked.map((id) => linesById.get(id)).filter((l): l is ImportLine => !!l)}
        applying={applying}
        onConfirm={apply}
      />
      {ignoreTarget && (
        <IgnoreDialog key={ignoreTarget.id} line={ignoreTarget} onClose={() => setIgnoreTarget(null)} onConfirm={ignore} />
      )}
      {linkTarget && (
        <ChooseEmployeeDialog
          key={linkTarget.nameKey}
          target={linkTarget}
          employees={employees}
          onNeedEmployees={loadEmployees}
          onClose={() => setLinkTarget(null)}
          onPick={(employeeId) => setLink(linkTarget.nameKey, linkTarget.name, employeeId)}
        />
      )}
    </div>
  );
}

// ─── Pieces ─────────────────────────────────────────────────────────────────

function FilterChip({ active, onClick, label, count, flag }: { active: boolean; onClick: () => void; label: string; count: number; flag?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
        active ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
      }`}
    >
      {flag && <AlertTriangle className="h-3 w-3" />}
      {label}
      <span className={`font-semibold ${active ? "" : "text-muted-foreground"}`}>{count}</span>
    </button>
  );
}

function PersonCard({
  group,
  person,
  people,
  linked,
  decisions,
  choices,
  onToggle,
  onDecideAll,
  onChoose,
  onIgnore,
  onLink,
  onChooseOther,
  onUnlink,
}: {
  group: Group;
  person: PersonSummary | undefined;
  people: Record<number, PersonSummary>;
  linked: boolean;
  decisions: Record<string, Decision>;
  choices: Record<string, number>;
  onToggle: (id: string, d: Decision) => void;
  onDecideAll: (d: Decision) => void;
  onChoose: (id: string, employeeId: number) => void;
  onIgnore: (line: ImportLine) => void;
  onLink: (nameKey: string, name: string, employeeId: number | null) => void;
  onChooseOther: (nameKey: string, name: string) => void;
  onUnlink: (nameKey: string, name: string) => void;
}) {
  const name = group.row?.name ?? group.lines[0].employeeName ?? "Unknown";
  const hasDecidable = group.lines.some((l) => !isFlag(l.field));

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold">{name}</p>
            <div className="text-xs text-muted-foreground space-y-0.5 mt-0.5">
              {group.row && (
                <p>
                  Workday: {group.row.title || "no title"}
                  {group.managerName && <> · reports to {group.managerName}</>}
                </p>
              )}
              {person && (
                <p>
                  HRT:{" "}
                  <Link href={`/employees/${person.id}`} className="underline-offset-2 hover:underline">
                    {person.name}
                  </Link>{" "}
                  · {person.title || "no title"} · {person.department} · {person.location}
                  {person.reportsTo && <> · reports to {person.reportsTo}</>}
                  {!person.isActive && <Badge variant="destructive" className="ml-1.5 text-[10px] py-0">Inactive</Badge>}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {linked && group.row && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onUnlink(group.row!.nameKey, group.row!.name)}>
                <Unlink className="h-3.5 w-3.5 mr-1" />
                Undo link
              </Button>
            )}
            {hasDecidable && (
              <>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onDecideAll("tick")}>
                  <Check className="h-3.5 w-3.5 mr-1" />
                  Tick all
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onDecideAll("cross")}>
                  <X className="h-3.5 w-3.5 mr-1" />
                  Cross all
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="divide-y rounded-md border">
          {group.lines.map((line) => (
            <LineRow
              key={line.id}
              line={line}
              people={people}
              decision={decisions[line.id]}
              choice={choices[line.id]}
              onToggle={(d) => onToggle(line.id, d)}
              onChoose={(employeeId) => onChoose(line.id, employeeId)}
              onIgnore={() => onIgnore(line)}
              onLink={(employeeId) => onLink(line.subjectKey.slice(3), line.workdayName ?? name, employeeId)}
              onChooseOther={() => onChooseOther(line.subjectKey.slice(3), line.workdayName ?? name)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function LineRow({
  line,
  people,
  decision,
  choice,
  onToggle,
  onChoose,
  onIgnore,
  onLink,
  onChooseOther,
}: {
  line: ImportLine;
  people: Record<number, PersonSummary>;
  decision: Decision | undefined;
  choice: number | undefined;
  onToggle: (d: Decision) => void;
  onChoose: (employeeId: number) => void;
  onIgnore: () => void;
  onLink: (employeeId: number | null) => void;
  onChooseOther: () => void;
}) {
  const flag = isFlag(line.field);
  const needsManager = decision === "tick" && !!line.options && choice === undefined;
  const tone = needsManager
    ? "bg-amber-50 dark:bg-amber-950/30 ring-2 ring-inset ring-amber-400"
    : decision === "tick"
      ? "bg-green-50 dark:bg-green-950/30"
      : decision === "cross"
        ? "bg-muted/40 opacity-70"
        : "";

  return (
    <div data-line-id={line.id} className={`flex flex-col gap-2 p-3 sm:flex-row sm:items-start scroll-mt-24 ${tone}`}>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={flag ? "outline" : "secondary"} className="text-xs">
            {flag && <AlertTriangle className="h-3 w-3 mr-1 text-amber-500" />}
            {FIELD_LABELS[line.field]}
          </Badge>
          {line.blocked && (
            <span className="inline-flex items-center gap-1 text-xs text-amber-600">
              <Lock className="h-3 w-3" />
              {line.blocked}
            </span>
          )}
        </div>

        {(line.current !== null || line.proposed !== null) && !line.options && (
          <p className="text-sm flex flex-wrap items-center gap-1.5">
            {line.current !== null && <span className="text-muted-foreground line-through decoration-muted-foreground/50">{line.current}</span>}
            {line.current !== null && line.proposed !== null && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />}
            {line.proposed !== null && <span className="font-medium">{line.proposed}</span>}
          </p>
        )}

        {line.options && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">{line.current}</span>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={choice !== undefined ? String(choice) : undefined} onValueChange={(v) => onChoose(Number(v))}>
              <SelectTrigger className={`h-8 w-[240px] ${needsManager ? "border-amber-500" : ""}`}>
                <SelectValue placeholder="Choose a manager" />
              </SelectTrigger>
              <SelectContent>
                {line.options.map((o) => (
                  <SelectItem key={o.employeeId} value={String(o.employeeId)}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {needsManager && <span className="text-xs text-amber-600">Ticked: choose a manager so it can be applied.</span>}
          </div>
        )}

        {line.reason && <p className="text-xs text-muted-foreground">{line.reason}</p>}
        {line.notes.map((n, i) => (
          <p key={i} className={`text-xs flex items-start gap-1 ${n.level === "warning" ? "text-amber-600" : "text-muted-foreground"}`}>
            {n.level === "warning" ? <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" /> : <Info className="h-3 w-3 mt-0.5 shrink-0" />}
            {n.text}
          </p>
        ))}
        {line.impact && <ImpactPanel impact={line.impact} />}

        {/* Identity actions */}
        {(line.field === "notInHrt" || line.field === "inactiveMatch") && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {line.candidates?.slice(0, 4).map((c) => {
              const p = people[c.employeeId];
              return (
                <Button key={c.employeeId} variant="outline" size="sm" className="h-7 text-xs" onClick={() => onLink(c.employeeId)}>
                  <Link2 className="h-3.5 w-3.5 mr-1" />
                  Link to {c.name}
                  {p && <span className="text-muted-foreground ml-1">({p.title || p.department}{p.isActive ? "" : ", inactive"})</span>}
                </Button>
              );
            })}
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onChooseOther}>
              Choose other…
            </Button>
            {line.field === "notInHrt" && !line.confirmedNotInHrt && (
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onLink(null)}>
                <UserX className="h-3.5 w-3.5 mr-1" />
                Not in HRT
              </Button>
            )}
            {line.field === "notInHrt" && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                <Link href="/forms/new-employee">Onboarding form</Link>
              </Button>
            )}
            {line.field === "inactiveMatch" && line.employeeId !== null && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                <Link href={`/employees/${line.employeeId}`}>Open to rehire</Link>
              </Button>
            )}
          </div>
        )}
        {(line.field === "missingFromWorkday" || line.field === "externalManagerLeft" || (line.blocked && line.field === "externalReportsTo")) &&
          line.employeeId !== null && (
            <Button variant="ghost" size="sm" className="h-7 text-xs -ml-2" asChild>
              <Link href={`/employees/${line.employeeId}`}>Open employee</Link>
            </Button>
          )}
      </div>

      {/* Decision controls */}
      <div className="flex items-center gap-1 shrink-0">
        {!flag && (
          <>
            <DecisionButton
              active={decision === "tick"}
              disabled={!canTick(line)}
              label={line.blocked ? line.blocked : "Apply this change"}
              onClick={() => onToggle("tick")}
              className="data-[active=true]:bg-green-600 data-[active=true]:text-white data-[active=true]:border-green-600"
            >
              <Check className="h-4 w-4" />
            </DecisionButton>
            <DecisionButton
              active={decision === "cross"}
              label="Not this time (comes back next import)"
              onClick={() => onToggle("cross")}
              className="data-[active=true]:bg-muted-foreground data-[active=true]:text-background"
            >
              <X className="h-4 w-4" />
            </DecisionButton>
          </>
        )}
        <DecisionButton label="Ignore forever" onClick={onIgnore}>
          <EyeOff className="h-4 w-4" />
        </DecisionButton>
      </div>
    </div>
  );
}

function DecisionButton({
  active,
  disabled,
  label,
  onClick,
  className = "",
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Button
              variant="outline"
              size="icon"
              className={`h-8 w-8 ${className}`}
              data-active={active ? "true" : "false"}
              aria-pressed={active}
              aria-label={label}
              disabled={disabled}
              onClick={onClick}
            >
              {children}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ImpactPanel({ impact }: { impact: NonNullable<ImportLine["impact"]> }) {
  const [open, setOpen] = useState(false);
  const changes =
    impact.trainingsAdded.length + impact.trainingsRemoved.length + impact.ticketsAdded.length + impact.ticketsRemoved.length;
  const managerChanges = impact.managersGained.length + impact.managersLost.length;
  const list = (label: string, items: string[], tone = "") =>
    items.length > 0 && (
      <p className={tone}>
        <span className="font-medium">{label}:</span> {items.join(", ")}
      </p>
    );

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        Impact: {changes === 0 ? "no training changes" : `${changes} training/ticket change${changes === 1 ? "" : "s"}`}
        {impact.notCompleted.length > 0 && <span className="text-amber-600">, {impact.notCompleted.length} not yet completed</span>}
        {managerChanges > 0 && `, ${managerChanges} manager change${managerChanges === 1 ? "" : "s"}`}
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1.5 space-y-0.5 rounded-md bg-muted/40 p-2 text-xs">
        {list("Training added", impact.trainingsAdded)}
        {list("Training removed", impact.trainingsRemoved)}
        {list("Tickets added", impact.ticketsAdded)}
        {list("Tickets removed", impact.ticketsRemoved)}
        {list("Newly required and not completed", impact.notCompleted, "text-amber-600")}
        {list("Managers who would start seeing and approving for them", impact.managersGained)}
        {list("Managers who would stop", impact.managersLost)}
        {changes === 0 && managerChanges === 0 && <p>Nothing changes for training or managers.</p>}
      </CollapsibleContent>
    </Collapsible>
  );
}

function ApplyDialog({
  open,
  onOpenChange,
  lines,
  applying,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lines: ImportLine[];
  applying: boolean;
  onConfirm: () => void;
}) {
  const byField = new Map<LineField, number>();
  for (const l of lines) byField.set(l.field, (byField.get(l.field) ?? 0) + 1);
  const departmentMoves = byField.get("department") ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply {lines.length} change{lines.length === 1 ? "" : "s"}?</DialogTitle>
          <DialogDescription>
            Each line is checked again against current HRT data first. Anything that has changed since you ticked it is skipped
            and reported.
          </DialogDescription>
        </DialogHeader>
        <ul className="text-sm space-y-1">
          {FIELD_ORDER.filter((f) => byField.has(f)).map((f) => (
            <li key={f} className="flex justify-between">
              <span>{FIELD_LABELS[f]}</span>
              <span className="font-medium">{byField.get(f)}</span>
            </li>
          ))}
        </ul>
        {departmentMoves > 0 && (
          <p className="text-xs text-amber-600">
            {departmentMoves} department change{departmentMoves === 1 ? "" : "s"} will change required training, and who can see and
            approve for {departmentMoves === 1 ? "that person" : "those people"}.
          </p>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={applying}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={applying}>
            {applying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IgnoreDialog({
  line,
  onClose,
  onConfirm,
}: {
  line: ImportLine;
  onClose: () => void;
  onConfirm: (line: ImportLine, note: string) => void;
}) {
  const [note, setNote] = useState("");
  const who = line.workdayName ?? line.employeeName ?? "this person";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ignore forever?</DialogTitle>
          <DialogDescription>
            {FIELD_LABELS[line.field]} for {who}
            {line.proposed ? <> → &ldquo;{line.proposed}&rdquo;</> : null}. This exact suggestion won&apos;t be shown again. If
            Workday later says something different, you&apos;ll be asked again. You can remove the rule from Ignore rules.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          placeholder="Why? (optional, e.g. 'Workday typo' or 'deliberately different in HRT')"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(line, note.trim())}>
            <EyeOff className="h-4 w-4 mr-2" />
            Ignore forever
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChooseEmployeeDialog({
  target,
  employees,
  onNeedEmployees,
  onClose,
  onPick,
}: {
  target: { nameKey: string; name: string };
  employees: EmployeeOption[] | null;
  onNeedEmployees: () => void;
  onClose: () => void;
  onPick: (employeeId: number) => void;
}) {
  const [selected, setSelected] = useState<ComboboxItem | null>(null);

  useEffect(() => {
    if (!employees) onNeedEmployees();
  }, [employees, onNeedEmployees]);

  const items = useMemo<ComboboxItem[]>(
    () =>
      (employees ?? [])
        .map((e) => {
          const label = `${e.preferredFirstName || e.legalFirstName} ${e.preferredLastName || e.legalLastName}`;
          const legal = `${e.legalFirstName} ${e.legalLastName}`;
          return {
            id: e.id,
            label,
            value: `${label} ${legal} ${e.id}`,
            subtitle: [legal !== label ? `legal: ${legal}` : null, e.title, e.isActive ? null : "inactive"].filter(Boolean).join(" · "),
          };
        })
        .sort((a, b) => a.label.localeCompare(b.label)),
    [employees],
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link {target.name}</DialogTitle>
          <DialogDescription>
            Pick the HRT employee this Workday person is. The link is saved now and remembered for future imports.
          </DialogDescription>
        </DialogHeader>
        {employees === null ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading employees…
          </p>
        ) : (
          <GenericCombobox
            items={items}
            selectedItem={selected}
            onSelect={setSelected}
            placeholder="Search employees…"
            searchPlaceholder="Name, legal name or title"
            showSubtitle
            width="w-full"
            popoverWidth="w-[--radix-popover-trigger-width]"
          />
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!selected} onClick={() => selected && onPick(Number(selected.id))}>
            Link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RunSummary({ run, onDismiss }: { run: ApplyRun; onDismiss: () => void }) {
  return (
    <Alert>
      <Check className="h-4 w-4" />
      <AlertTitle className="flex items-center justify-between">
        Applied {run.applied.length} change{run.applied.length === 1 ? "" : "s"}
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onDismiss}>
          Dismiss
        </Button>
      </AlertTitle>
      <AlertDescription>
        {run.stale.length > 0 && (
          <p className="text-amber-600">
            {run.stale.length} line{run.stale.length === 1 ? " was" : "s were"} skipped because HRT changed since you ticked
            {run.stale.length === 1 ? " it" : " them"}. Review what&apos;s left below.
          </p>
        )}
        <AppliedList applied={run.applied} />
      </AlertDescription>
    </Alert>
  );
}

function AppliedList({ applied }: { applied: ApplyRun["applied"] }) {
  if (applied.length === 0) return null;
  return (
    <ul className="mt-1 space-y-0.5 text-xs">
      {applied.map((a) => (
        <li key={a.lineId}>
          <span className="font-medium">{a.employeeName}</span> ·{" "}
          {FIELD_LABELS[a.field]}: {a.from ?? "(none)"} → {a.to ?? "(none)"}
        </li>
      ))}
    </ul>
  );
}

function RunHistory({ runs }: { runs: (ApplyRun & { userName: string | null })[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <CardContent className="p-4">
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm font-semibold">
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Apply history ({runs.length})
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-3">
            {[...runs].reverse().map((run, i) => (
              <div key={i} className="text-sm">
                <p className="text-muted-foreground text-xs">
                  {format(new Date(run.at), "d MMM yyyy, h:mm a")} · {run.userName ?? "unknown"} · {run.applied.length} applied ·{" "}
                  {run.crossed.length} crossed · {run.stale.length} skipped
                </p>
                <AppliedList applied={run.applied} />
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
