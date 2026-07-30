"use client";

import { useState } from "react";
import { format } from "date-fns";
import { useMediaQuery } from "usehooks-ts";
import { AlertTriangle, Briefcase, Building, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { DateSelector } from "@/components/date-selector";
import {
  ComparisonRow,
  KeepClearControls,
  isBlank,
  resolveKeepClear,
  type FieldDecision,
} from "@/components/rehire/reconciliation";
import type { DuplicateMatchWire } from "@/lib/services/employeeDuplicateService";
import type { RehireOptionalFields } from "@/lib/services/onboardingService";

/**
 * The three optional fields that can be reconciled on the onboarding path.
 *
 * `usi` and `notes` are deliberately absent: `OnboardingRequest` has no such
 * columns, so there is nothing to reconcile them against. They are left exactly as
 * the prior record holds them (the service passes `undefined`, which Prisma reads
 * as "don't touch").
 */
const OPTIONAL_FIELD_KEYS = [
  "jobFamilyId",
  "preferredFirstName",
  "preferredLastName",
] as const;
type OptionalFieldKey = (typeof OPTIONAL_FIELD_KEYS)[number];

/** The typed (request-side) values the panel compares the prior record against. */
export interface RehireTypedValues {
  legalFirstName: string;
  legalLastName: string;
  title: string;
  departmentId: number | null;
  locationId: number | null;
  status: string;
  startDate: string;
  jobFamilyId: number | null;
  preferredFirstName: string | null;
  preferredLastName: string | null;
}

export interface RehireDecisionPayload {
  employeeId: number;
  priorFinishDate?: string;
  legalFirstName?: string;
  legalLastName?: string;
  optionalFields: RehireOptionalFields;
  /** Rehire start date, which travels in `edits`, not the decision (see service). */
  startDate: string;
}

interface LookupNames {
  departmentName: (id: number | null | undefined) => string;
  locationName: (id: number | null | undefined) => string;
  jobFamilyName: (id: number | null | undefined) => string;
}

/**
 * Match cards: departed records are selectable rehire targets, active ones are
 * shown but disabled — an active record is a genuine same-name colleague (or a
 * real duplicate), and neither is something to reactivate.
 */
export function RehireMatchList({
  matches,
  selectedId,
  onSelect,
  lookups,
  disabled,
}: {
  matches: DuplicateMatchWire[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  lookups: LookupNames;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      {matches.map((match) => {
        const isSelected = selectedId === match.id;
        const isSelectable = !match.isActive && !disabled;

        return (
          <button
            key={match.id}
            type="button"
            onClick={() => isSelectable && onSelect(match.id)}
            disabled={!isSelectable}
            aria-pressed={isSelected}
            className={`w-full rounded-md border p-3 text-left transition-colors ${
              isSelected
                ? "border-primary bg-primary/5"
                : isSelectable
                  ? "hover:bg-accent"
                  : "opacity-70"
            } ${isSelectable ? "cursor-pointer" : "cursor-not-allowed"}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">
                {match.legalFirstName} {match.legalLastName}
                <span className="text-muted-foreground font-normal">
                  {" "}
                  (#{match.id})
                </span>
              </span>
              <Badge variant={match.isActive ? "default" : "secondary"}>
                {match.isActive ? "Currently active" : "Departed"}
              </Badge>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-muted-foreground sm:grid-cols-2">
              <span className="flex items-center gap-1.5">
                <Briefcase className="h-3 w-3 shrink-0" />
                {match.title || "—"}
              </span>
              <span className="flex items-center gap-1.5">
                <Building className="h-3 w-3 shrink-0" />
                {lookups.departmentName(match.departmentId)} ·{" "}
                {lookups.locationName(match.locationId)}
              </span>
              <span className="flex items-center gap-1.5 sm:col-span-2">
                <Calendar className="h-3 w-3 shrink-0" />
                Started {format(new Date(match.startDate), "MMM d, yyyy")}
                {match.finishDate
                  ? ` · Left ${format(new Date(match.finishDate), "MMM d, yyyy")}`
                  : " · no finish date recorded"}
              </span>
            </div>
            {match.isActive && (
              <p className="mt-2 text-xs text-muted-foreground">
                Still active — cannot be rehired. If this is a different person,
                approve as a new employee.
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Reconciliation panel shown once the Admin picks a departed record. Responsive
 * per project convention: Dialog on desktop, Drawer on mobile.
 */
export function RehireReconciliationPanel({
  open,
  onOpenChange,
  match,
  typed,
  lookups,
  submitting,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  match: DuplicateMatchWire;
  typed: RehireTypedValues;
  lookups: LookupNames;
  submitting: boolean;
  error: string | null;
  onConfirm: (payload: RehireDecisionPayload) => void;
}) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const priorNeedsFinishDate = match.finishDate == null;

  const [rehireStart, setRehireStart] = useState<Date>(
    typed.startDate ? new Date(typed.startDate) : new Date(),
  );
  const [priorFinish, setPriorFinish] = useState<Date>(new Date());

  // Legal names default to keep-existing. Case-only differences are the normal
  // case now that matching is case-insensitive — that is *why* this record
  // matched — so keep-existing is right, and a material difference is highlighted
  // for the Admin to act on consciously.
  const [legalNameDecision, setLegalNameDecision] = useState<{
    legalFirstName: FieldDecision;
    legalLastName: FieldDecision;
  }>({ legalFirstName: "keep", legalLastName: "keep" });

  // keep/clear per optional field; defaults to keep (non-destructive).
  const [decisions, setDecisions] = useState<
    Record<OptionalFieldKey, FieldDecision>
  >({
    jobFamilyId: "keep",
    preferredFirstName: "keep",
    preferredLastName: "keep",
  });

  const typedOptional = (key: OptionalFieldKey): unknown => typed[key];
  const priorOptional = (key: OptionalFieldKey): unknown => match[key];

  const displayFor = (key: OptionalFieldKey) => (value: unknown) => {
    if (isBlank(value)) return "—";
    return key === "jobFamilyId"
      ? lookups.jobFamilyName(value as number)
      : String(value);
  };

  const optionalLabels: Record<OptionalFieldKey, string> = {
    jobFamilyId: "Job Family",
    preferredFirstName: "Preferred First Name",
    preferredLastName: "Preferred Last Name",
  };

  const handleConfirm = () => {
    const optionalFields: RehireOptionalFields = {};
    for (const key of OPTIONAL_FIELD_KEYS) {
      const resolved = resolveKeepClear(
        typedOptional(key),
        priorOptional(key),
        decisions[key],
      );
      if (key === "jobFamilyId") {
        optionalFields.jobFamilyId =
          resolved === null ? null : Number(resolved);
      } else {
        optionalFields[key] = resolved === null ? null : String(resolved);
      }
    }

    onConfirm({
      employeeId: match.id,
      priorFinishDate: priorNeedsFinishDate
        ? priorFinish.toISOString()
        : undefined,
      // Only sent when the Admin chose to replace — the service writes legal names
      // only when supplied, so "keep" means omitting them entirely.
      legalFirstName:
        legalNameDecision.legalFirstName === "clear"
          ? typed.legalFirstName
          : undefined,
      legalLastName:
        legalNameDecision.legalLastName === "clear"
          ? typed.legalLastName
          : undefined,
      optionalFields,
      startDate: rehireStart.toISOString(),
    });
  };

  const legalNameRows = (
    [
      ["legalFirstName", "Legal First Name"],
      ["legalLastName", "Legal Last Name"],
    ] as const
  ).map(([key, label]) => {
    const prior = match[key];
    const requested = typed[key];
    const differs = prior !== requested;
    const materiallyDiffers =
      differs && prior.trim().toLowerCase() !== requested.trim().toLowerCase();
    const willWrite = legalNameDecision[key] === "clear";

    return (
      <ComparisonRow
        key={key}
        label={label}
        oldText={prior || "—"}
        newText={(willWrite ? requested : prior) || "—"}
        highlight={materiallyDiffers}
      >
        {differs && (
          <>
            <KeepClearControls
              value={legalNameDecision[key]}
              onChange={(d) =>
                setLegalNameDecision((prev) => ({ ...prev, [key]: d }))
              }
              keepLabel="Keep existing"
              changeLabel={`Replace with "${requested}"`}
              destructive={false}
              disabled={submitting}
            />
            {materiallyDiffers && (
              <p className="text-xs text-muted-foreground">
                These are materially different names, not just a difference in
                case — check this is the same person before replacing.
              </p>
            )}
          </>
        )}
      </ComparisonRow>
    );
  });

  const body = (
    <div className="space-y-5 px-1">
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          The prior employment stint will be archived and this record reactivated —
          their training, tickets and USI history stay attached. No new employee
          record is created.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Rehire Start Date *</Label>
          <DateSelector
            selectedDate={rehireStart}
            onDateSelect={setRehireStart}
          />
          <p className="text-xs text-muted-foreground">
            Defaults to the request&apos;s start date. Must be after the prior
            stint&apos;s finish date.
          </p>
        </div>
        {priorNeedsFinishDate && (
          <div className="space-y-2">
            <Label>Prior Finish Date *</Label>
            <DateSelector
              selectedDate={priorFinish}
              onDateSelect={setPriorFinish}
            />
            <p className="text-xs text-muted-foreground">
              This record has no finish date. Set when the prior stint ended.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Field changes
        </h4>

        {legalNameRows}

        <ComparisonRow
          label="Title"
          oldText={match.title || "—"}
          newText={typed.title || "—"}
        />
        <ComparisonRow
          label="Department"
          oldText={lookups.departmentName(match.departmentId)}
          newText={lookups.departmentName(typed.departmentId)}
        />
        <ComparisonRow
          label="Location"
          oldText={lookups.locationName(match.locationId)}
          newText={lookups.locationName(typed.locationId)}
        />
        <ComparisonRow
          label="Status"
          oldText={String(match.status ?? "—")}
          newText={String(typed.status ?? "—")}
        />

        {OPTIONAL_FIELD_KEYS.map((key) => {
          const typedValue = typedOptional(key);
          const priorValue = priorOptional(key);
          const showKeepClear = isBlank(typedValue) && !isBlank(priorValue);
          const resolved = resolveKeepClear(
            typedValue,
            priorValue,
            decisions[key],
          );
          const display = displayFor(key);

          return (
            <ComparisonRow
              key={key}
              label={optionalLabels[key]}
              oldText={display(priorValue)}
              newText={display(resolved)}
            >
              {showKeepClear && (
                <KeepClearControls
                  value={decisions[key]}
                  onChange={(d) =>
                    setDecisions((prev) => ({ ...prev, [key]: d }))
                  }
                  disabled={submitting}
                />
              )}
            </ComparisonRow>
          );
        })}

        <p className="text-xs text-muted-foreground">
          USI and notes are not part of an onboarding request, so the prior
          record&apos;s values are left untouched.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col-reverse gap-2 border-t pt-4 pb-2 sm:flex-row sm:justify-end">
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={submitting}
        >
          Back
        </Button>
        <Button onClick={handleConfirm} disabled={submitting}>
          {submitting ? "Rehiring…" : "Approve & Rehire"}
        </Button>
      </div>
    </div>
  );

  const title = `Rehire ${match.legalFirstName} ${match.legalLastName} (#${match.id})`;
  const description =
    "Review each field before confirming. The prior stint is archived as a history record.";

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {body}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-4">{body}</div>
      </DrawerContent>
    </Drawer>
  );
}
