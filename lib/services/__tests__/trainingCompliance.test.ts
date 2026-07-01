import { describe, it, expect } from "vitest";
import {
  currentRevision,
  isTrainingSatisfied,
  type TrainingLite,
} from "@/lib/services/trainingCompliance";

const now = new Date("2026-06-24T00:00:00Z");
const past = new Date("2020-01-01T00:00:00Z");
const past2 = new Date("2023-01-01T00:00:00Z");
const future = new Date("2030-01-01T00:00:00Z");
const created = new Date("2026-01-01T00:00:00Z");

const rev = (id: number, effectiveDate: Date, over: boolean | null = null) => ({
  id,
  effectiveDate,
  createdAt: created,
  overrideRequiresRetraining: over,
});

describe("currentRevision", () => {
  it("returns null when there are no revisions", () => {
    expect(currentRevision([], now)).toBeNull();
  });
  it("returns null when every revision is future-dated", () => {
    expect(currentRevision([rev(1, future)], now)).toBeNull();
  });
  it("returns the newest revision on-or-before now", () => {
    expect(currentRevision([rev(1, past), rev(2, past2), rev(3, future)], now)?.id).toBe(2);
  });
  it("breaks effectiveDate ties by highest id (createdAt equal here)", () => {
    expect(currentRevision([rev(1, past), rev(2, past)], now)?.id).toBe(2);
  });
});

describe("isTrainingSatisfied", () => {
  const t = (revisions: TrainingLite["revisions"], dflt = false): TrainingLite => ({
    requiresRetrainingOnRevision: dflt,
    revisions,
  });

  it("is not satisfied with no records", () => {
    expect(isTrainingSatisfied([], t([rev(1, past)], true), now)).toBe(false);
  });
  it("case 1 — no revisions: any record satisfies", () => {
    expect(isTrainingSatisfied([{ revisionId: null }], t([]), now)).toBe(true);
  });
  it("case 1 — only future revisions: any record satisfies", () => {
    expect(isTrainingSatisfied([{ revisionId: 99 }], t([rev(1, future)]), now)).toBe(true);
  });
  it("case 2 — current revision does not require retraining: any record satisfies", () => {
    expect(isTrainingSatisfied([{ revisionId: 1 }], t([rev(2, past)], false), now)).toBe(true);
  });
  it("case 3 — current requires retraining: needs the current revisionId", () => {
    const training = t([rev(1, past), rev(2, past2)], true);
    expect(isTrainingSatisfied([{ revisionId: 1 }], training, now)).toBe(false);
    expect(isTrainingSatisfied([{ revisionId: 2 }], training, now)).toBe(true);
  });
  it("case 3 — a null revisionId record still counts (safe default)", () => {
    expect(isTrainingSatisfied([{ revisionId: null }], t([rev(1, past)], true), now)).toBe(true);
  });
  it("per-revision override beats the type-level default", () => {
    // type default false, but current revision overrides retraining to true -> needs current id
    const training = t([rev(1, past), rev(2, past2, true)], false);
    expect(isTrainingSatisfied([{ revisionId: 1 }], training, now)).toBe(false);
    expect(isTrainingSatisfied([{ revisionId: 2 }], training, now)).toBe(true);
  });
});
