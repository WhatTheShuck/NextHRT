# Versioned Training & Ticket Renewal — Brainstorm Transcript

**Date:** 2026-06-23  
**Status:** In progress — ticket renewal section not yet started  
**Goal:** Design both features together so shared concepts are identified and reused

---

## Context: Existing Schema

### Training side
- `Training` — the abstract concept (id, category, title, isActive)
- `TrainingRecords` — one delivery record per employee (employeeId, trainingId, dateCompleted, trainer, images)
- `TrainingRequirement` — (trainingId, departmentId, locationId) — which dept/location combos require this training
- `TrainingTicketExemption` — per-employee exemptions (type, trainingId, reason, startDate, endDate, status)
- **No concept of revision or version exists today**

### Ticket side
- `Ticket` — abstract type (id, ticketCode, ticketName, renewal: Int? in years, isActive)
- `TicketRecords` — per-employee credential (employeeId, ticketId, dateIssued, licenseNumber, expiryDate, images)
- `TicketRequirement` — same shape as TrainingRequirement
- `TrainingTicketExemption` — shared exemption model covers both
- **`renewal` field exists on `Ticket` but there is no mechanism to link a renewal record to its predecessor, or to identify which record is "current" vs historical**
- **Background job `TICKET_EXPIRY` already exists** — relevant to renewal design

### Shared structure
Both Training and Ticket have near-identical parallel structures: abstract type → per-employee record → requirements → exemptions → images. Any design decisions about versioning/renewal should respect this parallelism.

---

## Problem Statements

### Problem 1: Versioned Training (Employee Handbook problem)

Internal training content gets revised over time. Today there is no way to record which revision of a training an employee received. The current workaround is creating separate `Training` instances per version ("Employee Handbook 2013", "Employee Handbook 2026", etc.), which causes:

- To find "has employee ever had Employee Handbook training" you must select ~45 separate training instances
- No way to distinguish whether a prior completion is still valid after a revision
- No canonical concept of "what is the current version of this training"

**Goal:** Record which revision was delivered, preserve the ability to query by training concept regardless of revision, and support enforcement of retraining when a material revision is published.

### Problem 2: Ticket Renewal (License/Credential problem)

Credentials (e.g. forklift license, vehicle license) expire and are renewed. When renewed:
- A new record needs to be created with a refreshed date, new image of the ticket, new expiry, etc.
- The old record is now historical — it is no longer the "current" credential
- Currently there is no link between the old and new record, no way to query "current valid credential," and no way to see the renewal history chain

---

## Decisions Made So Far

### Training: Does a new revision require retraining?

**Question asked:** When a new revision is published, do employees who completed an older revision need to redo it?

**Answer (user):** It depends on the training. Some revisions are material enough that employees must redo them; others are minor and prior completions still satisfy the requirement.

---

### Training: Where does "requiresRetraining" live?

**Options explored:**

**Option A — At the `Training` level (type level)**
- Set once per training type. "Employee Handbook always requires retraining on revision." "Fire Warden awareness never does."
- Pro: Simple, admin makes one decision, consistent across all revisions
- Con: No flexibility when a training type that usually requires retraining gets a trivial update — you can't model "this one revision specifically doesn't require it"

**Option B — At the `TrainingRevision` level (per-revision)**
- Each revision independently declares whether it's material
- Pro: Maximum precision, models reality exactly
- Con: Admin must consciously set this flag every time a revision is created; if they forget, the default has large consequences

**Option C (Hybrid — recommended):** `Training.requiresRetrainingOnRevision` as the type-level default, with `TrainingRevision.overrideRequiresRetraining` (nullable Boolean) for per-revision exceptions. Null = inherit from Training. Admin sets the default once on the training type, and only touches the revision-level flag for genuinely exceptional cases.

**User alignment:** User confirmed that the type-level is the 90% case and agreed the flexibility to override at revision level makes sense. Hybrid approach is the working design.

---

### Training: How is the "current revision" determined?

**Decision:** Date-based. Whatever revision has the most recent `effectiveDate` on or before today is the current revision. This allows admins to pre-stage future revisions without them going live immediately.

**Edge cases identified:**

1. **Backdated revisions** — Admin creates a revision today with a past effective date (e.g. 2024-01-01). It immediately becomes "current" and retroactively was current since 2024. If `requiresRetraining = true`, employees who completed the training between 2024 and today may suddenly flip to non-compliant. This is the most dangerous edge case. Should either be prevented (block past effective dates) or trigger a loud warning.

2. **Two revisions with the same effective date** — Needs a deterministic tiebreaker (e.g. `createdAt` timestamp, or an explicit ordering field). Otherwise behavior is unpredictable.

3. **No revisions exist for a training** — Revisions must be opt-in. If a `Training` has no `TrainingRevision` records, the existing compliance logic applies unchanged: any `TrainingRecord` satisfies the requirement.

4. **Cache invalidation when a revision's effective date passes** — At midnight on an effective date, compliance states may change for many employees simultaneously. The existing `REQUIREMENTS_CACHE_REBUILD` background job would need to be triggered by this event. Otherwise compliance UI shows stale data.

5. **Inferring which revision was "current at time of completion"** — Querying "what revision did employee X complete in 2021" is answerable as: the revision with the most recent `effectiveDate` ≤ the completion date. This works correctly only if effective dates are accurate. Backdated revisions (see #1) would corrupt historical inference.

6. **Deleting or re-dating the active revision** — Changing the effective date of the current revision to the future silently makes an older revision current again. Should be gated with a warning or prevented while the revision is active.

---

## Proposed Schema Direction (Training — partial, not finalized)

```
Training (existing)
  id
  category
  title
  isActive
  requiresRetrainingOnRevision  Boolean  (NEW — type-level default)

TrainingRevision (NEW model)
  id
  trainingId                    → Training
  revisionLabel                 String   (e.g. "2026 Edition", "v3.1")
  effectiveDate                 DateTime (newest on-or-before-today = current)
  description                   String?  (what changed in this revision)
  overrideRequiresRetraining    Boolean? (null = inherit from Training)
  createdAt                     DateTime

TrainingRecords (existing — one field added)
  ...existing fields...
  revisionId                    Int?     → TrainingRevision (nullable for backwards compat)
```

**Compliance logic (sketch):**
- If training has no revisions: any TrainingRecord for that trainingId satisfies the requirement (existing behavior preserved)
- If training has revisions: current revision = max(effectiveDate) where effectiveDate ≤ today
- Determine `requiresRetraining` for current revision: `overrideRequiresRetraining ?? training.requiresRetrainingOnRevision`
- If `requiresRetraining = true`: employee is compliant only if they have a TrainingRecord where `revisionId` = current revision id
- If `requiresRetraining = false`: employee is compliant if they have any TrainingRecord for that trainingId (any revision or pre-revision records)

---

## Ticket Renewal — Not Yet Discussed

This section is pending. Key topics to explore:
- What happens to the old TicketRecord when a renewal is created? (auto-supersede vs manual)
- How to identify the "current" credential for a given (employee, ticket type) pair
- Grace period concept (expired but still valid for X days)?
- What the existing `TICKET_EXPIRY` background job currently does and how renewal interacts with it
- Whether the renewal chain (old → new) needs to be traversable

---

## Shared Concepts Between the Two Features

Identified so far:
- Both need a "parent type" concept and per-employee records — already true in schema
- Both need a notion of "which record is current" — by date for training revisions; likely by status/recency for ticket records
- Both need history visibility — an employee's profile should show the chain of revisions/renewals, not just the current one
- Both touch the requirements cache — any change to what "counts" as compliant for either feature needs to invalidate and rebuild the requirements cache for affected employees
- Exemption model is shared — `TrainingTicketExemption` covers both; revision/renewal design should not break exemption logic

---

## What Was Unsatisfactory / Misalignments to Resolve

- Early questions were too vague — options described without concrete schema or behavioral consequences
- User clarified that existing "required training" system is already present and revision design should layer onto it, not replace it
- The question of "which revision is current" (date-based) was agreed upon but behavioral consequences (edge cases) needed to be spelled out more precisely
- Ticket renewal section not yet started — this transcript should be used to continue from here

