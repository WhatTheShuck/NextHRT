"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RotateCw } from "lucide-react";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GenericCombobox, type ComboboxItem } from "@/components/ui/generic-combobox";
import { DateSelector } from "@/components/date-selector";
import { calculateExpiryDate } from "@/lib/expiry-utils";
import { formatDateInZone } from "@/lib/dates";

interface Detail {
  id: number; kind: "Ticket" | "Training"; status: string; ticketId: number | null; trainingId: number | null;
  dateIssued: string; expiryDate: string | null; licenseNumber: string | null; provider: string | null;
  reviewComment: string | null; createdAt: string;
  employee: { preferredFirstName: string | null; legalFirstName: string; preferredLastName: string | null; legalLastName: string; department: { name: string } };
  submittedByUser: { name: string | null; email: string | null } | null;
  files: { id: number; filePath: string; fileType: string; originalName: string }[];
  ticket: { ticketName: string } | null; training: { title: string } | null;
}

const errorMessage = (e: unknown) =>
  (e as { response?: { data?: { message?: string } } }).response?.data?.message ?? "Something went wrong.";

const STATUS_TEXT: Record<string, string> = {
  Approved: "approved",
  ChangesRequested: "sent back to the submitter",
  Cancelled: "cancelled",
};

export function ReviewContent({ id }: { id: number }) {
  const router = useRouter();
  const [d, setD] = useState<Detail | null>(null);
  const [options, setOptions] = useState<ComboboxItem[]>([]);
  const [renewalById, setRenewalById] = useState<Map<number, number | null>>(new Map());
  const [itemId, setItemId] = useState<number | null>(null);
  const [dateIssued, setDateIssued] = useState<Date>(new Date());
  const [expiryDate, setExpiryDate] = useState<Date | null>(null);
  const [licenseNumber, setLicenseNumber] = useState("");
  const [provider, setProvider] = useState("");
  const [reason, setReason] = useState("");
  const [rotation, setRotation] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState<"approve" | "sendBack" | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await api.get<Detail>(`/api/document-submissions/${id}`);
        setD(data);
        setItemId(data.ticketId ?? data.trainingId);
        setDateIssued(new Date(data.dateIssued));
        setExpiryDate(data.expiryDate ? new Date(data.expiryDate) : null);
        setLicenseNumber(data.licenseNumber ?? "");
        setProvider(data.provider ?? "");
        if (data.kind === "Ticket") {
          const tickets = (
            await api.get<{ id: number; ticketName: string; ticketCode: string; renewal: number | null }[]>("/api/tickets?activeOnly=true")
          ).data;
          setOptions(tickets.map((t) => ({ id: t.id, label: t.ticketName, value: String(t.id), subtitle: t.ticketCode })));
          setRenewalById(new Map(tickets.map((t) => [t.id, t.renewal])));
        } else {
          const trainings = (await api.get<{ id: number; title: string }[]>("/api/training?activeOnly=true&category=External")).data;
          setOptions(trainings.map((t) => ({ id: t.id, label: t.title, value: String(t.id) })));
        }
      } catch (e) {
        setLoadError(errorMessage(e));
        toast.error(errorMessage(e));
      }
    })();
  }, [id]);

  // The submission's item may have been deactivated since; still show what it was filed under.
  const items: ComboboxItem[] = useMemo(() => {
    if (!d || itemId === null || options.some((o) => o.id === itemId)) return options;
    const label = `${d.ticket?.ticketName ?? d.training?.title ?? "Unknown item"} (no longer active)`;
    return [{ id: itemId, label, value: String(itemId), disabled: true }, ...options];
  }, [d, itemId, options]);

  const name = useMemo(
    () => (d ? `${d.employee.preferredFirstName ?? d.employee.legalFirstName} ${d.employee.preferredLastName ?? d.employee.legalLastName}` : ""),
    [d],
  );

  // When the reviewer corrects the ticket or issue date, offer the matching renewal-based expiry
  // (they can still override it) instead of keeping a stale one.
  const recomputeExpiry = (forItemId: number | null, issued: Date) => {
    if (d?.kind !== "Ticket" || forItemId === null || !renewalById.has(forItemId)) return;
    setExpiryDate(calculateExpiryDate(issued, renewalById.get(forItemId) ?? null));
  };

  async function approve() {
    setBusy("approve");
    try {
      await api.post(`/api/document-submissions/${id}/approve`, {
        itemId: itemId ?? undefined,
        dateIssued: dateIssued.toISOString(),
        ...(d?.kind === "Ticket"
          ? { expiryDate: expiryDate ? expiryDate.toISOString() : null, licenseNumber }
          : { provider }),
      });
      toast.success("Approved and added to the record.");
      // Stay busy while navigating away, so a second click can't act twice.
      router.push("/expiring?tab=review");
    } catch (e) {
      toast.error(errorMessage(e));
      setBusy(null);
    }
  }

  async function sendBack() {
    if (!reason.trim()) return toast.error("Say what needs changing.");
    setBusy("sendBack");
    try {
      await api.post(`/api/document-submissions/${id}/send-back`, { reason });
      toast.success("Sent back to the submitter.");
      router.push("/expiring?tab=review");
    } catch (e) {
      toast.error(errorMessage(e));
      setBusy(null);
    }
  }

  if (loadError && !d) {
    return <p className="max-w-screen-2xl mx-auto p-4 text-muted-foreground">{loadError}</p>;
  }
  if (!d) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  const pending = d.status === "Pending";

  return (
    <div className="max-w-screen-2xl mx-auto p-4 grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-lg">Files</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {d.files.map((f) => {
            const src = `/api/images/${f.filePath}`;
            const turned = (rotation[f.id] ?? 0) % 180 !== 0;
            return f.fileType === "application/pdf" ? (
              <div key={f.id} className="space-y-2">
                <iframe src={src} title={f.originalName} className="w-full h-[70vh] rounded border" />
                <a href={src} target="_blank" rel="noreferrer" className="text-sm underline underline-offset-2">
                  Open PDF in a new tab
                </a>
              </div>
            ) : (
              <div key={f.id} className="space-y-2">
                {/* Opens full size in a new tab, where the browser can zoom. */}
                <a
                  href={src}
                  target="_blank"
                  rel="noreferrer"
                  className={`flex items-center justify-center rounded border bg-muted/40 ${turned ? "h-[70vh]" : ""}`}
                >
                  {/* Turned 90/270°, width and height swap on screen: cap both (height also by the screen
                      width, as it becomes the visible width on a phone) so it fits the 70vh box. */}
                  {/* eslint-disable-next-line @next/next/no-img-element -- authenticated API image */}
                  <img
                    src={src}
                    alt={f.originalName}
                    style={{ transform: `rotate(${rotation[f.id] ?? 0}deg)` }}
                    className={`object-contain transition-transform ${turned ? "max-h-[min(70vh,85vw)] max-w-[70vh]" : "w-full max-h-[70vh]"}`}
                  />
                </a>
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() => setRotation({ ...rotation, [f.id]: ((rotation[f.id] ?? 0) + 90) % 360 })}
                  aria-label={`Rotate ${f.originalName}`}
                >
                  <RotateCw className="h-4 w-4 mr-2" /> Rotate
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{name} · {d.employee.department.name}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Uploaded by {d.submittedByUser?.name || d.submittedByUser?.email || "a removed user"} on {formatDateInZone(new Date(d.createdAt))}. Check the details match the files.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <fieldset disabled={!pending} className="min-w-0 space-y-4">
            <div className="space-y-2">
              <Label id="rv-item-label" htmlFor="rv-item">{d.kind === "Ticket" ? "Ticket" : "Training"}</Label>
              <GenericCombobox
                id="rv-item"
                aria-labelledby="rv-item-label rv-item"
                items={items}
                selectedItem={items.find((o) => o.id === itemId) ?? null}
                onSelect={(o) => {
                  const next = o ? Number(o.id) : null;
                  setItemId(next);
                  recomputeExpiry(next, dateIssued);
                }}
                placeholder={d.kind === "Ticket" ? "Choose the ticket" : "Choose the training"}
                showSubtitle={d.kind === "Ticket"}
                width="w-full"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2" role="group" aria-labelledby="rv-issued-label">
                <Label id="rv-issued-label">{d.kind === "Ticket" ? "Date issued" : "Date completed"}</Label>
                <DateSelector selectedDate={dateIssued} onDateSelect={(nd) => { setDateIssued(nd); recomputeExpiry(itemId, nd); }} />
              </div>
              {d.kind === "Ticket" && (
                <div className="space-y-2" role="group" aria-labelledby="rv-expiry-label">
                  <Label id="rv-expiry-label">Expiry date</Label>
                  <DateSelector optional selectedDate={expiryDate} onDateSelect={setExpiryDate} />
                </div>
              )}
            </div>
            {d.kind === "Ticket" ? (
              <div className="space-y-2">
                <Label htmlFor="lic">Licence / card number</Label>
                <Input id="lic" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="prov">Provider</Label>
                <Input id="prov" value={provider} onChange={(e) => setProvider(e.target.value)} />
              </div>
            )}
          </fieldset>

          {pending ? (
            <>
              <Button className="w-full" onClick={approve} disabled={busy !== null}>
                {busy === "approve" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Approve and add to record
              </Button>
              <div className="space-y-2 pt-4 border-t">
                <Label htmlFor="reason">Or send it back</Label>
                <Textarea
                  id="reason"
                  placeholder="What needs fixing? e.g. the photo is blurry, wrong ticket chosen"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <Button variant="outline" className="w-full" onClick={sendBack} disabled={busy !== null}>
                  {busy === "sendBack" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Send back with this reason
                </Button>
              </div>
            </>
          ) : (
            <p className="rounded-lg border bg-muted/50 p-3 text-sm">
              This submission has been {STATUS_TEXT[d.status] ?? d.status.toLowerCase()} and can&apos;t be reviewed again.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
