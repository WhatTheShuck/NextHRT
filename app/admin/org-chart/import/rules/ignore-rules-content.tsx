"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";
import api from "@/lib/axios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FIELD_LABELS } from "@/lib/workday/labels";
import type { LineField } from "@/lib/workday/suggestions";
import { ArrowLeft, Loader2, Search, Trash2 } from "lucide-react";

interface IgnoreRule {
  id: number;
  subjectKey: string;
  employeeId: number | null;
  field: LineField;
  value: string;
  valueLabel: string;
  note: string | null;
  personName: string | null;
  createdBy: string | null;
  createdAt: string;
}

export function IgnoreRulesContent() {
  const [rules, setRules] = useState<IgnoreRule[] | null>(null);
  const [search, setSearch] = useState("");
  const [removing, setRemoving] = useState<number | null>(null);

  const load = () =>
    api
      .get<IgnoreRule[]>("/api/workday-import/rules")
      .then((res) => setRules(res.data))
      .catch(() => {
        toast.error("Failed to load ignore rules.");
        setRules([]);
      });

  useEffect(() => {
    load();
  }, []);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rules ?? [];
    return (rules ?? []).filter((r) =>
      [r.personName, FIELD_LABELS[r.field], r.valueLabel, r.note].some((s) => s?.toLowerCase().includes(q)),
    );
  }, [rules, search]);

  const remove = async (rule: IgnoreRule) => {
    setRemoving(rule.id);
    try {
      await api.delete(`/api/workday-import/rules/${rule.id}`);
      toast.success("Rule removed. The suggestion can appear again on the next review.");
      setRules((prev) => prev?.filter((r) => r.id !== rule.id) ?? null);
    } catch {
      toast.error("Failed to remove the rule.");
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Ignore rules</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Suggestions you chose to ignore forever. Each rule hides one exact value; if Workday later says something different,
            it&apos;s suggested again. Remove a rule to see its suggestion again.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/org-chart/import">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Workday Import
          </Link>
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search rules…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
      </div>

      <Card>
        <CardContent className="p-0">
          {rules === null ? (
            <p className="p-6 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </p>
          ) : shown.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">{rules.length === 0 ? "No ignore rules yet." : "No rules match."}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Person</TableHead>
                  <TableHead>Suggestion</TableHead>
                  <TableHead>Ignored value</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="w-0" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">
                      {rule.employeeId !== null ? (
                        <Link href={`/employees/${rule.employeeId}`} className="hover:underline">
                          {rule.personName ?? `Employee #${rule.employeeId}`}
                        </Link>
                      ) : (
                        <>
                          {rule.personName ?? rule.subjectKey}
                          <Badge variant="outline" className="ml-1.5 text-[10px] py-0">
                            Workday
                          </Badge>
                        </>
                      )}
                    </TableCell>
                    <TableCell>{FIELD_LABELS[rule.field] ?? rule.field}</TableCell>
                    <TableCell className="text-sm">{rule.valueLabel || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs">{rule.note ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(rule.createdAt), "d MMM yyyy")}
                      {rule.createdBy && <> · {rule.createdBy}</>}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(rule)}
                        disabled={removing === rule.id}
                        aria-label="Remove rule"
                      >
                        {removing === rule.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        <span className="ml-1.5">Remove</span>
                      </Button>
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
