"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "usehooks-ts";
import api from "@/lib/axios";
import { AxiosError } from "axios";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  AlertTriangle,
  User,
  Calendar,
  MapPin,
  Building,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { format } from "date-fns";
import { EmployeeFormData, EmployeeWithRelations } from "@/lib/types";
import {
  Department,
  JobFamily,
  Location,
} from "@/generated/prisma_client/client";
import { DateSelector } from "@/components/date-selector";

interface DuplicateResponse {
  error: string;
  code: string;
  matches: EmployeeWithRelations[];
  suggestions: {
    rehire: boolean;
    duplicate: boolean;
  };
}

interface DuplicateEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicateData: DuplicateResponse;
  employeeFormData: EmployeeFormData;
  departments: Department[];
  locations: Location[];
  jobFamilies: JobFamily[];
  onSuccess: () => void;
}

interface DuplicateFormProps extends Omit<
  DuplicateEmployeeDialogProps,
  "open" | "onOpenChange"
> {
  onClose: () => void;
  className?: string;
}

type FieldDecision = "keep" | "clear";

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || String(value).trim() === "";
}

// Optional fields that reconcile with keep/clear semantics when the typed value
// is blank but the prior record had one (§4).
const OPTIONAL_FIELD_KEYS = [
  "jobFamilyId",
  "usi",
  "notes",
  "preferredFirstName",
  "preferredLastName",
] as const;
type OptionalFieldKey = (typeof OPTIONAL_FIELD_KEYS)[number];

function DuplicateForm({
  duplicateData,
  employeeFormData,
  departments,
  locations,
  jobFamilies,
  onSuccess,
  onClose,
  className,
}: DuplicateFormProps) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(
    null,
  );
  const [isReviewing, setIsReviewing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { matches, suggestions } = duplicateData;

  const selectedMatch = useMemo(
    () => matches.find((m) => m.id === selectedEmployeeId) ?? null,
    [matches, selectedEmployeeId],
  );

  const priorNeedsFinishDate = selectedMatch
    ? selectedMatch.finishDate == null
    : false;

  // Rehire start defaults to the date entered on the add form, else today.
  const [rehireStart, setRehireStart] = useState<Date>(
    employeeFormData.startDate
      ? new Date(employeeFormData.startDate)
      : new Date(),
  );
  const [priorFinish, setPriorFinish] = useState<Date>(new Date());

  // keep/clear decision per optional field; defaults to "keep" (non-destructive).
  const [decisions, setDecisions] = useState<
    Record<OptionalFieldKey, FieldDecision>
  >({
    jobFamilyId: "keep",
    usi: "keep",
    notes: "keep",
    preferredFirstName: "keep",
    preferredLastName: "keep",
  });

  const deptName = (id: number | null | undefined) =>
    departments.find((d) => d.id === id)?.name ?? "—";
  const locName = (id: number | null | undefined) => {
    const loc = locations.find((l) => l.id === id);
    return loc ? `${loc.name}, ${loc.state}` : "—";
  };
  const jobFamilyName = (id: number | null | undefined) =>
    jobFamilies.find((j) => j.id === id)?.name ?? "—";

  const optionalTypedValue = (key: OptionalFieldKey): unknown =>
    employeeFormData[key as keyof EmployeeFormData];

  const resolveOptional = (key: OptionalFieldKey, prior: EmployeeWithRelations) => {
    const typed = optionalTypedValue(key);
    if (!isBlank(typed)) return typed;
    const priorVal = prior[key as keyof EmployeeWithRelations];
    if (isBlank(priorVal)) return null;
    return decisions[key] === "clear" ? null : priorVal;
  };

  const handleReview = () => {
    if (!selectedMatch) return;
    setError(null);
    setIsReviewing(true);
  };

  const handleConfirmRehire = async () => {
    if (!selectedMatch) return;
    setIsLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        startDate: rehireStart.toISOString(),
        title: employeeFormData.title,
        departmentId: employeeFormData.departmentId,
        locationId: employeeFormData.locationId,
        status: employeeFormData.status,
      };
      if (priorNeedsFinishDate) {
        body.priorFinishDate = priorFinish.toISOString();
      }
      for (const key of OPTIONAL_FIELD_KEYS) {
        body[key] = resolveOptional(key, selectedMatch);
      }

      await api.post(`/api/employees/${selectedMatch.id}/rehire`, body);

      onClose();
      onSuccess();
    } catch (err) {
      if (err instanceof AxiosError && err.response?.data?.error) {
        setError(err.response.data.error as string);
      } else {
        setError("Failed to rehire employee. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAnyway = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await api.post("/api/employees", {
        ...employeeFormData,
        confirmDuplicate: true,
      });
      onClose();
      onSuccess();
    } catch (err) {
      console.error("Error creating employee:", err);
      setError("Failed to create employee. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmployeeClick = (match: EmployeeWithRelations) => {
    if (!match.isActive) {
      setSelectedEmployeeId(match.id);
    }
  };

  // ─── Review & Rehire reconciliation panel ────────────────────────────────
  if (isReviewing && selectedMatch) {
    const requiredRows: { label: string; oldText: string; newText: string }[] = [
      {
        label: "Title",
        oldText: selectedMatch.title || "—",
        newText: employeeFormData.title || "—",
      },
      {
        label: "Department",
        oldText: deptName(selectedMatch.departmentId),
        newText: deptName(employeeFormData.departmentId),
      },
      {
        label: "Location",
        oldText: locName(selectedMatch.locationId),
        newText: locName(employeeFormData.locationId),
      },
      {
        label: "Status",
        oldText: String(selectedMatch.status ?? "—"),
        newText: String(employeeFormData.status ?? "—"),
      },
    ];

    const optionalConfig: {
      key: OptionalFieldKey;
      label: string;
      display: (v: unknown) => string;
    }[] = [
      {
        key: "jobFamilyId",
        label: "Job Family",
        display: (v) => (isBlank(v) ? "—" : jobFamilyName(v as number)),
      },
      { key: "usi", label: "USI", display: (v) => (isBlank(v) ? "—" : String(v)) },
      {
        key: "notes",
        label: "Notes",
        display: (v) => (isBlank(v) ? "—" : String(v)),
      },
      {
        key: "preferredFirstName",
        label: "Preferred First Name",
        display: (v) => (isBlank(v) ? "—" : String(v)),
      },
      {
        key: "preferredLastName",
        label: "Preferred Last Name",
        display: (v) => (isBlank(v) ? "—" : String(v)),
      },
    ];

    return (
      <div className={cn("space-y-5", className)}>
        <div>
          <h3 className="text-sm font-medium text-gray-900">
            Rehiring {selectedMatch.legalFirstName} {selectedMatch.legalLastName}
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            The prior employment stint will be archived. Review each field before
            confirming.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="rehireStart">Rehire Start Date *</Label>
            <DateSelector selectedDate={rehireStart} onDateSelect={setRehireStart} />
          </div>
          {priorNeedsFinishDate && (
            <div className="space-y-2">
              <Label htmlFor="priorFinish">Prior Finish Date *</Label>
              <DateSelector
                selectedDate={priorFinish}
                onDateSelect={setPriorFinish}
              />
              <p className="text-xs text-gray-500">
                This record has no finish date. Set when the prior stint ended.
              </p>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Field changes
          </h4>

          {requiredRows.map((row) => (
            <div
              key={row.label}
              className="flex flex-col gap-1 rounded-md border border-gray-200 p-3 text-sm md:flex-row md:items-center md:justify-between"
            >
              <span className="font-medium text-gray-700">{row.label}</span>
              <span className="flex items-center gap-2 text-gray-600">
                <span className="text-gray-500">{row.oldText}</span>
                <ArrowRight className="h-3 w-3 text-gray-400" />
                <span className="font-medium text-gray-900">{row.newText}</span>
              </span>
            </div>
          ))}

          {optionalConfig.map((cfg) => {
            const typed = optionalTypedValue(cfg.key);
            const priorVal = selectedMatch[cfg.key as keyof EmployeeWithRelations];
            const typedPresent = !isBlank(typed);
            const priorPresent = !isBlank(priorVal);
            const showKeepClear = !typedPresent && priorPresent;
            const resolved = resolveOptional(cfg.key, selectedMatch);

            return (
              <div
                key={cfg.key}
                className="flex flex-col gap-2 rounded-md border border-gray-200 p-3 text-sm"
              >
                <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                  <span className="font-medium text-gray-700">{cfg.label}</span>
                  <span className="flex items-center gap-2 text-gray-600">
                    <span className="text-gray-500">{cfg.display(priorVal)}</span>
                    <ArrowRight className="h-3 w-3 text-gray-400" />
                    <span className="font-medium text-gray-900">
                      {cfg.display(resolved)}
                    </span>
                  </span>
                </div>
                {showKeepClear && (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={decisions[cfg.key] === "keep" ? "default" : "outline"}
                      onClick={() =>
                        setDecisions((d) => ({ ...d, [cfg.key]: "keep" }))
                      }
                    >
                      Keep
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={decisions[cfg.key] === "clear" ? "destructive" : "outline"}
                      onClick={() =>
                        setDecisions((d) => ({ ...d, [cfg.key]: "clear" }))
                      }
                    >
                      Clear
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="pt-4 border-t">
          <div className="flex flex-col space-y-2 w-full md:flex-row-reverse md:gap-2 md:space-y-0 md:justify-start">
            <Button
              onClick={handleConfirmRehire}
              disabled={isLoading}
              className="bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50"
            >
              {isLoading ? "Rehiring..." : "Confirm Rehire"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setIsReviewing(false);
                setError(null);
              }}
              disabled={isLoading}
            >
              Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Match list ───────────────────────────────────────────────────────────
  return (
    <div className={cn("space-y-4", className)}>
      <h3 className="text-sm font-medium text-gray-900 mb-3">
        Existing Employees:
      </h3>

      {matches.map((match) => {
        const isSelected = selectedEmployeeId === match.id;
        const isSelectable = !match.isActive;
        const isRecommended = suggestions.rehire && !match.isActive;

        return (
          <div
            key={match.id}
            className={`
              relative p-5 border-2 rounded-xl transition-all duration-200
              ${
                isSelected
                  ? "border-blue-500 bg-blue-50 shadow-md"
                  : isSelectable
                    ? "border-gray-200 hover:border-gray-300 hover:shadow-sm bg-white"
                    : "border-gray-100 bg-gray-50"
              }
              ${isRecommended ? "ring-2 ring-amber-200" : ""}
              ${isSelectable ? "cursor-pointer" : "cursor-default"}
            `}
            onClick={() => handleEmployeeClick(match)}
          >
            {isSelected && (
              <div className="absolute top-3 right-3">
                <CheckCircle2 className="h-5 w-5 text-blue-600" />
              </div>
            )}

            {isRecommended && !isSelected && (
              <div className="absolute top-3 right-3">
                <Badge className="bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-100">
                  Recommended for Rehire
                </Badge>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                    <User className="h-4 w-4 text-gray-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 text-lg">
                      {match.legalFirstName} {match.legalLastName}
                    </h4>
                    <p className="text-sm text-gray-600">{match.title}</p>
                  </div>
                </div>

                <Badge
                  variant={match.isActive ? "default" : "secondary"}
                  className={`
                    ${
                      match.isActive
                        ? "bg-green-100 text-green-800 border-green-300"
                        : "bg-gray-100 text-gray-700 border-gray-300"
                    }
                  `}
                >
                  {match.isActive ? "Currently Active" : "Inactive"}
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-gray-700">
                  <Building className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span className="font-medium">Department:</span>
                  <span className="text-gray-600">
                    {match.department?.name || "Not specified"}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-gray-700">
                  <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span className="font-medium">Location:</span>
                  <span className="text-gray-600">
                    {match.location?.name || "Not specified"}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-gray-700">
                  <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span className="font-medium">Title:</span>
                  <span className="text-gray-600">{match.title}</span>
                </div>

                {match.startDate && (
                  <div className="flex items-center gap-2 text-gray-700 md:col-span-2">
                    <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <span className="font-medium">Employment:</span>
                    <span className="text-gray-600">
                      Started {format(new Date(match.startDate), "MMM d, yyyy")}
                      {match.finishDate && (
                        <span className="ml-2">
                          • Ended{" "}
                          {format(new Date(match.finishDate), "MMM d, yyyy")}
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>

              {isSelectable && !isSelected && (
                <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded-md border border-dashed border-gray-200">
                  Click to select this employee for rehire
                </div>
              )}

              {match.isActive && (
                <div className="text-xs text-gray-600 bg-gray-100 p-2 rounded-md">
                  This employee is currently active and cannot be selected for
                  rehire
                </div>
              )}
            </div>
          </div>
        );
      })}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="pt-4 border-t">
        <div className="flex flex-col space-y-2 w-full md:flex-row-reverse pb-2 md:gap-2 md:space-y-0 md:justify-start">
          {selectedMatch && !selectedMatch.isActive && (
            <Button
              onClick={handleReview}
              disabled={isLoading}
              className="bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50"
            >
              Review &amp; Rehire
            </Button>
          )}
          <Button
            onClick={handleCreateAnyway}
            disabled={isLoading}
            variant="destructive"
          >
            {isLoading ? "Creating..." : "Create Anyway (Different Person)"}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

export function DuplicateEmployeeDialog({
  open,
  onOpenChange,
  duplicateData,
  employeeFormData,
  departments,
  locations,
  jobFamilies,
  onSuccess,
}: DuplicateEmployeeDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const { matches } = duplicateData;

  const handleClose = () => onOpenChange(false);

  const title = "Potential Duplicate Employee Found";
  const description = `We found ${matches.length} existing employee${matches.length > 1 ? "s" : ""} with the same name. Please choose how you'd like to proceed below.`;

  const formProps = {
    duplicateData,
    employeeFormData,
    departments,
    locations,
    jobFamilies,
    onSuccess,
    onClose: handleClose,
  };

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="space-y-3">
            <DialogTitle className="flex items-center gap-3 text-xl">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              {title}
            </DialogTitle>
            <DialogDescription className="text-base leading-relaxed">
              {description}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <DuplicateForm {...formProps} />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="text-left space-y-2">
          <DrawerTitle className="flex items-center gap-3 text-xl">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            {title}
          </DrawerTitle>
          <DrawerDescription className="text-base leading-relaxed">
            {description}
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-4 overflow-y-auto">
          <DuplicateForm {...formProps} className="" />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
