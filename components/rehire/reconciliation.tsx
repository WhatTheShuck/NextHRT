"use client";

import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The genuinely shared parts of a rehire reconciliation panel, used by both the
 * direct-add path (`DuplicateEmployeeDialog`) and the onboarding approval path.
 *
 * Deliberately *not* a single shared panel component: the two sides reconcile
 * different field sets — the onboarding request has no `usi`/`notes` columns at
 * all, and its typed side is an `OnboardingRequest` rather than an
 * `EmployeeFormData`. Forcing one component across two field sets is worse than
 * the small duplication, so each side owns its own field config and only the
 * primitives live here.
 */

export type FieldDecision = "keep" | "clear";

export function isBlank(value: unknown): boolean {
  return value === null || value === undefined || String(value).trim() === "";
}

/**
 * Resolve one optional field to the value that should be written.
 *
 * The rule both panels share: a typed value always wins; when the typed value is
 * blank but the prior record has one, the Admin's keep/clear decision applies,
 * defaulting to keep (non-destructive).
 *
 * Returns `null` to mean "clear" — callers that need the Prisma `undefined`
 * ("don't touch") distinction handle that themselves, since only they know which
 * of their fields are reconcilable at all.
 */
export function resolveKeepClear(
  typedValue: unknown,
  priorValue: unknown,
  decision: FieldDecision,
): unknown {
  if (!isBlank(typedValue)) return typedValue;
  if (isBlank(priorValue)) return null;
  return decision === "clear" ? null : priorValue;
}

/** One old → new row of a comparison table. */
export function ComparisonRow({
  label,
  oldText,
  newText,
  highlight = false,
  children,
}: {
  label: string;
  oldText: string;
  newText: string;
  /** Draw attention when the two sides genuinely differ and it matters. */
  highlight?: boolean;
  /** Optional controls (e.g. keep/clear, keep/replace) rendered under the row. */
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`flex flex-col gap-2 rounded-md border p-3 text-sm ${
        highlight ? "border-amber-500/60 bg-amber-500/5" : ""
      }`}
    >
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <span className="font-medium text-foreground">{label}</span>
        <span className="flex items-center gap-2">
          <span className="text-muted-foreground">{oldText}</span>
          <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="font-medium text-foreground">{newText}</span>
        </span>
      </div>
      {children}
    </div>
  );
}

/** Keep / clear (or keep / replace) toggle for one reconciled field. */
export function KeepClearControls({
  value,
  onChange,
  keepLabel = "Keep",
  changeLabel = "Clear",
  destructive = true,
  disabled = false,
}: {
  value: FieldDecision;
  onChange: (decision: FieldDecision) => void;
  keepLabel?: string;
  changeLabel?: string;
  /** The change action is destructive (clear) rather than a swap (replace). */
  destructive?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <Button
        type="button"
        size="sm"
        variant={value === "keep" ? "default" : "outline"}
        onClick={() => onChange("keep")}
        disabled={disabled}
      >
        {keepLabel}
      </Button>
      <Button
        type="button"
        size="sm"
        variant={
          value === "clear" ? (destructive ? "destructive" : "default") : "outline"
        }
        onClick={() => onChange("clear")}
        disabled={disabled}
      >
        {changeLabel}
      </Button>
    </div>
  );
}
