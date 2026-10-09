"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Loader2 } from "lucide-react";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { GenericCombobox, type ComboboxItem } from "@/components/ui/generic-combobox";
import { DateSelector } from "@/components/date-selector";
import { FilePicker, type ExistingFile } from "@/components/document-upload/file-picker";
import { calculateExpiryDate } from "@/lib/expiry-utils";
import { startOfDay } from "date-fns";

type Kind = "Ticket" | "Training";
interface TicketOpt { id: number; ticketName: string; ticketCode: string; renewal: number | null }
interface TrainingOpt { id: number; title: string }
interface EmployeeOpt { id: number; name: string; subtitle: string }
interface Submission {
  id: number; employeeId: number; kind: Kind; ticketId: number | null; trainingId: number | null;
  dateIssued: string; expiryDate: string | null; licenseNumber: string | null; provider: string | null;
  status: string; reviewComment: string | null; submittedByUserId: string | null; files: ExistingFile[];
  ticket: { ticketName: string } | null; training: { title: string } | null;
}

// The shared axios instance defaults to JSON (which would serialise FormData and drop the files)
// and a 10s timeout (too short for several photos over mobile data).
const UPLOAD_CONFIG = { headers: { "Content-Type": "multipart/form-data" }, timeout: 120_000 };

const errorMessage = (e: unknown) =>
  (e as { response?: { data?: { message?: string } } }).response?.data?.message ?? "Something went wrong. Try again.";

/** The submission's files, view-only (no add/remove buttons). */
function ReadOnlyFiles({ files }: { files: ExistingFile[] }) {
  if (files.length === 0) return <p className="text-sm text-muted-foreground">No files.</p>;
  return (
    <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {files.map((f) => {
        const src = `/api/images/${f.filePath}`;
        return (
          <li key={f.id} className="rounded-md border overflow-hidden bg-muted/40 aspect-[4/3]">
            <a href={src} target="_blank" rel="noreferrer" className="h-full w-full flex items-center justify-center">
              {f.fileType.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element -- authenticated API image
                <img src={src} alt={f.originalName} className="h-full w-full object-cover" />
              ) : (
                <span className="flex flex-col items-center gap-1 p-2 text-xs text-muted-foreground min-w-0 w-full">
                  <FileText className="h-6 w-6" />
                  <span className="truncate max-w-full">{f.originalName}</span>
                </span>
              )}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export function DocumentUploadContent({
  currentUserId,
  ownEmployeeId,
  initial,
  submissionId,
}: {
  currentUserId: string;
  ownEmployeeId: number | null;
  initial: { employeeId: number | null; kind: Kind | null; itemId: number | null };
  submissionId: number | null;
}) {
  const router = useRouter();
  const [employees, setEmployees] = useState<EmployeeOpt[]>([]);
  const [tickets, setTickets] = useState<TicketOpt[]>([]);
  const [trainings, setTrainings] = useState<TrainingOpt[]>([]);
  const [submission, setSubmission] = useState<Submission | null>(null);

  const [employeeId, setEmployeeId] = useState<number | null>(initial.employeeId ?? ownEmployeeId);
  const [kind, setKind] = useState<Kind>(initial.kind ?? "Ticket");
  const [itemId, setItemId] = useState<number | null>(initial.itemId);
  const [dateIssued, setDateIssued] = useState<Date>(() => startOfDay(new Date()));
  const [expiryDate, setExpiryDate] = useState<Date | null>(null);
  const [expiryTouched, setExpiryTouched] = useState(false);
  const [licenseNumber, setLicenseNumber] = useState("");
  const [provider, setProvider] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [existing, setExisting] = useState<ExistingFile[]>([]);
  const [removedFileIds, setRemovedFileIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  /** The submission couldn't be loaded; shown instead of a blank form that would create a new one. */
  const [loadError, setLoadError] = useState<string | null>(null);
  /** A deep link named an item that isn't an active ticket / External training. */
  const [unknownItem, setUnknownItem] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [emps, tks, trs] = await Promise.all([
          api.get<EmployeeOpt[]>("/api/document-submissions/employees"),
          api.get<TicketOpt[]>("/api/tickets?activeOnly=true"),
          api.get<TrainingOpt[]>("/api/training?activeOnly=true&category=External"),
        ]);
        setEmployees(emps.data);
        setTickets(tks.data);
        setTrainings(trs.data);
        // Nobody chosen yet and only one person to choose from: choose them.
        if (!submissionId && (initial.employeeId ?? ownEmployeeId) === null && emps.data.length === 1) {
          setEmployeeId(emps.data[0].id);
        }
        if (!submissionId && initial.itemId) {
          const linkedKind = initial.kind ?? "Ticket";
          const t = linkedKind === "Ticket" ? tks.data.find((x) => x.id === initial.itemId) : undefined;
          const known = linkedKind === "Ticket" ? !!t : trs.data.some((x) => x.id === initial.itemId);
          if (!known) {
            setItemId(null);
            setUnknownItem(true);
          } else if (t) {
            // A deep link names the ticket: offer its renewal-based expiry straight away.
            setExpiryDate(calculateExpiryDate(startOfDay(new Date()), t.renewal));
          }
        }
        if (submissionId) {
          const { data } = await api.get<Submission>(`/api/document-submissions/${submissionId}`);
          setSubmission(data);
          setEmployeeId(data.employeeId);
          setKind(data.kind);
          setItemId(data.ticketId ?? data.trainingId);
          setDateIssued(new Date(data.dateIssued));
          setExpiryDate(data.expiryDate ? new Date(data.expiryDate) : null);
          setExpiryTouched(true);
          setLicenseNumber(data.licenseNumber ?? "");
          setProvider(data.provider ?? "");
          setExisting(data.files);
        }
      } catch (e) {
        if (submissionId) setLoadError(errorMessage(e));
        else toast.error(errorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
    // Runs once per submission id; `initial` comes from the URL and doesn't change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId]);

  const ticket = kind === "Ticket" ? tickets.find((t) => t.id === itemId) : undefined;

  // Pre-fill expiry from the ticket's renewal period until the person edits it themselves.
  // Done in the change handlers, not an effect (react-hooks/set-state-in-effect).
  const refreshExpiry = (forItemId: number | null, issued: Date) => {
    if (kind !== "Ticket" || expiryTouched) return;
    const t = tickets.find((x) => x.id === forItemId);
    setExpiryDate(t ? calculateExpiryDate(issued, t.renewal) : null);
  };

  const employeeItems: ComboboxItem[] = useMemo(
    () => employees.map((e) => ({ id: e.id, label: e.name, value: String(e.id), subtitle: e.subtitle })),
    [employees],
  );
  const itemItems: ComboboxItem[] = useMemo(() => {
    const active: ComboboxItem[] =
      kind === "Ticket"
        ? tickets.map((t) => ({ id: t.id, label: t.ticketName, value: String(t.id), subtitle: t.ticketCode }))
        : trainings.map((t) => ({ id: t.id, label: t.title, value: String(t.id) }));
    // A submission filed under an item that has since been deactivated still shows what it was.
    if (itemId !== null && submission && !active.some((i) => i.id === itemId)) {
      const name = submission.ticket?.ticketName ?? submission.training?.title ?? "Unknown item";
      active.unshift({ id: itemId, label: `${name} (no longer active)`, value: String(itemId), disabled: true });
    }
    return active;
  }, [kind, tickets, trainings, itemId, submission]);

  const locked = submission !== null; // resubmits keep their employee and kind
  const sentBack = submission?.status === "ChangesRequested";
  // Only the submitter can fix a sent-back upload; everyone else just sees it.
  const readOnly = submission !== null && (!sentBack || submission.submittedByUserId !== currentUserId);

  async function submit() {
    if (!employeeId || !itemId) return toast.error("Choose who it's for and what it is.");
    if (files.length + existing.length === 0) return toast.error("Attach at least one photo or file.");
    const fd = new FormData();
    fd.append("employeeId", String(employeeId));
    fd.append("kind", kind);
    fd.append("itemId", String(itemId));
    fd.append("dateIssued", dateIssued.toISOString());
    fd.append("expiryDate", kind === "Ticket" && expiryDate ? expiryDate.toISOString() : "");
    fd.append("licenseNumber", kind === "Ticket" ? licenseNumber : "");
    fd.append("provider", kind === "Training" ? provider : "");
    files.forEach((f) => fd.append("files", f));
    setSubmitting(true);
    try {
      if (submission) {
        fd.append("removedFileIds", JSON.stringify(removedFileIds));
        await api.put(`/api/document-submissions/${submission.id}`, fd, UPLOAD_CONFIG);
      } else {
        await api.post("/api/document-submissions", fd, UPLOAD_CONFIG);
      }
      toast.success("Sent for review. You'll get an email once an administrator has checked it.");
      // Stay "submitting" while navigating away, so a second click can't send it twice.
      router.push("/expiring?tab=submitted");
    } catch (e) {
      toast.error(errorMessage(e));
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <p className="font-medium">Couldn&apos;t open this upload</p>
          <p className="mt-1">{loadError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">{submission ? "Your upload" : "Upload a document"}</h1>
        <p className="text-muted-foreground mt-1">
          Upload a ticket, licence or external training certificate. An administrator checks it before it is added to the record.
        </p>
      </div>

      {sentBack && submission?.reviewComment && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <p className="font-medium">Sent back for a change</p>
          <p className="mt-1">{submission.reviewComment}</p>
        </div>
      )}
      {unknownItem && (
        <div role="alert" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          That item can&apos;t be uploaded here.
        </div>
      )}
      {readOnly && (
        <div className="rounded-lg border bg-muted/50 p-4 text-sm">
          {sentBack
            ? "This upload was sent back to the person who submitted it. Only they can fix and resubmit it."
            : `This upload is ${submission!.status === "Pending" ? "waiting for review" : submission!.status.toLowerCase()} and can't be changed.`}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-lg">What is it?</CardTitle></CardHeader>
        <CardContent>
          <fieldset disabled={readOnly} className="min-w-0 space-y-4">
            {employeeItems.length > 1 && (
              <div className="space-y-2">
                <Label id="du-employee-label" htmlFor="du-employee">Who is it for?</Label>
                <GenericCombobox
                  id="du-employee"
                  aria-labelledby="du-employee-label du-employee"
                  items={employeeItems}
                  selectedItem={employeeItems.find((i) => i.id === employeeId) ?? null}
                  onSelect={(i) => setEmployeeId(i ? Number(i.id) : null)}
                  placeholder="Choose an employee"
                  showSubtitle
                  disabled={locked}
                  width="w-full"
                />
              </div>
            )}

            <RadioGroup
              value={kind}
              onValueChange={(v) => { setKind(v as Kind); setItemId(null); setUnknownItem(false); if (!expiryTouched) setExpiryDate(null); }}
              className="flex flex-wrap gap-x-6 gap-y-2"
              disabled={locked}
              aria-label="Type of document"
            >
              <div className="flex items-center gap-2"><RadioGroupItem value="Ticket" id="k-ticket" /><Label htmlFor="k-ticket">Ticket or licence</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="Training" id="k-training" /><Label htmlFor="k-training">External training</Label></div>
            </RadioGroup>

            <div className="space-y-2">
              <Label id="du-item-label" htmlFor="du-item">{kind === "Ticket" ? "Ticket" : "Training"}</Label>
              <GenericCombobox
                id="du-item"
                aria-labelledby="du-item-label du-item"
                items={itemItems}
                selectedItem={itemItems.find((i) => i.id === itemId) ?? null}
                onSelect={(i) => {
                  const id = i ? Number(i.id) : null;
                  setItemId(id);
                  setUnknownItem(false);
                  refreshExpiry(id, dateIssued);
                }}
                placeholder={kind === "Ticket" ? "Choose the ticket" : "Choose the training"}
                showSubtitle={kind === "Ticket"}
                width="w-full"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2" role="group" aria-labelledby="du-issued-label">
                <Label id="du-issued-label">{kind === "Ticket" ? "Date issued" : "Date completed"}</Label>
                <DateSelector selectedDate={dateIssued} onDateSelect={(d) => { setDateIssued(d); refreshExpiry(itemId, d); }} />
              </div>
              {kind === "Ticket" && (
                <div className="space-y-2" role="group" aria-labelledby="du-expiry-label">
                  <Label id="du-expiry-label">Expiry date</Label>
                  <DateSelector
                    optional
                    selectedDate={expiryDate}
                    onDateSelect={(d) => { setExpiryTouched(true); setExpiryDate(d); }}
                    placeholder={ticket?.renewal === null ? "Doesn't expire" : "Expiry date"}
                  />
                </div>
              )}
            </div>

            {kind === "Ticket" ? (
              <div className="space-y-2">
                <Label htmlFor="licence">Licence / card number (optional)</Label>
                <Input id="licence" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="provider">Who delivered it?</Label>
                <Input id="provider" placeholder="e.g. St John Ambulance" value={provider} onChange={(e) => setProvider(e.target.value)} />
              </div>
            )}
          </fieldset>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Photos or files</CardTitle></CardHeader>
        <CardContent>
          {readOnly ? (
            <ReadOnlyFiles files={existing} />
          ) : (
            <FilePicker
              files={files}
              onChange={setFiles}
              existing={existing}
              onRemoveExisting={(id) => {
                setExisting((prev) => prev.filter((f) => f.id !== id));
                setRemovedFileIds((prev) => [...prev, id]);
              }}
            />
          )}
        </CardContent>
      </Card>

      {!readOnly && (
        <Button className="w-full sm:w-auto" onClick={submit} disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {sentBack ? "Resubmit for review" : "Send for review"}
        </Button>
      )}
    </div>
  );
}
