"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import api from "@/lib/axios";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateInZone } from "@/lib/dates";
// Types only: the service imports prisma, which must not reach the client bundle.
import type { ExpiringStatus, ExpiryRow, MissingRow, OpenChip, SubmissionRow } from "@/lib/services/documentStatusService";

const TABS = ["expiring", "expired", "missing", "submitted", "review"] as const;
type Tab = (typeof TABS)[number];

const uploadHref = (r: { employeeId: number; kind: string; itemId: number }) =>
  `/forms/document-upload?employeeId=${r.employeeId}&kind=${r.kind}&itemId=${r.itemId}`;

function Chip({ open }: { open: OpenChip }) {
  if (open.status === "Pending") return <Badge variant="secondary">Awaiting review</Badge>;
  return open.isMine ? (
    <Link href={`/forms/document-upload?submission=${open.id}`}>
      <Badge variant="destructive">Sent back — fix it</Badge>
    </Link>
  ) : (
    <Badge variant="destructive">Sent back to the submitter</Badge>
  );
}

function Row({ title, sub, right }: { title: React.ReactNode; sub: React.ReactNode; right: React.ReactNode }) {
  return (
    <li className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3 border-b last:border-0">
      <div className="min-w-0">
        <p className="font-medium truncate">{title}</p>
        <p className="text-sm text-muted-foreground">{sub}</p>
      </div>
      <div className="shrink-0">{right}</div>
    </li>
  );
}

const missingLabel = (r: MissingRow) =>
  `${r.kind === "Ticket" ? "Ticket" : "Training"} — ${r.reason === "RetrainingRequired" ? "retraining required" : "not provided"}`;

export function ExpiringPageContent({ isAdmin, initialTab }: { isAdmin: boolean; initialTab?: string }) {
  const router = useRouter();
  const [data, setData] = useState<ExpiringStatus | null>(null);
  const [tab, setTab] = useState<Tab>((TABS as readonly string[]).includes(initialTab ?? "") ? (initialTab as Tab) : "expiring");
  const [department, setDepartment] = useState("all");
  const [search, setSearch] = useState("");

  const load = useCallback(
    () =>
      api
        .get<ExpiringStatus>("/api/expiring")
        .then((r) => setData(r.data))
        .catch(() => toast.error("Couldn't load this page.")),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);

  const everyone = useMemo(() => {
    if (!data) return [];
    return [...data.expiring, ...data.expired, ...data.missing, ...data.submitted, ...(data.reviewQueue ?? [])];
  }, [data]);
  const showFilters = new Set(everyone.map((r) => r.employeeId)).size > 1;
  const departments = [...new Set(everyone.map((r) => r.departmentName))].sort();
  const keep = <T extends { employeeName: string; departmentName: string }>(rows: T[]) =>
    rows.filter(
      (r) =>
        (department === "all" || r.departmentName === department) &&
        r.employeeName.toLowerCase().includes(search.trim().toLowerCase()),
    );

  async function cancel(id: number) {
    try {
      await api.post(`/api/document-submissions/${id}/cancel`);
      toast.success("Upload cancelled.");
      void load();
    } catch {
      toast.error("Couldn't cancel it.");
    }
  }

  if (!data) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const who = (r: { employeeName: string; departmentName: string }) => (showFilters ? `${r.employeeName} · ${r.departmentName}` : "");
  const expiryList = (rows: ExpiryRow[], expired: boolean) => (
    <ul>
      {keep(rows).map((r) => (
        <Row
          key={r.recordId}
          title={r.itemName}
          sub={[
            who(r),
            `${expired ? "Expired" : "Expires"} ${formatDateInZone(new Date(r.expiryDate))}${expired ? "" : ` · ${r.days} day${r.days === 1 ? "" : "s"}`}`,
          ]
            .filter(Boolean)
            .join(" — ")}
          right={r.open ? <Chip open={r.open} /> : <Button asChild size="sm"><Link href={uploadHref(r)}>Upload renewal</Link></Button>}
        />
      ))}
      {keep(rows).length === 0 && <p className="py-6 text-center text-muted-foreground">Nothing here.</p>}
    </ul>
  );
  const missingList = (rows: MissingRow[]) => (
    <ul>
      {keep(rows).map((r) => (
        <Row
          key={`${r.employeeId}:${r.kind}:${r.itemId}`}
          title={r.itemName}
          sub={[who(r), missingLabel(r)].filter(Boolean).join(" — ")}
          right={r.open ? <Chip open={r.open} /> : <Button asChild size="sm"><Link href={uploadHref(r)}>Upload</Link></Button>}
        />
      ))}
      {keep(rows).length === 0 && <p className="py-6 text-center text-muted-foreground">Nothing missing.</p>}
    </ul>
  );
  const submissionList = (rows: SubmissionRow[], review: boolean) => (
    <ul>
      {keep(rows).map((s) => (
        <Row
          key={s.id}
          title={s.itemName}
          sub={[
            who(s),
            `Uploaded ${formatDateInZone(new Date(s.createdAt))}${s.submittedByName ? ` by ${s.submittedByName}` : ""}`,
            s.status === "ChangesRequested" && s.reviewComment ? `“${s.reviewComment}”` : "",
          ]
            .filter(Boolean)
            .join(" — ")}
          right={
            review ? (
              <Button asChild size="sm"><Link href={`/expiring/review/${s.id}`}>Review</Link></Button>
            ) : (
              <div className="flex items-center gap-2">
                <Badge variant={s.status === "ChangesRequested" ? "destructive" : s.status === "Approved" ? "default" : "secondary"}>
                  {s.status === "ChangesRequested" ? "Sent back" : s.status === "Pending" ? "Awaiting review" : "Accepted"}
                </Badge>
                {s.isMine && s.status === "ChangesRequested" && (
                  <Button asChild size="sm" variant="outline"><Link href={`/forms/document-upload?submission=${s.id}`}>Fix</Link></Button>
                )}
                {s.isMine && (s.status === "Pending" || s.status === "ChangesRequested") && (
                  <Button size="sm" variant="ghost" onClick={() => cancel(s.id)}>Cancel</Button>
                )}
              </div>
            )
          }
        />
      ))}
      {keep(rows).length === 0 && <p className="py-6 text-center text-muted-foreground">Nothing here.</p>}
    </ul>
  );

  return (
    <div className="max-w-screen-2xl mx-auto p-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Expiring &amp; Missing</h1>
          <p className="text-muted-foreground mt-1">Tickets and training that are expiring, expired or still needed.</p>
        </div>
        <Button asChild><Link href="/forms/document-upload">Upload a document</Link></Button>
      </div>

      {showFilters && (
        <div className="flex flex-col sm:flex-row gap-2">
          <Input placeholder="Search by name" value={search} onChange={(e) => setSearch(e.target.value)} className="sm:max-w-xs" />
          <Select value={department} onValueChange={setDepartment}>
            <SelectTrigger className="sm:w-56"><SelectValue placeholder="All departments" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      <Tabs value={tab} onValueChange={(v) => { setTab(v as Tab); router.replace(`/expiring?tab=${v}`, { scroll: false }); }}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="expiring">Expiring ({keep(data.expiring).length})</TabsTrigger>
          <TabsTrigger value="expired">Expired ({keep(data.expired).length})</TabsTrigger>
          <TabsTrigger value="missing">Missing ({keep(data.missing).length})</TabsTrigger>
          <TabsTrigger value="submitted">Submitted ({keep(data.submitted).length})</TabsTrigger>
          {isAdmin && data.reviewQueue && <TabsTrigger value="review">Review queue ({keep(data.reviewQueue).length})</TabsTrigger>}
        </TabsList>
        <TabsContent value="expiring">{expiryList(data.expiring, false)}</TabsContent>
        <TabsContent value="expired">{expiryList(data.expired, true)}</TabsContent>
        <TabsContent value="missing">{missingList(data.missing)}</TabsContent>
        <TabsContent value="submitted">{submissionList(data.submitted, false)}</TabsContent>
        {isAdmin && data.reviewQueue && <TabsContent value="review">{submissionList(data.reviewQueue, true)}</TabsContent>}
      </Tabs>
    </div>
  );
}
