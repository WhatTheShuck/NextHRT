"use client";

import { useEffect, useState } from "react";
import api from "@/lib/axios";
import { format } from "date-fns";
import { OnboardingPayload } from "@/lib/services/onboardingService";
import { OnboardingStatus } from "@/generated/prisma_client/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useEmployee } from "../employee-context";

interface OnboardingRequestSummary {
  id: number;
  status: OnboardingStatus;
  legalFirstName: string;
  legalLastName: string;
  title: string;
  employmentStatus: string;
  employmentType: string;
  startDate: string;
  createdAt: string;
  reviewedAt: string | null;
  reviewNotes: string | null;
  payload: string;
  submittedByUser: { id: string; name: string | null; email: string };
  jobFamily: { id: number; name: string } | null;
  medicalStandard: { id: number; name: string } | null;
}

interface Program {
  id: number;
  name: string;
}

interface HardwareItem {
  id: number;
  name: string;
}

function fmt(iso: string | null) {
  if (!iso) return "—";
  return format(new Date(iso), "PP");
}

function statusBadge(status: OnboardingStatus) {
  const variants: Record<OnboardingStatus, string> = {
    Pending: "bg-yellow-100 text-yellow-800",
    Approved: "bg-green-100 text-green-800",
    Rejected: "bg-red-100 text-red-800",
    Cancelled: "bg-gray-100 text-gray-700",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium ${variants[status]}`}
    >
      {status}
    </span>
  );
}

export function OnboardingTab() {
  const { employee } = useEmployee();
  const [request, setRequest] = useState<OnboardingRequestSummary | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [hardwareItems, setHardwareItems] = useState<HardwareItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!employee) return;
    setLoading(true);
    setError(null);

    Promise.all([
      api
        .get<OnboardingRequestSummary[]>(
          `/api/onboarding?createdEmployeeId=${employee.id}`,
        )
        .then((r) => r.data[0] ?? null),
      api.get<Program[]>("/api/programs").then((r) => r.data),
      api.get<HardwareItem[]>("/api/hardware").then((r) => r.data),
    ])
      .then(([req, progs, hw]) => {
        setRequest(req);
        setPrograms(progs);
        setHardwareItems(hw);
      })
      .catch(() => setError("Failed to load onboarding data."))
      .finally(() => setLoading(false));
  }, [employee]);

  if (loading) {
    return (
      <p className="text-muted-foreground text-sm py-8 text-center">
        Loading…
      </p>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!request) {
    return (
      <p className="text-muted-foreground text-sm py-8 text-center">
        No onboarding request found for this employee.
      </p>
    );
  }

  const payload = (() => {
    try {
      return JSON.parse(request.payload) as OnboardingPayload;
    } catch {
      return {
        programs: [],
        hardware: [],
        compliance: {},
        notes: {},
      } as OnboardingPayload;
    }
  })();

  const programMap = new Map(programs.map((p) => [p.id, p.name]));
  const hwMap = new Map(hardwareItems.map((h) => [h.id, h.name]));

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle>Onboarding Request</CardTitle>
              <CardDescription>
                Submitted {fmt(request.createdAt)} by{" "}
                {request.submittedByUser.name ?? request.submittedByUser.email}
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              {statusBadge(request.status)}
              <Link
                href={`/admin/onboarding/${request.id}`}
                className="text-xs underline text-muted-foreground flex items-center gap-1"
              >
                View full request
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Employment Status</p>
              <p>{request.employmentStatus}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Employment Type</p>
              <p>{request.employmentType}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Start Date</p>
              <p>{fmt(request.startDate)}</p>
            </div>
            {request.jobFamily && (
              <div>
                <p className="text-muted-foreground text-xs">Job Family</p>
                <p>{request.jobFamily.name}</p>
              </div>
            )}
            {request.medicalStandard && (
              <div>
                <p className="text-muted-foreground text-xs">
                  Medical Standard
                </p>
                <p>{request.medicalStandard.name}</p>
              </div>
            )}
            {request.reviewedAt && (
              <div>
                <p className="text-muted-foreground text-xs">
                  {request.status === "Approved" ? "Approved" : "Reviewed"} at
                </p>
                <p>{fmt(request.reviewedAt)}</p>
              </div>
            )}
          </div>
          {request.status === "Rejected" && request.reviewNotes && (
            <div className="mt-3">
              <Badge variant="destructive" className="text-xs">
                Rejection reason
              </Badge>
              <p className="text-sm mt-1">{request.reviewNotes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Programs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Software Programs</CardTitle>
        </CardHeader>
        <CardContent>
          {payload.programs.length === 0 ? (
            <p className="text-sm text-muted-foreground">None requested</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {payload.programs.map((p, i) => (
                <li key={i} className="flex items-center gap-2">
                  <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  <span>
                    {programMap.get(p.programId) ?? `Program #${p.programId}`}
                  </span>
                  {p.referenceUserEmployeeId && (
                    <span className="text-muted-foreground text-xs">
                      (ref. employee #{p.referenceUserEmployeeId})
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Hardware */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hardware</CardTitle>
        </CardHeader>
        <CardContent>
          {payload.hardware.length === 0 ? (
            <p className="text-sm text-muted-foreground">None requested</p>
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
                      {h.justification}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Compliance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Compliance / Forms</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {(
              [
                ["letterOfOfferSigned", "Letter of Offer Signed"],
                ["employmentFormsRequired", "Employment Forms Required"],
                ["policeCheckRequired", "Police Check Required"],
                ["marketingInductionRequired", "Marketing Induction"],
                ["willReceiveVehicle", "Will Receive KSB Vehicle"],
                ["willDriveVehicle", "Will Drive KSB Vehicle"],
              ] as [keyof OnboardingPayload["compliance"], string][]
            ).map(([key, label]) => (
              <div key={key} className="flex items-center gap-2">
                {payload.compliance[key] ? (
                  <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
                <span
                  className={payload.compliance[key] ? "" : "text-muted-foreground"}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {(payload.notes.it || payload.notes.hr || payload.notes.payroll) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Freeform Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(
              [
                ["it", "Note to IT"],
                ["hr", "Note to HR"],
                ["payroll", "Note to Payroll"],
              ] as [keyof OnboardingPayload["notes"], string][]
            ).map(([key, label]) =>
              payload.notes[key] ? (
                <div key={key}>
                  <Separator className="mb-3" />
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    {label}
                  </p>
                  <p className="text-sm whitespace-pre-wrap">
                    {payload.notes[key]}
                  </p>
                </div>
              ) : null,
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
