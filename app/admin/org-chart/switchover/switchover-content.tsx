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
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";

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

  const fetchReport = useCallback(
    () =>
      api
        .get<SwitchoverReport>("/api/org-chart/switchover", { timeout: 60000 })
        .then((res) => {
          setError(null);
          setReport(res.data);
        })
        .catch(() => setError("Failed to load the readiness report.")),
    [],
  );

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
            that someone still needs has to be carried across as delegated access. Nothing on this page changes permissions.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchReport}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {report.ready ? (
        <Alert>
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle>Ready</AlertTitle>
          <AlertDescription>Everyone has a reporting line and every department grant is accounted for.</AlertDescription>
        </Alert>
      ) : (
        <Alert>
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

      <Card>
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

      <Card>
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
        <div className="sticky bottom-0 z-30 border-t bg-background/95 backdrop-blur py-3 flex flex-wrap items-center justify-between gap-3">
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
