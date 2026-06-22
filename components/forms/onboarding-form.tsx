"use client";

import { useState, useEffect } from "react";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { DateSelector } from "@/components/date-selector";
import { EmployeeCombobox } from "@/components/combobox/employee-combobox";
import { AddDepartmentDialog, PendingDepartment } from "@/components/dialogs/department/add-department-dialog";
import { AddLocationDialog, PendingLocation } from "@/components/dialogs/location/add-location-dialog";
import { AlertTriangle, CheckCircle2, Clock, Plus, X } from "lucide-react";
import { companyDetails } from "@/lib/data";
import {
  Department,
  Employee,
  EmployeeStatus,
  HardwareItem,
  JobFamily,
  Location,
  MedicalStandard,
  Program,
  UserRole,
} from "@/generated/prisma_client/client";
import type {
  CreateOnboardingData,
  OnboardingPayload,
} from "@/lib/services/onboardingService";
import { AxiosError } from "axios";

const STATUS_LABELS: Record<EmployeeStatus, string> = {
  Permanent: "Permanent",
  PartTimePermanent: "Part Time Permanent",
  Apprentice: "Apprentice",
  LabourContractor: "Labour Contractor",
  IndustryExperience: "Industry Experience",
};

const INTERNAL_STATUSES: EmployeeStatus[] = ["Permanent", "PartTimePermanent"];

export interface OnboardingFormProps {
  linkedEmployeeId: number | null;
  userRole?: UserRole | null;
}

export function OnboardingForm({
  linkedEmployeeId,
  userRole,
}: OnboardingFormProps) {
  // ── Reference data ───────────────────────────────────────────────────────────
  const [departments, setDepartments] = useState<Department[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [jobFamilies, setJobFamilies] = useState<JobFamily[]>([]);
  const [medicalStandards, setMedicalStandards] = useState<MedicalStandard[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [hardwareItems, setHardwareItems] = useState<HardwareItem[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ── Section 1: Core HR ─���─────────────────────────────────────────────────────
  const [legalFirstName, setLegalFirstName] = useState("");
  const [legalLastName, setLegalLastName] = useState("");
  const [preferredSameAsLegal, setPreferredSameAsLegal] = useState(true);
  const [preferredFirstName, setPreferredFirstName] = useState("");
  const [preferredLastName, setPreferredLastName] = useState("");
  const [emailConfirmed, setEmailConfirmed] = useState(false);
  const [managerEmployeeId, setManagerEmployeeId] = useState<string | null>(
    linkedEmployeeId ? linkedEmployeeId.toString() : null,
  );
  const [title, setTitle] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [employmentStatus, setEmploymentStatus] =
    useState<EmployeeStatus>("Permanent");
  const [statusChanged, setStatusChanged] = useState(false);
  const [jobFamilyId, setJobFamilyId] = useState("");
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [isDepartmentDialogOpen, setIsDepartmentDialogOpen] = useState(false);
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);
  const [pendingDepartment, setPendingDepartment] = useState<PendingDepartment | null>(null);
  const [pendingLocation, setPendingLocation] = useState<PendingLocation | null>(null);

  // ── Section 2: Compliance ────────────────────────────────────────────────────
  const [letterOfOfferSigned, setLetterOfOfferSigned] = useState(false);
  const [employmentFormsRequired, setEmploymentFormsRequired] = useState(true);
  const [policeCheckRequired, setPoliceCheckRequired] = useState(true);
  const [marketingInductionRequired, setMarketingInductionRequired] =
    useState(false);
  const [medicalStandardId, setMedicalStandardId] = useState("");
  const [willReceiveVehicle, setWillReceiveVehicle] = useState(false);
  const [willDriveVehicle, setWillDriveVehicle] = useState(false);

  // ── Section 3: Programs ──────────────────────────────────────────────────────
  const [programChecked, setProgramChecked] = useState<Record<number, boolean>>({});
  const [programRefEmployee, setProgramRefEmployee] = useState<
    Record<number, string | null>
  >({});

  // ── Section 4: Hardware ───────────────────────��──────────────────────────────
  const [hardwareChecked, setHardwareChecked] = useState<Record<number, boolean>>({});
  const [hardwareNonStandard, setHardwareNonStandard] = useState<
    Record<number, boolean>
  >({});
  const [hardwareJustification, setHardwareJustification] = useState<
    Record<number, string>
  >({});

  // ── Section 5: Notes ───��─────────────────────────────────────────────────────
  const [itNotes, setItNotes] = useState("");
  const [hrNotes, setHrNotes] = useState("");
  const [payrollNotes, setPayrollNotes] = useState("");

  // ── Submission ─────────────────────────────��─────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<number | null>(null);

  // ── Computed values ──────────────────────────────────────────────────────────
  const isInternal = INTERNAL_STATUSES.includes(employmentStatus);

  const emailFirstName =
    !preferredSameAsLegal && preferredFirstName ? preferredFirstName : legalFirstName;
  const emailLastName =
    !preferredSameAsLegal && preferredLastName ? preferredLastName : legalLastName;
  const computedEmail =
    emailFirstName && emailLastName
      ? `${emailFirstName.toLowerCase()}.${emailLastName.toLowerCase()}@${companyDetails.domain_extension}`
      : "";

  // Known hardware items (by name from catalogue seeds)
  const laptopItem = hardwareItems.find((h) => h.name === "Laptop");
  const nonStdLaptopItem = hardwareItems.find((h) => h.name === "Non-standard laptop");
  const iPadItem = hardwareItems.find((h) => h.name === "iPad");
  const phoneItem = hardwareItems.find((h) => h.name === "Phone");
  const nonStdPhoneItem = hardwareItems.find((h) => h.name === "Non-standard phone");

  // Known programs (by name from catalogue seeds)
  const e3LicenceProgram = programs.find(
    (p) => p.name === "Full Microsoft E3 licence",
  );

  // ── Load reference data ──���───────────────────────────────────────────────────
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [depts, locs, jfs, meds, progs, hw, emps] = await Promise.all([
          api.get<Department[]>("/api/departments?activeOnly=true"),
          api.get<Location[]>("/api/locations?activeOnly=true"),
          api.get<JobFamily[]>("/api/job-families?activeOnly=true"),
          api.get<MedicalStandard[]>("/api/medical-standards?activeOnly=true"),
          api.get<Program[]>("/api/programs?activeOnly=true"),
          api.get<HardwareItem[]>("/api/hardware?activeOnly=true"),
          api.get<Employee[]>("/api/employees?activeOnly=true"),
        ]);
        setDepartments(depts.data);
        setLocations(locs.data);
        setJobFamilies(jfs.data);
        setMedicalStandards(meds.data);
        setPrograms(progs.data);
        setHardwareItems(hw.data);
        setEmployees(emps.data);
      } catch (err) {
        console.error("Error fetching form data:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAll();
  }, []);

  // ── Employment status → compliance prefills ──────────────────────────────────
  useEffect(() => {
    const internal =
      employmentStatus === "Permanent" || employmentStatus === "PartTimePermanent";
    setEmploymentFormsRequired(internal);
    setPoliceCheckRequired(internal);
  }, [employmentStatus]);

  // ── Job family → hardware/program/compliance prefills ────────────────────────
  useEffect(() => {
    if (programs.length === 0 || hardwareItems.length === 0) return;

    const jfIdNum = jobFamilyId ? parseInt(jobFamilyId) : null;
    const selectedJF = jfIdNum !== null ? jobFamilies.find((jf) => jf.id === jfIdNum) : null;

    const hw: Record<number, boolean> = {};

    // Laptop: default true, overridden by job family if set
    if (laptopItem) {
      hw[laptopItem.id] =
        selectedJF?.prefillLaptop !== null && selectedJF?.prefillLaptop !== undefined
          ? selectedJF.prefillLaptop
          : true;
    }

    // iPad: default false, overridden by job family if set
    if (iPadItem) {
      hw[iPadItem.id] =
        selectedJF?.prefillIpad !== null && selectedJF?.prefillIpad !== undefined
          ? selectedJF.prefillIpad
          : false;
    }

    setHardwareChecked((prev) => ({ ...prev, ...hw }));

    // Non-standard laptop: default false, overridden by job family if set
    if (nonStdLaptopItem) {
      setHardwareNonStandard((prev) => ({
        ...prev,
        [nonStdLaptopItem.id]:
          selectedJF?.prefillNonStandardLaptop !== null &&
          selectedJF?.prefillNonStandardLaptop !== undefined
            ? selectedJF.prefillNonStandardLaptop
            : false,
      }));
    }

    // E3 licence: default true, overridden by job family if set
    if (e3LicenceProgram) {
      setProgramChecked((prev) => ({
        ...prev,
        [e3LicenceProgram.id]:
          selectedJF?.prefillE3Licence !== null && selectedJF?.prefillE3Licence !== undefined
            ? selectedJF.prefillE3Licence
            : true,
      }));
    }

    // Marketing induction: default false, overridden by job family if set
    setMarketingInductionRequired(
      selectedJF?.prefillMarketingInduction !== null &&
        selectedJF?.prefillMarketingInduction !== undefined
        ? selectedJF.prefillMarketingInduction
        : false,
    );
  }, [
    jobFamilyId,
    jobFamilies,
    programs,
    hardwareItems,
    laptopItem,
    iPadItem,
    nonStdLaptopItem,
    e3LicenceProgram,
  ]);

  // ── Vehicle interdependency ────────��──────────────────────────────────────────
  const handleReceiveVehicle = (checked: boolean) => {
    setWillReceiveVehicle(checked);
    if (checked) setWillDriveVehicle(true);
  };

  // ── Hardware toggle (cascades to non-standard child) ─���───────────────────────
  const handleHardwareToggle = (id: number, checked: boolean) => {
    setHardwareChecked((prev) => ({ ...prev, [id]: checked }));
    if (!checked) {
      if (laptopItem && id === laptopItem.id && nonStdLaptopItem) {
        setHardwareNonStandard((prev) => ({
          ...prev,
          [nonStdLaptopItem.id]: false,
        }));
        setHardwareJustification((prev) => ({
          ...prev,
          [nonStdLaptopItem.id]: "",
        }));
      }
      if (phoneItem && id === phoneItem.id && nonStdPhoneItem) {
        setHardwareNonStandard((prev) => ({
          ...prev,
          [nonStdPhoneItem.id]: false,
        }));
        setHardwareJustification((prev) => ({
          ...prev,
          [nonStdPhoneItem.id]: "",
        }));
      }
    }
  };

  // ── Program toggle (best-effort reference user prefill) ───────────────────────
  const handleProgramToggle = (program: Program, checked: boolean) => {
    setProgramChecked((prev) => ({ ...prev, [program.id]: checked }));
    if (checked && program.requiresReferenceUser) {
      const match = employees.find(
        (e) => e.title.toLowerCase() === title.toLowerCase(),
      );
      if (match) {
        setProgramRefEmployee((prev) => ({
          ...prev,
          [program.id]: match.id.toString(),
        }));
      }
    }
    if (!checked) {
      setProgramRefEmployee((prev) => ({ ...prev, [program.id]: null }));
    }
  };

  // ── Validation ─────���──────────────────────────────────────────────────────────
  const validate = (): string | null => {
    if (!legalFirstName.trim()) return "Legal first name is required.";
    if (!legalLastName.trim()) return "Legal last name is required.";
    if (!preferredSameAsLegal) {
      if (!preferredFirstName.trim()) return "Preferred first name is required.";
      if (!preferredLastName.trim()) return "Preferred last name is required.";
    }
    if (!emailConfirmed) return "Please confirm the email address looks correct.";
    if (!title.trim()) return "Title is required.";
    if (!departmentId && !pendingDepartment) return "Department is required.";
    if (!locationId && !pendingLocation) return "Location is required.";
    if (!startDate) return "Start date is required.";

    for (const prog of programs) {
      if (programChecked[prog.id] && prog.requiresReferenceUser) {
        if (!programRefEmployee[prog.id]) {
          return `A reference user is required for ${prog.name}.`;
        }
      }
    }

    if (nonStdLaptopItem && hardwareNonStandard[nonStdLaptopItem.id]) {
      if (!(hardwareJustification[nonStdLaptopItem.id] ?? "").trim()) {
        return "A justification is required for the non-standard laptop.";
      }
    }
    if (nonStdPhoneItem && hardwareNonStandard[nonStdPhoneItem.id]) {
      if (!(hardwareJustification[nonStdPhoneItem.id] ?? "").trim()) {
        return "A justification is required for the non-standard phone.";
      }
    }

    return null;
  };

  // ── Submit ────────���───────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const error = validate();
    if (error) {
      setSubmitError(error);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const payload: OnboardingPayload = {
      programs: programs
        .filter((p) => programChecked[p.id])
        .map((p) => ({
          programId: p.id,
          referenceUserEmployeeId: programRefEmployee[p.id]
            ? parseInt(programRefEmployee[p.id]!)
            : null,
        })),
      hardware: hardwareItems
        .filter((h) => hardwareChecked[h.id])
        .map((h) => ({
          hardwareItemId: h.id,
          nonStandard: hardwareNonStandard[h.id] ?? false,
          justification: hardwareJustification[h.id] || null,
        })),
      compliance: {
        letterOfOfferSigned,
        employmentFormsRequired,
        policeCheckRequired,
        marketingInductionRequired,
        willReceiveVehicle,
        willDriveVehicle,
      },
      notes: {
        it: itNotes.trim() || null,
        hr: hrNotes.trim() || null,
        payroll: payrollNotes.trim() || null,
      },
    };

    const data: CreateOnboardingData = {
      legalFirstName: legalFirstName.trim(),
      legalLastName: legalLastName.trim(),
      preferredFirstName: preferredSameAsLegal
        ? null
        : preferredFirstName.trim() || null,
      preferredLastName: preferredSameAsLegal
        ? null
        : preferredLastName.trim() || null,
      title: title.trim(),
      departmentId: pendingDepartment ? null : (departmentId ? parseInt(departmentId) : null),
      locationId: pendingLocation ? null : (locationId ? parseInt(locationId) : null),
      pendingDepartmentRequestId: pendingDepartment?.orgRequestId ?? null,
      pendingLocationRequestId: pendingLocation?.orgRequestId ?? null,
      employmentStatus,
      startDate: startDate.toISOString(),
      managerEmployeeId: managerEmployeeId ? parseInt(managerEmployeeId) : null,
      jobFamilyId: jobFamilyId ? parseInt(jobFamilyId) : null,
      medicalStandardId: medicalStandardId ? parseInt(medicalStandardId) : null,
      emailConfirmed,
      payload,
    };

    try {
      const res = await api.post<{ id: number }>("/api/onboarding", data);
      setSubmittedId(res.data.id);
    } catch (err) {
      const message =
        err instanceof AxiosError
          ? err.response?.data?.error ?? "Submission failed."
          : "Submission failed.";
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Success screen ──��─────────────────────────────────────────────────────────
  if (submittedId !== null) {
    return (
      <div className="pt-6 max-w-2xl mx-auto">
        <Card>
          <CardContent className="pt-6 space-y-4 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
            <div>
              <h2 className="text-xl font-semibold">
                Onboarding request submitted
              </h2>
              <p className="text-muted-foreground mt-1">
                Request #{submittedId} is pending Admin review.
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              The admin team will review the details and create the employee
              record on approval.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Button variant="outline" onClick={() => window.location.reload()}>
                Submit another request
              </Button>
              <Button asChild variant="outline">
                <a href="/forms">Back to Forms</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Loading skeleton ──────────────────────────────────────���───────────────────
  if (isLoading) {
    return (
      <div className="pt-6 space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // ── Form ──────���──────────────────────────────��────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-6 pt-6">
      {/* ── Section 1: Employee Details ───────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Employee Details</CardTitle>
          <CardDescription>Core HR information for the new hire.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Legal names */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="legalFirstName">Legal first name *</Label>
              <Input
                id="legalFirstName"
                value={legalFirstName}
                onChange={(e) => setLegalFirstName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="legalLastName">Legal last name *</Label>
              <Input
                id="legalLastName"
                value={legalLastName}
                onChange={(e) => setLegalLastName(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Preferred name toggle */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="preferredSameAsLegal"
              checked={preferredSameAsLegal}
              onCheckedChange={(checked) => {
                setPreferredSameAsLegal(!!checked);
                if (checked) {
                  setPreferredFirstName("");
                  setPreferredLastName("");
                }
              }}
            />
            <Label htmlFor="preferredSameAsLegal" className="cursor-pointer">
              Preferred name is the same as legal name
            </Label>
          </div>

          {/* Preferred names (conditional) */}
          {!preferredSameAsLegal && (
            <>
              <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800">
                  There is an extra step in the Workday process to change to the
                  preferred name; we&apos;ll include this in the email.
                </AlertDescription>
              </Alert>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="preferredFirstName">
                    Preferred first name *
                  </Label>
                  <Input
                    id="preferredFirstName"
                    value={preferredFirstName}
                    onChange={(e) => setPreferredFirstName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="preferredLastName">
                    Preferred last name *
                  </Label>
                  <Input
                    id="preferredLastName"
                    value={preferredLastName}
                    onChange={(e) => setPreferredLastName(e.target.value)}
                    required
                  />
                </div>
              </div>
            </>
          )}

          {/* Email confirmation */}
          {computedEmail && (
            <div className="rounded-md border p-4 space-y-3 bg-muted/30">
              <p className="text-sm font-medium">Confirm email address</p>
              <p className="text-sm text-muted-foreground">
                Based on the name entered, the company email address will be:
              </p>
              <p className="text-sm font-mono font-semibold">{computedEmail}</p>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="emailConfirmed"
                  checked={emailConfirmed}
                  onCheckedChange={(c) => setEmailConfirmed(!!c)}
                />
                <Label htmlFor="emailConfirmed" className="cursor-pointer text-sm">
                  This email address looks correct
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                This does not create or reserve the mailbox — it is created
                separately outside HRT.
              </p>
            </div>
          )}

          {/* Manager */}
          <div className="space-y-2">
            <Label>Manager</Label>
            <EmployeeCombobox
              employees={employees}
              selectedEmployeeId={managerEmployeeId}
              onSelect={setManagerEmployeeId}
              placeholder="Search for manager..."
            />
            <p className="text-xs text-muted-foreground">
              Pre-filled as your linked employee. Change if submitting on behalf
              of another manager.
            </p>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* Department */}
          <div className="space-y-2">
            <Label>Department *</Label>
            <div className="flex gap-2">
              {pendingDepartment ? (
                <div className="flex-1 flex items-center gap-2 h-9 rounded-md border border-input bg-background px-3 text-sm">
                  <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  <span className="flex-1 truncate">{pendingDepartment.name}</span>
                  <span className="text-xs text-amber-600 bg-amber-100 rounded px-1.5 py-0.5 shrink-0">Pending</span>
                  <button
                    type="button"
                    className="ml-1 text-muted-foreground hover:text-foreground"
                    onClick={() => { setPendingDepartment(null); setDepartmentId(""); }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : departmentId ? (
                <div className="flex-1 flex items-center gap-2 h-9 rounded-md border border-input bg-background px-3 text-sm">
                  <span className="flex-1 truncate">
                    {departments.find((d) => d.id.toString() === departmentId)?.name ?? departmentId}
                  </span>
                  <button
                    type="button"
                    className="ml-1 text-muted-foreground hover:text-foreground"
                    onClick={() => setDepartmentId("")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <Select
                  value={departmentId}
                  onValueChange={(v) => { setDepartmentId(v); setPendingDepartment(null); }}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.filter((d) => d.id > 0).map((d) => (
                      <SelectItem key={d.id} value={d.id.toString()}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => setIsDepartmentDialogOpen(true)}
                title={userRole === "Admin" ? "Add new department" : "Request new department"}
                disabled={!!pendingDepartment}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label>Location *</Label>
            <div className="flex gap-2">
              {pendingLocation ? (
                <div className="flex-1 flex items-center gap-2 h-9 rounded-md border border-input bg-background px-3 text-sm">
                  <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  <span className="flex-1 truncate">{pendingLocation.name}, {pendingLocation.state}</span>
                  <span className="text-xs text-amber-600 bg-amber-100 rounded px-1.5 py-0.5 shrink-0">Pending</span>
                  <button
                    type="button"
                    className="ml-1 text-muted-foreground hover:text-foreground"
                    onClick={() => { setPendingLocation(null); setLocationId(""); }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : locationId ? (
                <div className="flex-1 flex items-center gap-2 h-9 rounded-md border border-input bg-background px-3 text-sm">
                  <span className="flex-1 truncate">
                    {(() => { const l = locations.find((l) => l.id.toString() === locationId); return l ? `${l.name}, ${l.state}` : locationId; })()}
                  </span>
                  <button
                    type="button"
                    className="ml-1 text-muted-foreground hover:text-foreground"
                    onClick={() => setLocationId("")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <Select
                  value={locationId}
                  onValueChange={(v) => { setLocationId(v); setPendingLocation(null); }}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.filter((l) => l.id > 0).map((l) => (
                      <SelectItem key={l.id} value={l.id.toString()}>
                        {l.name}, {l.state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => setIsLocationDialogOpen(true)}
                title={userRole === "Admin" ? "Add new location" : "Request new location"}
                disabled={!!pendingLocation}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Employment status */}
          <div className="space-y-2">
            <Label>Employment status *</Label>
            <Select
              value={employmentStatus}
              onValueChange={(v) => {
                setEmploymentStatus(v as EmployeeStatus);
                setStatusChanged(true);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_LABELS) as EmployeeStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {statusChanged && (
              <Alert
                className={
                  isInternal
                    ? "border-blue-200 bg-blue-50 text-blue-900"
                    : "border-amber-200 bg-amber-50 text-amber-900"
                }
              >
                <AlertTriangle
                  className={`h-4 w-4 ${isInternal ? "text-blue-600" : "text-amber-600"}`}
                />
                <AlertTitle>
                  {STATUS_LABELS[employmentStatus]} —{" "}
                  {isInternal ? "Internal" : "External"}
                </AlertTitle>
                <AlertDescription>
                  They {isInternal ? "are" : "are not"} paid by KSB. This is
                  important so your requests go to the right place.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Job Family */}
          <div className="space-y-2">
            <Label>Job Family</Label>
            <Select
              value={jobFamilyId || "__none__"}
              onValueChange={(v) => setJobFamilyId(v === "__none__" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select job family (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— None —</SelectItem>
                {jobFamilies.map((jf) => (
                  <SelectItem key={jf.id} value={jf.id.toString()}>
                    {jf.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Selecting a job family pre-fills relevant hardware and software
              fields below.
            </p>
          </div>

          {/* Start Date */}
          <div className="space-y-2">
            <Label>Start date *</Label>
            <DateSelector
              selectedDate={startDate}
              onDateSelect={setStartDate}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Section 2: Forms & Compliance ────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Forms &amp; Compliance</CardTitle>
          <CardDescription>
            Pre-employment forms and compliance requirements.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CheckboxRow
            id="letterOfOfferSigned"
            checked={letterOfOfferSigned}
            onCheckedChange={setLetterOfOfferSigned}
            label="Letter of offer signed"
            description="Has the letter of offer been signed and emailed to HR?"
          />
          <CheckboxRow
            id="employmentFormsRequired"
            checked={employmentFormsRequired}
            onCheckedChange={setEmploymentFormsRequired}
            label="Employment forms required"
            description={isInternal ? "Pre-filled: Internal employees require employment forms." : "Pre-filled: External employees do not typically require employment forms."}
          />
          <CheckboxRow
            id="policeCheckRequired"
            checked={policeCheckRequired}
            onCheckedChange={setPoliceCheckRequired}
            label="Police check required"
            description={isInternal ? "Pre-filled: Internal employees require a police check." : "Pre-filled: External employees do not typically require a police check."}
          />
          <CheckboxRow
            id="marketingInductionRequired"
            checked={marketingInductionRequired}
            onCheckedChange={setMarketingInductionRequired}
            label="Marketing induction required"
            description="Pre-filled based on job family."
          />

          <div className="space-y-2">
            <Label>Pre-employment medical level</Label>
            <Select
              value={medicalStandardId || "__none__"}
              onValueChange={(v) =>
                setMedicalStandardId(v === "__none__" ? "" : v)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select medical level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— None —</SelectItem>
                {medicalStandards.map((m) => (
                  <SelectItem key={m.id} value={m.id.toString()}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <CheckboxRow
            id="willReceiveVehicle"
            checked={willReceiveVehicle}
            onCheckedChange={handleReceiveVehicle}
            label="Will receive a KSB vehicle"
          />
          <CheckboxRow
            id="willDriveVehicle"
            checked={willDriveVehicle}
            onCheckedChange={setWillDriveVehicle}
            label="Will be required to drive a KSB vehicle"
            description='Auto-checked when "Will receive a KSB vehicle" is checked.'
          />
        </CardContent>
      </Card>

      {/* ── Section 3: Software Access ────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Software Access</CardTitle>
          <CardDescription>
            Select the programs and licences this employee will need.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {programs.map((prog) => (
            <div key={prog.id} className="space-y-2">
              <CheckboxRow
                id={`prog-${prog.id}`}
                checked={programChecked[prog.id] ?? false}
                onCheckedChange={(checked) =>
                  handleProgramToggle(prog, checked)
                }
                label={prog.name}
              />
              {programChecked[prog.id] && prog.requiresReferenceUser && (
                <div className="ml-6 space-y-1">
                  <Label className="text-sm">Reference user *</Label>
                  <EmployeeCombobox
                    employees={employees}
                    selectedEmployeeId={programRefEmployee[prog.id] ?? null}
                    onSelect={(id) =>
                      setProgramRefEmployee((prev) => ({
                        ...prev,
                        [prog.id]: id,
                      }))
                    }
                    placeholder="Search for reference user..."
                  />
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── Section 4: Hardware ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Hardware</CardTitle>
          <CardDescription>
            Select the hardware items this employee will need.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Laptop */}
          {laptopItem && (
            <div className="space-y-2">
              <CheckboxRow
                id="hw-laptop"
                checked={hardwareChecked[laptopItem.id] ?? false}
                onCheckedChange={(c) => handleHardwareToggle(laptopItem.id, c)}
                label="Laptop"
              />
              {hardwareChecked[laptopItem.id] && nonStdLaptopItem && (
                <div className="ml-6 space-y-2">
                  <CheckboxRow
                    id="hw-nonStdLaptop"
                    checked={hardwareNonStandard[nonStdLaptopItem.id] ?? false}
                    onCheckedChange={(c) =>
                      setHardwareNonStandard((prev) => ({
                        ...prev,
                        [nonStdLaptopItem.id]: c,
                      }))
                    }
                    label="Non-standard laptop"
                    description="Pre-filled based on job family."
                  />
                  {hardwareNonStandard[nonStdLaptopItem.id] && (
                    <div className="ml-6 space-y-2">
                      <Label htmlFor="justif-nslaptop" className="text-sm">
                        Justification *
                      </Label>
                      <Textarea
                        id="justif-nslaptop"
                        rows={2}
                        value={hardwareJustification[nonStdLaptopItem.id] ?? ""}
                        onChange={(e) =>
                          setHardwareJustification((prev) => ({
                            ...prev,
                            [nonStdLaptopItem.id]: e.target.value,
                          }))
                        }
                        placeholder="Reason for non-standard laptop..."
                        required
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* iPad */}
          {iPadItem && (
            <CheckboxRow
              id="hw-ipad"
              checked={hardwareChecked[iPadItem.id] ?? false}
              onCheckedChange={(c) => handleHardwareToggle(iPadItem.id, c)}
              label="iPad"
            />
          )}

          {/* Phone */}
          {phoneItem && (
            <div className="space-y-2">
              <CheckboxRow
                id="hw-phone"
                checked={hardwareChecked[phoneItem.id] ?? false}
                onCheckedChange={(c) => handleHardwareToggle(phoneItem.id, c)}
                label="Phone"
              />
              {hardwareChecked[phoneItem.id] && nonStdPhoneItem && (
                <div className="ml-6 space-y-2">
                  <CheckboxRow
                    id="hw-nonStdPhone"
                    checked={hardwareNonStandard[nonStdPhoneItem.id] ?? false}
                    onCheckedChange={(c) =>
                      setHardwareNonStandard((prev) => ({
                        ...prev,
                        [nonStdPhoneItem.id]: c,
                      }))
                    }
                    label="Non-standard phone"
                  />
                  {hardwareNonStandard[nonStdPhoneItem.id] && (
                    <div className="ml-6 space-y-2">
                      <Label htmlFor="justif-nsphone" className="text-sm">
                        Justification *
                      </Label>
                      <Textarea
                        id="justif-nsphone"
                        rows={2}
                        value={hardwareJustification[nonStdPhoneItem.id] ?? ""}
                        onChange={(e) =>
                          setHardwareJustification((prev) => ({
                            ...prev,
                            [nonStdPhoneItem.id]: e.target.value,
                          }))
                        }
                        placeholder="Reason for non-standard phone..."
                        required
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Any other hardware items not covered by the above */}
          {hardwareItems
            .filter(
              (h) =>
                h.id !== laptopItem?.id &&
                h.id !== nonStdLaptopItem?.id &&
                h.id !== iPadItem?.id &&
                h.id !== phoneItem?.id &&
                h.id !== nonStdPhoneItem?.id,
            )
            .map((h) => (
              <CheckboxRow
                key={h.id}
                id={`hw-${h.id}`}
                checked={hardwareChecked[h.id] ?? false}
                onCheckedChange={(c) => handleHardwareToggle(h.id, c)}
                label={h.name}
              />
            ))}
        </CardContent>
      </Card>

      {/* ── Section 5: Department Notes ───────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Department Notes</CardTitle>
          <CardDescription>
            Optional notes included in emails to each department.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="itNotes">Note to IT</Label>
            <Textarea
              id="itNotes"
              rows={2}
              value={itNotes}
              onChange={(e) => setItNotes(e.target.value)}
              placeholder="Any specific instructions for IT..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hrNotes">Note to HR</Label>
            <Textarea
              id="hrNotes"
              rows={2}
              value={hrNotes}
              onChange={(e) => setHrNotes(e.target.value)}
              placeholder="Any specific instructions for HR..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payrollNotes">Note to Payroll</Label>
            <Textarea
              id="payrollNotes"
              rows={2}
              value={payrollNotes}
              onChange={(e) => setPayrollNotes(e.target.value)}
              placeholder="Any specific instructions for Payroll..."
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Error + Submit ────────────────────────────────────────────────────── */}
      {submitError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Cannot submit</AlertTitle>
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Submitting..." : "Submit Onboarding Request"}
      </Button>

      {/* Dialogs */}
      <AddDepartmentDialog
        open={isDepartmentDialogOpen}
        onOpenChange={setIsDepartmentDialogOpen}
        departments={departments}
        userRole={userRole}
        onDepartmentAdded={(dept) => {
          setDepartments((prev) => [...prev, dept]);
          setDepartmentId(dept.id.toString());
        }}
        onDepartmentRequested={(pending) => {
          setPendingDepartment(pending);
          setDepartmentId("");
        }}
      />
      <AddLocationDialog
        open={isLocationDialogOpen}
        onOpenChange={setIsLocationDialogOpen}
        userRole={userRole}
        onLocationAdded={(loc) => {
          setLocations((prev) => [...prev, loc]);
          setLocationId(loc.id.toString());
        }}
        onLocationRequested={(pending) => {
          setPendingLocation(pending);
          setLocationId("");
        }}
      />
    </form>
  );
}

// ── Small helper ──────────────────────────────────────────────────────────────

function CheckboxRow({
  id,
  checked,
  onCheckedChange,
  label,
  description,
}: {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(c) => onCheckedChange(!!c)}
        />
        <Label htmlFor={id} className="cursor-pointer">
          {label}
        </Label>
      </div>
      {description && (
        <p className="ml-6 text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
