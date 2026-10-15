"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import api from "@/lib/axios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GenericCombobox, type ComboboxItem } from "@/components/ui/generic-combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { GrantRow } from "@/lib/services/delegatedAccessService";
import type { GrantLevel } from "@/lib/org/authority";
import { ArrowLeft, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { ConfirmAction } from "@/components/confirm-action";

interface Options {
  employees: { id: number; name: string; title: string }[];
  departments: { id: number; name: string }[];
  jobFamilies: { id: number; name: string }[];
}

const LEVEL_LABELS: Record<GrantLevel, string> = {
  View: "View only",
  Act: "Acts for the manager",
};

const SOURCE_LABELS: Record<string, string> = {
  Manual: "Set by hand",
  WorkdayStructural: "Workday import",
  WorkdayTitle: "Workday import",
  MigratedDeptGrant: "Switch-over",
};

/**
 * Delegated access (docs/workday-org-import-spec.md §8): people who see, or act for, a manager's
 * team beyond their own reporting line. Takes effect once line-manager authority is on.
 */
export function DelegatedAccessContent() {
  const [grants, setGrants] = useState<GrantRow[] | null>(null);
  const [options, setOptions] = useState<Options | null>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<number | null>(null);

  const load = () =>
    api
      .get<{ grants: GrantRow[]; options: Options }>("/api/delegated-access")
      .then((res) => {
        setGrants(res.data.grants);
        setOptions(res.data.options);
      })
      .catch(() => {
        toast.error("Failed to load delegated access.");
        setGrants([]);
      });

  useEffect(() => {
    load();
  }, []);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return grants ?? [];
    return (grants ?? []).filter((g) => [g.granteeName, g.summary].some((s) => s.toLowerCase().includes(q)));
  }, [grants, search]);

  const setLevel = async (grant: GrantRow, level: GrantLevel) => {
    setBusy(grant.id);
    try {
      await api.patch(`/api/delegated-access/${grant.id}`, { level });
      await load();
    } catch {
      toast.error("Failed to change the grant.");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (grant: GrantRow) => {
    setBusy(grant.id);
    try {
      await api.delete(`/api/delegated-access/${grant.id}`);
      toast.success("Grant removed.");
      setGrants((prev) => prev?.filter((g) => g.id !== grant.id) ?? null);
    } catch {
      toast.error("Failed to remove the grant.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Delegated access</h1>
          <p className="text-sm text-muted-foreground mt-0.5 max-w-3xl">
            People who see a manager&apos;s team beyond their own reporting line. <strong>View only</strong> shows the team&apos;s
            records. <strong>Acts for the manager</strong> also approves their training requests and gets their expiry emails.
            Filters narrow the team to one department and/or job family. Grants only take effect once line-manager authority
            is switched on.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/org-chart">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Org Chart
          </Link>
        </Button>
      </div>

      {options && <AddGrantForm options={options} onAdded={load} />}

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search grants…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
      </div>

      <Card data-tour="access-grants">
        <CardContent className="p-0">
          {grants === null ? (
            <p className="p-6 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </p>
          ) : shown.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">{grants.length === 0 ? "No grants yet." : "No grants match."}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Person</TableHead>
                  <TableHead>Grant</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Covers</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="w-0" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">
                      <Link href={`/employees/${g.granteeEmployeeId}`} className="hover:underline">
                        {g.granteeName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{g.summary}</TableCell>
                    <TableCell>
                      <Select value={g.level} onValueChange={(v) => setLevel(g, v as GrantLevel)} disabled={busy === g.id}>
                        <SelectTrigger className="h-8 w-[190px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="View">{LEVEL_LABELS.View}</SelectItem>
                          <SelectItem value="Act">{LEVEL_LABELS.Act}</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {g.covers.length === 0 ? (
                        <Badge variant="outline" className="text-amber-700 border-amber-300">
                          Nobody
                        </Badge>
                      ) : (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-sm underline decoration-dotted cursor-default">
                                {g.covers.length} {g.covers.length === 1 ? "person" : "people"}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">{g.covers.join(", ")}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{SOURCE_LABELS[g.source] ?? g.source}</TableCell>
                    <TableCell>
                      <ConfirmAction
                        title="Remove this grant?"
                        description={
                          <>
                            <strong>{g.granteeName}</strong> will no longer see {g.scopeManagerName}&apos;s
                            team through this grant. You can add it again later.
                          </>
                        }
                        confirmLabel="Remove grant"
                        onConfirm={() => remove(g)}
                      >
                        <Button variant="ghost" size="sm" disabled={busy === g.id} aria-label="Remove grant">
                          {busy === g.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          <span className="ml-1.5">Remove</span>
                        </Button>
                      </ConfirmAction>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AddGrantForm({ options, onAdded }: { options: Options; onAdded: () => Promise<unknown> }) {
  const people = useMemo<ComboboxItem[]>(
    () => options.employees.map((e) => ({ id: e.id, label: e.name, value: `${e.name} ${e.title}`, subtitle: e.title })),
    [options.employees],
  );
  const departments = useMemo<ComboboxItem[]>(
    () => options.departments.map((d) => ({ id: d.id, label: d.name, value: d.name })),
    [options.departments],
  );
  const jobFamilies = useMemo<ComboboxItem[]>(
    () => options.jobFamilies.map((j) => ({ id: j.id, label: j.name, value: j.name })),
    [options.jobFamilies],
  );
  const [grantee, setGrantee] = useState<ComboboxItem | null>(null);
  const [scope, setScope] = useState<ComboboxItem | null>(null);
  const [department, setDepartment] = useState<ComboboxItem | null>(null);
  const [jobFamily, setJobFamily] = useState<ComboboxItem | null>(null);
  const [level, setLevel] = useState<GrantLevel>("View");
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (!grantee || !scope) return;
    setSaving(true);
    try {
      await api.post("/api/delegated-access", {
        granteeEmployeeId: Number(grantee.id),
        scopeManagerEmployeeId: Number(scope.id),
        departmentId: department ? Number(department.id) : null,
        jobFamilyId: jobFamily ? Number(jobFamily.id) : null,
        level,
      });
      toast.success("Grant added.");
      setScope(null);
      setDepartment(null);
      setJobFamily(null);
      await onAdded();
    } catch (error) {
      const message = (error as { response?: { data?: { error?: string } } }).response?.data?.error;
      toast.error(message ?? "Failed to add the grant.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card data-tour="access-add">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Add a grant</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 items-end">
        <div className="space-y-1.5 lg:col-span-1">
          <Label>Person</Label>
          <GenericCombobox items={people} selectedItem={grantee} onSelect={setGrantee} placeholder="Who…" showSubtitle width="w-full" />
        </div>
        <div className="space-y-1.5 lg:col-span-1">
          <Label>Sees the team of</Label>
          <GenericCombobox items={people} selectedItem={scope} onSelect={setScope} placeholder="Manager…" showSubtitle width="w-full" />
        </div>
        <div className="space-y-1.5">
          <Label>Department</Label>
          <GenericCombobox
            items={departments}
            selectedItem={department}
            onSelect={setDepartment}
            placeholder="Any department"
            allowClear
            clearLabel="Any department"
            width="w-full"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Job family</Label>
          <GenericCombobox
            items={jobFamilies}
            selectedItem={jobFamily}
            onSelect={setJobFamily}
            placeholder="Any job family"
            allowClear
            clearLabel="Any job family"
            width="w-full"
          />
        </div>
        <div className="space-y-1.5" data-tour="access-level">
          <Label>Level</Label>
          <Select value={level} onValueChange={(v) => setLevel(v as GrantLevel)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="View">{LEVEL_LABELS.View}</SelectItem>
              <SelectItem value="Act">{LEVEL_LABELS.Act}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={add} disabled={!grantee || !scope || saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
          Add
        </Button>
      </CardContent>
    </Card>
  );
}
