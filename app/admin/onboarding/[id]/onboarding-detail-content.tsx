"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMediaQuery } from "usehooks-ts";
import api from "@/lib/axios";
import { format } from "date-fns";
import {
  EmployeeStatus,
  OnboardingStatus,
} from "@/generated/prisma_client/client";
import {
  OnboardingCoreHRData,
  OnboardingPayload,
} from "@/lib/services/onboardingService";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  User,
  ExternalLink,
  Clock,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";

// ─── Data types ───────────────────────────────────────────────────────────────

interface PendingOrgRequest {
  id: number;
  type: "Department" | "Location";
  requestedData: string; // JSON
  status: "Pending" | "Approved" | "Rejected";
  requestedByUser: { id: string; name: string | null; email: string };
}

interface OnboardingRequest {
  id: number;
  status: OnboardingStatus;
  legalFirstName: string;
  legalLastName: string;
  preferredFirstName: string | null;
  preferredLastName: string | null;
  title: string;
  departmentId: number | null;
  locationId: number | null;
  pendingDepartmentRequestId: number | null;
  pendingLocationRequestId: number | null;
  pendingDepartmentRequest: PendingOrgRequest | null;
  pendingLocationRequest: PendingOrgRequest | null;
  employmentStatus: EmployeeStatus;
  employmentType: string;
  startDate: string;
  managerEmployeeId: number | null;
  jobFamilyId: number | null;
  medicalStandardId: number | null;
  emailConfirmed: boolean;
  payload: string;
  createdEmployeeId: number | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
  updatedAt: string;
  submittedByUser: { id: string; name: string | null; email: string };
  jobFamily: { id: number; name: string } | null;
  medicalStandard: { id: number; name: string } | null;
}

interface Department {
  id: number;
  name: string;
  isActive: boolean;
}

interface Location {
  id: number;
  name: string;
  state: string;
  isActive: boolean;
}

interface JobFamily {
  id: number;
  name: string;
  isActive: boolean;
}

interface MedicalStandard {
  id: number;
  name: string;
  isActive: boolean;
}

interface Program {
  id: number;
  name: string;
}

interface HardwareItem {
  id: number;
  name: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EMPLOYMENT_STATUSES: EmployeeStatus[] = [
  "Permanent",
  "PartTimePermanent",
  "Apprentice",
  "LabourContractor",
  "IndustryExperience",
];

function statusBadge(status: OnboardingStatus) {
  const variants: Record<OnboardingStatus, string> = {
    Pending: "bg-yellow-100 text-yellow-800",
    Approved: "bg-green-100 text-green-800",
    Rejected: "bg-red-100 text-red-800",
    Cancelled: "bg-gray-100 text-gray-700",
  };
  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium ${variants[status]}`}
    >
      {status}
    </span>
  );
}

function fmt(iso: string | null) {
  if (!iso) return "—";
  return format(new Date(iso), "PP");
}

// ─── Reject dialog (responsive Dialog / Drawer) ───────────────────────────────

function RejectDialog({
  open,
  onOpenChange,
  onConfirm,
  submitting,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (notes: string) => void;
  submitting: boolean;
}) {
  const [notes, setNotes] = useState("");
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const handleConfirm = () => {
    onConfirm(notes);
  };

  const form = (
    <div className="space-y-4 px-1">
      <div className="space-y-2">
        <Label htmlFor="reject-notes">Reason for rejection (optional)</Label>
        <Textarea
          id="reject-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Hire did not proceed, duplicate submission…"
          rows={3}
          disabled={submitting}
        />
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pb-2">
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button
          variant="destructive"
          onClick={handleConfirm}
          disabled={submitting}
        >
          <XCircle className="h-4 w-4 mr-2" />
          {submitting ? "Rejecting..." : "Confirm Rejection"}
        </Button>
      </div>
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Onboarding Request</DialogTitle>
            <DialogDescription>
              This will reject the request. No employee will be created.
            </DialogDescription>
          </DialogHeader>
          {form}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Reject Onboarding Request</DrawerTitle>
          <DrawerDescription>
            This will reject the request. No employee will be created.
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-4 overflow-y-auto">{form}</div>
      </DrawerContent>
    </Drawer>
  );
}

// ─── Payload read-only display ────────────────────────────────────────────────

function PayloadDisplay({
  payload,
  programs,
  hardwareItems,
}: {
  payload: OnboardingPayload;
  programs: Program[];
  hardwareItems: HardwareItem[];
}) {
  const programMap = new Map(programs.map((p) => [p.id, p.name]));
  const hwMap = new Map(hardwareItems.map((h) => [h.id, h.name]));

  return (
    <div className="space-y-6">
      {/* Programs */}
      <div>
        <h3 className="text-sm font-semibold mb-2">Software Programs</h3>
        {payload.programs.length === 0 ? (
          <p className="text-sm text-muted-foreground">None selected</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {payload.programs.map((p, i) => (
              <li key={i} className="flex items-center gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                <span>{programMap.get(p.programId) ?? `Program #${p.programId}`}</span>
                {p.referenceUserEmployeeId && (
                  <span className="text-muted-foreground text-xs">
                    (ref. employee #{p.referenceUserEmployeeId})
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Separator />

      {/* Hardware */}
      <div>
        <h3 className="text-sm font-semibold mb-2">Hardware</h3>
        {payload.hardware.length === 0 ? (
          <p className="text-sm text-muted-foreground">None selected</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {payload.hardware.map((h, i) => (
              <li key={i} className="flex flex-col gap-0.5">
                <span className="flex items-center gap-2">
                  <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  {hwMap.get(h.hardwareItemId) ?? `Item #${h.hardwareItemId}`}
                  {h.nonStandard && (
                    <Badge variant="outline" className="text-xs">
                      Non-standard
                    </Badge>
                  )}
                </span>
                {h.justification && (
                  <p className="text-muted-foreground pl-5 text-xs">
                    Justification: {h.justification}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Separator />

      {/* Compliance */}
      <div>
        <h3 className="text-sm font-semibold mb-2">Compliance / Forms</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {(
            [
              ["letterOfOfferSigned", "Letter of Offer Signed"],
              ["employmentFormsRequired", "Employment Forms Required"],
              ["policeCheckRequired", "Police Check Required"],
              ["marketingInductionRequired", "Marketing Induction"],
              ["willReceiveVehicle", "Will Receive KSB Vehicle"],
              ["willDriveVehicle", "Will Drive KSB Vehicle"],
            ] as [keyof typeof payload.compliance, string][]
          ).map(([key, label]) => (
            <div key={key} className="flex items-center gap-2">
              {payload.compliance[key] ? (
                <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              )}
              <span
                className={
                  payload.compliance[key] ? "" : "text-muted-foreground"
                }
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Notes */}
      <div>
        <h3 className="text-sm font-semibold mb-2">Freeform Notes</h3>
        <div className="space-y-3">
          {(
            [
              ["it", "Note to IT"],
              ["hr", "Note to HR"],
              ["payroll", "Note to Payroll"],
            ] as [keyof typeof payload.notes, string][]
          ).map(([key, label]) =>
            payload.notes[key] ? (
              <div key={key}>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  {label}
                </p>
                <p className="text-sm bg-muted rounded-md px-3 py-2 whitespace-pre-wrap">
                  {payload.notes[key]}
                </p>
              </div>
            ) : null,
          )}
          {!payload.notes.it && !payload.notes.hr && !payload.notes.payroll && (
            <p className="text-sm text-muted-foreground">No notes provided</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main content ─────────────────────────────────────────────────────────────

export function OnboardingDetailContent({
  requestId,
}: {
  requestId: number;
}) {
  const router = useRouter();

  const [request, setRequest] = useState<OnboardingRequest | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [jobFamilies, setJobFamilies] = useState<JobFamily[]>([]);
  const [medicalStandards, setMedicalStandards] = useState<MedicalStandard[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [hardwareItems, setHardwareItems] = useState<HardwareItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [orgRequestAction, setOrgRequestAction] = useState<{ id: number; action: "approve" | "reject" } | null>(null);
  const [orgRequestNote, setOrgRequestNote] = useState("");
  const [orgRequestSubmitting, setOrgRequestSubmitting] = useState(false);

  // Editable core HR fields (pre-filled from the request).
  const [edits, setEdits] = useState<Partial<OnboardingCoreHRData>>({});

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reqRes, deptRes, locRes, jfRes, msRes, progRes, hwRes] =
        await Promise.all([
          api.get<OnboardingRequest>(`/api/onboarding/${requestId}`),
          api.get<Department[]>("/api/departments"),
          api.get<Location[]>("/api/locations"),
          api.get<JobFamily[]>("/api/job-families"),
          api.get<MedicalStandard[]>("/api/medical-standards"),
          api.get<Program[]>("/api/programs"),
          api.get<HardwareItem[]>("/api/hardware"),
        ]);

      setRequest(reqRes.data);
      setDepartments(deptRes.data);
      setLocations(locRes.data);
      setJobFamilies(jfRes.data);
      setMedicalStandards(msRes.data);
      setPrograms(progRes.data);
      setHardwareItems(hwRes.data);

      // Pre-fill edits from the fetched request.
      const r = reqRes.data;
      setEdits({
        legalFirstName: r.legalFirstName,
        legalLastName: r.legalLastName,
        preferredFirstName: r.preferredFirstName ?? undefined,
        preferredLastName: r.preferredLastName ?? undefined,
        title: r.title,
        departmentId: r.departmentId,
        locationId: r.locationId,
        employmentStatus: r.employmentStatus,
        startDate: r.startDate.substring(0, 10),
        jobFamilyId: r.jobFamilyId ?? undefined,
        medicalStandardId: r.medicalStandardId ?? undefined,
        managerEmployeeId: r.managerEmployeeId ?? undefined,
        emailConfirmed: r.emailConfirmed,
      });
    } catch (e: unknown) {
      if (
        e &&
        typeof e === "object" &&
        "response" in e &&
        (e as { response?: { status?: number } }).response?.status === 404
      ) {
        setError("Onboarding request not found.");
      } else {
        setError("Failed to load request details.");
      }
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleOrgRequestDecision = async () => {
    if (!orgRequestAction) return;
    setOrgRequestSubmitting(true);
    setActionError(null);
    try {
      await api.post(`/api/org-requests/${orgRequestAction.id}/${orgRequestAction.action}`, {
        note: orgRequestNote.trim() || undefined,
      });
      setOrgRequestAction(null);
      setOrgRequestNote("");
      await fetchAll();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? ((e as { response?: { data?: { error?: string } } }).response?.data?.error) ?? "Failed."
          : "Failed.";
      setActionError(msg);
    } finally {
      setOrgRequestSubmitting(false);
    }
  };

  const handleApprove = async () => {
    setApproving(true);
    setActionError(null);
    try {
      const result = await api.post<{ employee: { id: number } }>(
        `/api/onboarding/${requestId}/approve`,
        edits,
      );
      router.push(`/employees/${result.data.employee.id}`);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (
              (e as { response?: { data?: { error?: string } } }).response
                ?.data?.error
            ) ?? "Failed to approve request."
          : "Failed to approve request.";
      setActionError(msg);
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async (notes: string) => {
    setRejecting(true);
    setActionError(null);
    try {
      await api.post(`/api/onboarding/${requestId}/reject`, {
        reviewNotes: notes || null,
      });
      setRejectOpen(false);
      await fetchAll();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (
              (e as { response?: { data?: { error?: string } } }).response
                ?.data?.error
            ) ?? "Failed to reject request."
          : "Failed to reject request.";
      setActionError(msg);
    } finally {
      setRejecting(false);
    }
  };

  if (loading) {
    return (
      <p className="text-muted-foreground text-sm py-8 text-center">
        Loading...
      </p>
    );
  }

  if (error || !request) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error ?? "Unknown error"}</AlertDescription>
      </Alert>
    );
  }

  const isPending = request.status === "Pending";
  const hasPendingOrgRequests =
    request.pendingDepartmentRequestId !== null || request.pendingLocationRequestId !== null;
  const payload = (() => {
    try {
      return JSON.parse(request.payload) as OnboardingPayload;
    } catch {
      return { programs: [], hardware: [], compliance: {}, notes: {} };
    }
  })();

  const deptName = request.departmentId
    ? (departments.find((d) => d.id === request.departmentId)?.name ?? `Dept #${request.departmentId}`)
    : request.pendingDepartmentRequest
    ? `${(JSON.parse(request.pendingDepartmentRequest.requestedData) as { name: string }).name} (Pending)`
    : "—";
  const locName = request.locationId
    ? (locations.find((l) => l.id === request.locationId)?.name ?? `Location #${request.locationId}`)
    : request.pendingLocationRequest
    ? `${(JSON.parse(request.pendingLocationRequest.requestedData) as { name: string; state: string }).name} (Pending)`
    : "—";

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/admin/onboarding")}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold truncate">
            {request.legalFirstName} {request.legalLastName}
          </h1>
          <p className="text-sm text-muted-foreground">
            Submitted {fmt(request.createdAt)} by{" "}
            {request.submittedByUser.name ?? request.submittedByUser.email}
          </p>
        </div>
        {statusBadge(request.status)}
      </div>

      {actionError && (
        <Alert variant="destructive">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      {/* Approved — link to employee */}
      {request.status === "Approved" && request.createdEmployeeId && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center gap-2">
            Employee record created.
            <Link
              href={`/employees/${request.createdEmployeeId}`}
              className="underline font-medium flex items-center gap-1"
            >
              View Employee
              <ExternalLink className="h-3 w-3" />
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Rejected — show reason */}
      {request.status === "Rejected" && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            Rejected{request.reviewNotes ? `: ${request.reviewNotes}` : "."}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: editable core HR fields */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Core Employee Details</CardTitle>
              <CardDescription>
                {isPending
                  ? "Review and optionally edit these fields before approving."
                  : `Snapshot of the ${request.status.toLowerCase()} request.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="legalFirst">Legal First Name</Label>
                  <Input
                    id="legalFirst"
                    value={edits.legalFirstName ?? ""}
                    onChange={(e) =>
                      setEdits((v) => ({
                        ...v,
                        legalFirstName: e.target.value,
                      }))
                    }
                    disabled={!isPending}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="legalLast">Legal Last Name</Label>
                  <Input
                    id="legalLast"
                    value={edits.legalLastName ?? ""}
                    onChange={(e) =>
                      setEdits((v) => ({
                        ...v,
                        legalLastName: e.target.value,
                      }))
                    }
                    disabled={!isPending}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="prefFirst">
                    Preferred First Name{" "}
                    <span className="text-muted-foreground font-normal">
                      (optional)
                    </span>
                  </Label>
                  <Input
                    id="prefFirst"
                    value={edits.preferredFirstName ?? ""}
                    onChange={(e) =>
                      setEdits((v) => ({
                        ...v,
                        preferredFirstName: e.target.value || undefined,
                      }))
                    }
                    placeholder="Defaults to legal name"
                    disabled={!isPending}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="prefLast">
                    Preferred Last Name{" "}
                    <span className="text-muted-foreground font-normal">
                      (optional)
                    </span>
                  </Label>
                  <Input
                    id="prefLast"
                    value={edits.preferredLastName ?? ""}
                    onChange={(e) =>
                      setEdits((v) => ({
                        ...v,
                        preferredLastName: e.target.value || undefined,
                      }))
                    }
                    placeholder="Defaults to legal name"
                    disabled={!isPending}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={edits.title ?? ""}
                  onChange={(e) =>
                    setEdits((v) => ({ ...v, title: e.target.value }))
                  }
                  disabled={!isPending}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Department</Label>
                  {isPending ? (
                    <Select
                      value={String(edits.departmentId ?? "")}
                      onValueChange={(v) =>
                        setEdits((prev) => ({
                          ...prev,
                          departmentId: parseInt(v),
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments
                          .filter((d) => d.isActive)
                          .map((d) => (
                            <SelectItem key={d.id} value={String(d.id)}>
                              {d.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={deptName} disabled />
                  )}
                </div>
                <div className="space-y-1">
                  <Label>Location</Label>
                  {isPending ? (
                    <Select
                      value={String(edits.locationId ?? "")}
                      onValueChange={(v) =>
                        setEdits((prev) => ({
                          ...prev,
                          locationId: parseInt(v),
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                      <SelectContent>
                        {locations
                          .filter((l) => l.isActive)
                          .map((l) => (
                            <SelectItem key={l.id} value={String(l.id)}>
                              {l.name} ({l.state})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={locName} disabled />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Employment Status</Label>
                  {isPending ? (
                    <Select
                      value={edits.employmentStatus ?? ""}
                      onValueChange={(v) =>
                        setEdits((prev) => ({
                          ...prev,
                          employmentStatus: v as EmployeeStatus,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {EMPLOYMENT_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={request.employmentStatus} disabled />
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={edits.startDate?.substring(0, 10) ?? ""}
                    onChange={(e) =>
                      setEdits((v) => ({ ...v, startDate: e.target.value }))
                    }
                    disabled={!isPending}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>
                    Job Family{" "}
                    <span className="text-muted-foreground font-normal">
                      (optional)
                    </span>
                  </Label>
                  {isPending ? (
                    <Select
                      value={
                        edits.jobFamilyId !== undefined
                          ? String(edits.jobFamilyId)
                          : "none"
                      }
                      onValueChange={(v) =>
                        setEdits((prev) => ({
                          ...prev,
                          jobFamilyId: v === "none" ? undefined : parseInt(v),
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select job family" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {jobFamilies
                          .filter((jf) => jf.isActive)
                          .map((jf) => (
                            <SelectItem key={jf.id} value={String(jf.id)}>
                              {jf.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={request.jobFamily?.name ?? "None"}
                      disabled
                    />
                  )}
                </div>
                <div className="space-y-1">
                  <Label>
                    Medical Standard{" "}
                    <span className="text-muted-foreground font-normal">
                      (optional)
                    </span>
                  </Label>
                  {isPending ? (
                    <Select
                      value={
                        edits.medicalStandardId !== undefined
                          ? String(edits.medicalStandardId)
                          : "none"
                      }
                      onValueChange={(v) =>
                        setEdits((prev) => ({
                          ...prev,
                          medicalStandardId:
                            v === "none" ? undefined : parseInt(v),
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select medical standard" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {medicalStandards
                          .filter((ms) => ms.isActive)
                          .map((ms) => (
                            <SelectItem key={ms.id} value={String(ms.id)}>
                              {ms.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={request.medicalStandard?.name ?? "None"}
                      disabled
                    />
                  )}
                </div>
              </div>

              {/* Email confirmed flag */}
              <div className="flex items-center gap-2 text-sm">
                {request.emailConfirmed ? (
                  <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <span
                  className={
                    request.emailConfirmed ? "" : "text-muted-foreground"
                  }
                >
                  Submitter confirmed the email address looks correct
                </span>
              </div>

              {/* Approve/reject actions */}
              {isPending && (
                <>
                  <Separator />
                  {/* Pending org requests — must be resolved before approval */}
                  {hasPendingOrgRequests && (
                    <div className="space-y-3">
                      <Alert>
                        <Clock className="h-4 w-4" />
                        <AlertTitle>Pending Org Requests</AlertTitle>
                        <AlertDescription>
                          The submitter requested new org entries below. Resolve them before approving this onboarding request.
                        </AlertDescription>
                      </Alert>
                      {[request.pendingDepartmentRequest, request.pendingLocationRequest]
                        .filter((r): r is PendingOrgRequest => r !== null && r.status === "Pending")
                        .map((orgReq) => {
                          const data = JSON.parse(orgReq.requestedData) as Record<string, string>;
                          return (
                            <div key={orgReq.id} className="rounded-md border p-3 space-y-2 text-sm">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div>
                                  <span className="font-medium">{orgReq.type}: </span>
                                  <span>{data.name}</span>
                                  {data.state && <span className="text-muted-foreground">, {data.state}</span>}
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    Requested by {orgReq.requestedByUser.name ?? orgReq.requestedByUser.email}
                                  </p>
                                </div>
                                <div className="flex gap-2 shrink-0">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-green-700 border-green-300 hover:bg-green-50"
                                    onClick={() => { setOrgRequestAction({ id: orgReq.id, action: "approve" }); setOrgRequestNote(""); }}
                                    disabled={orgRequestSubmitting}
                                  >
                                    <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-destructive border-destructive/30 hover:bg-destructive/10"
                                    onClick={() => { setOrgRequestAction({ id: orgReq.id, action: "reject" }); setOrgRequestNote(""); }}
                                    disabled={orgRequestSubmitting}
                                  >
                                    <XCircle className="h-3.5 w-3.5 mr-1" />
                                    Reject
                                  </Button>
                                </div>
                              </div>
                              {orgRequestAction?.id === orgReq.id && (
                                <div className="space-y-2 pt-1 border-t">
                                  {orgRequestAction.action === "reject" && (
                                    <div className="space-y-1">
                                      <Label htmlFor={`org-note-${orgReq.id}`} className="text-xs">Reason (optional)</Label>
                                      <Textarea
                                        id={`org-note-${orgReq.id}`}
                                        value={orgRequestNote}
                                        onChange={(e) => setOrgRequestNote(e.target.value)}
                                        rows={2}
                                        disabled={orgRequestSubmitting}
                                      />
                                    </div>
                                  )}
                                  <div className="flex gap-2">
                                    <Button size="sm" onClick={handleOrgRequestDecision} disabled={orgRequestSubmitting}>
                                      {orgRequestSubmitting ? "Saving…" : `Confirm ${orgRequestAction.action === "approve" ? "Approval" : "Rejection"}`}
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => setOrgRequestAction(null)} disabled={orgRequestSubmitting}>
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      onClick={handleApprove}
                      disabled={approving || rejecting || hasPendingOrgRequests}
                      title={hasPendingOrgRequests ? "Resolve pending org requests first" : undefined}
                      className="flex items-center gap-2"
                    >
                      <CheckCircle className="h-4 w-4" />
                      {approving ? "Approving…" : "Approve & Create Employee"}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => setRejectOpen(true)}
                      disabled={approving || rejecting}
                      className="flex items-center gap-2"
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Payload */}
          <Card>
            <CardHeader>
              <CardTitle>Submission Payload</CardTitle>
              <CardDescription>
                Programs, hardware, compliance flags, and notes from the
                onboarding form. Read-only — not part of the Admin approval
                gate.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PayloadDisplay
                payload={payload}
                programs={programs}
                hardwareItems={hardwareItems}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right: metadata sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Request Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-muted-foreground text-xs">Submitted by</p>
                  <p>
                    {request.submittedByUser.name ??
                      request.submittedByUser.email}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Submitted at</p>
                <p>{fmt(request.createdAt)}</p>
              </div>
              {request.reviewedAt && (
                <div>
                  <p className="text-muted-foreground text-xs">
                    {request.status === "Approved" ? "Approved" : "Rejected"}{" "}
                    at
                  </p>
                  <p>{fmt(request.reviewedAt)}</p>
                </div>
              )}
              {request.managerEmployeeId && (
                <div>
                  <p className="text-muted-foreground text-xs">
                    Manager (next-steps email)
                  </p>
                  <p>Employee #{request.managerEmployeeId}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground text-xs">Employment Type</p>
                <p>{request.employmentType}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <RejectDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        onConfirm={handleReject}
        submitting={rejecting}
      />
    </div>
  );
}
