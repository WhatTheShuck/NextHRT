"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import api from "@/lib/axios";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import type { GrantMigration, GrantOutcome, SwitchoverReport } from "@/lib/org/switchover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AuthorityMode } from "@/lib/org/authority";
import { AlertTriangle, CheckCircle2, Loader2, Power, RefreshCw } from "lucide-react";

const OUTCOME: Record<GrantOutcome, { label: string; tone: "good" | "warn" | "muted" }> = {
  coveredByLine: { label: "Covered by reporting line", tone: "good" },
  migrated: { label: "Delegated access in place", tone: "good" },
  needsGrant: { label: "Needs delegated access", tone: "warn" },
  blocked: { label: "Blocked: people with no line", tone: "warn" },
  noEmployee: { label: "Ends: user not linked to an employee", tone: "muted" },
  inactive: { label: "Ends: employee is inactive", tone: "muted" },
};

function OutcomeBadge({ outcome }: { outcome: GrantOutcome }) {
  const { label, tone } = OUTCOME[outcome];
  const cls =
    tone === "good"
      ? "border-green-300 text-green-700 dark:border-green-800 dark:text-green-400"
      : tone === "warn"
        ? "border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400"
        : "text-muted-foreground";
  return (
    <Badge variant="outline" className={`text-xs ${cls}`}>
      {label}
    </Badge>
  );
}

export function SwitchoverContent() {
  const [report, setReport] = useState<SwitchoverReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<AuthorityMode | null>(null);
  const [confirmMode, setConfirmMode] = useState<AuthorityMode | null>(null);
  const [switching, setSwitching] = useState(false);

  const fetchReport = useCallback(
    () =>
      Promise.all([
        api.get<SwitchoverReport>("/api/org-chart/switchover", { timeout: 60000 }),
        api.get<{ mode: AuthorityMode }>("/api/org-chart/switchover/mode"),
      ])
        .then(([reportRes, modeRes]) => {
          setError(null);
          setReport(reportRes.data);
          setMode(modeRes.data.mode);
        })
        .catch(() => setError("Failed to load the readiness report.")),
    [],
  );

  const switchMode = async (next: AuthorityMode) => {
    setSwitching(true);
    try {
      await api.put("/api/org-chart/switchover/mode", { mode: next });
      setMode(next);
      setConfirmMode(null);
      toast.success(next === "lineManager" ? "Line-manager authority is on" : "Back to department-manager authority");
    } catch {
      toast.error("Failed to switch.");
    } finally {
      setSwitching(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const byUser = useMemo(() => {
    const groups = new Map<string, GrantMigration[]>();
    for (const g of report?.grants ?? []) groups.set(g.userId, [...(groups.get(g.userId) ?? []), g]);
    return [...groups.values()];
  }, [report]);

  // "Select all" leaves out holders with no line of their own: they're often leavers.
  const open = useMemo(
    () =>
      (report?.grants ?? [])
        .filter((g) => !g.holderUnlined)
        .flatMap((g) => g.suggestions)
        .filter((s) => !s.alreadyGranted),
    [report],
  );

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const create = async () => {
    setSaving(true);
    try {
      const res = await api.post<{ created: number; stale: string[] }>("/api/org-chart/switchover", { keys: [...selected] });
      toast.success(`Created ${res.data.created} delegated-access grant${res.data.created === 1 ? "" : "s"}`);
      if (res.data.stale.length > 0) toast.warning(`${res.data.stale.length} skipped because the data changed. Review again.`);
      setSelected(new Set());
      await fetchReport();
    } catch {
      toast.error("Failed to create the grants.");
    } finally {
      setSaving(false);
    }
  };

  if (!report) {
    return (
      <div className="container mx-auto py-6 px-4">
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking reporting lines and grants…
          </p>
        )}
      </div>
    );
  }

  const blocking = report.unlined.length + report.cycles.length + report.grants.filter((g) => g.outcome === "needsGrant" || g.outcome === "blocked").length;

  return (
    <div className="container mx-auto py-6 px-4 space-y-5 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Switch-over readiness</h1>
          <p className="text-sm text-muted-foreground mt-0.5 max-w-3xl">
            Before line managers take over from department managers, everyone needs a reporting line, and every department grant
            that someone still needs has to be carried across as delegated access. Only the switch below changes permissions.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchReport}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Card data-tour="switchover-mode" className={mode === "lineManager" ? "border-green-300 dark:border-green-800" : ""}>
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold flex items-center gap-2">
              <Power className="h-4 w-4" />
              Authority: {mode === "lineManager" ? "line managers" : "department managers"}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">
              {mode === "lineManager"
                ? "Who can see, manage and approve for whom follows reporting lines and delegated access. Department-manager grants are ignored but kept, so you can switch back."
                : "Department-manager grants decide who can see, manage and approve for whom. Switching to line managers takes effect on everyone's next page load."}
            </p>
          </div>
          {mode && (
            <Button
              variant={mode === "lineManager" ? "outline" : "default"}
              onClick={() => setConfirmMode(mode === "lineManager" ? "department" : "lineManager")}
            >
              {mode === "lineManager" ? "Switch back to department managers" : "Switch to line-manager authority"}
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmMode !== null} onOpenChange={(o) => !o && !switching && setConfirmMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmMode === "lineManager" ? "Switch to line-manager authority?" : "Switch back to department managers?"}
            </DialogTitle>
            <DialogDescription>
              {confirmMode === "lineManager"
                ? "From everyone's next page load, managers see and approve for the people in their reporting line and delegated access, and expiry emails go to line managers. Department-manager grants stop counting."
                : "Department-manager grants decide authority again from everyone's next page load. Reporting lines and delegated access are kept."}
            </DialogDescription>
          </DialogHeader>
          {confirmMode === "lineManager" && !report.ready && (
            <p className="text-sm text-amber-600">
              Not everything below is resolved ({blocking} item{blocking === 1 ? "" : "s"}). People with no reporting line will only
              be visible to admins until they get one, and their requests will need an admin to step in.
            </p>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmMode(null)} disabled={switching}>
              Cancel
            </Button>
            <Button onClick={() => confirmMode && switchMode(confirmMode)} disabled={switching}>
              {switching && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Switch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {report.ready ? (
        <Alert data-tour="switchover-readiness">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle>Ready</AlertTitle>
          <AlertDescription>Everyone has a reporting line and every department grant is accounted for.</AlertDescription>
        </Alert>
      ) : (
        <Alert data-tour="switchover-readiness">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertTitle>Not ready: {blocking} item{blocking === 1 ? "" : "s"} to resolve</AlertTitle>
          <AlertDescription>
            {report.root && <>Top of the reporting tree: {report.root.name}. </>}
            Resolve the items below. Reporting lines come from the{" "}
            <Link href="/admin/org-chart/import" className="underline">
              Workday import
            </Link>{" "}
            or the employee form.
          </AlertDescription>
        </Alert>
      )}

      <Card data-tour="switchover-unlined">
        <CardHeader>
          <CardTitle className="text-base">No reporting line ({report.unlined.length})</CardTitle>
          <CardDescription>
            Active employees with no manager, apart from the top of the tree. External staff get theirs from the import&apos;s
            &ldquo;Reports to (external)&rdquo; suggestions or the employee form.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {report.unlined.length === 0 ? (
            <p className="text-sm text-muted-foreground">Everyone has a line.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
              {report.unlined.map((e) => (
                <Link key={e.id} href={`/employees/${e.id}`} className="text-sm rounded px-2 py-1 hover:bg-muted/50">
                  {e.name}
                  {e.external && <Badge variant="outline" className="ml-1.5 text-[10px] py-0">External</Badge>}
                </Link>
              ))}
            </div>
          )}
          {report.cycles.length > 0 && (
            <div className="mt-3 text-sm text-destructive">
              {report.cycles.map((c, i) => (
                <p key={i}>Reporting loop: {c.join(" → ")}</p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-tour="switchover-grants">
        <CardHeader>
          <CardTitle className="text-base">Department-manager grants</CardTitle>
          <CardDescription>
            What each grant becomes. A level-0 grant reaches its child departments today, so it becomes one exact-department grant
            for each. Grants already covered by someone&apos;s reporting line simply stop being needed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {byUser.length === 0 && <p className="text-sm text-muted-foreground">No department-manager grants.</p>}
          {byUser.map((grants) => (
            <div key={grants[0].userId} className="rounded-md border">
              <p className="px-3 py-2 font-medium text-sm border-b bg-muted/30">{grants[0].userName}</p>
              <div className="divide-y">
                {grants.map((g) => (
                  <div key={g.departmentId} className="px-3 py-2 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium">{g.departmentName}</span>
                      {g.coversDepartments.length > 1 && (
                        <span className="text-xs text-muted-foreground">(reaches {g.coversDepartments.join(", ")})</span>
                      )}
                      <OutcomeBadge outcome={g.outcome} />
                    </div>
                    {g.holderUnlined && g.suggestions.length > 0 && (
                      <p className="text-xs text-amber-600">
                        {g.userName} has no reporting line themselves. If they&apos;ve left, don&apos;t carry this across.
                      </p>
                    )}
                    {g.blockedBy.length > 0 && (
                      <p className="text-xs text-amber-600">Give these people a reporting line first: {g.blockedBy.join(", ")}</p>
                    )}
                    {g.suggestions.map((s) => (
                      <label key={s.key} className="flex items-start gap-2 text-sm pl-1">
                        <Checkbox
                          checked={s.alreadyGranted || selected.has(s.key)}
                          disabled={s.alreadyGranted}
                          onCheckedChange={() => toggle(s.key)}
                          className="mt-0.5"
                        />
                        <span>
                          Acts at <span className="font-medium">{s.scopeManagerName}</span>&apos;s level,{" "}
                          <span className="font-medium">{s.departmentName}</span> only
                          {s.alreadyGranted && <span className="text-muted-foreground"> (exists)</span>}
                          <span className="block text-xs text-muted-foreground">
                            Keeps access to {s.uncovered.length <= 4 ? s.uncovered.join(", ") : `${s.uncovered.slice(0, 4).join(", ")} and ${s.uncovered.length - 4} more`}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {open.length > 0 && (
        <div data-bottom-bar data-tour="switchover-create" className="sticky bottom-0 z-30 border-t bg-background/95 backdrop-blur py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelected(new Set(open.map((s) => s.key)))}>
              Select all ({open.length})
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
          <Button onClick={create} disabled={selected.size === 0 || saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create {selected.size} delegated-access grant{selected.size === 1 ? "" : "s"}
          </Button>
        </div>
      )}
    </div>
  );
}
