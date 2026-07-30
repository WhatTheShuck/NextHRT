# Scope: normalising date-only columns to UTC midnight

Status: **scoping only — not implemented.** Written 2026-07-30, prompted by the
off-by-one found in the onboarding approval review screen.

## The problem

Several `DateTime` columns are semantically *calendar dates* — a start date, a
completion date, a ticket issue date. There is no meaningful time-of-day. But
they are stored as **instants**, and the instant is derived from whatever
local-time `Date` the browser happened to produce:

- `components/date-selector.tsx` typed-input path calls
  `parse(value, "dd/MM/yyyy", new Date())`. date-fns fills units the format
  doesn't specify from the reference date, so the **current local time-of-day**
  gets baked in.
- The calendar-picker path passes react-day-picker's `Date`, which is **local
  midnight**.
- Forms then send `.toISOString()`, so in AEST (+10) a local midnight of 10 Aug
  is persisted as `2026-08-09T14:00:00Z` — the previous UTC day.

Reads mostly hide this because they use `format(new Date(iso), …)`, which
converts back to local. The bug surfaces the moment anything reads the **UTC**
calendar date. That is exactly what
`app/admin/onboarding/[id]/onboarding-detail-content.tsx` did via
`startDate.substring(0, 10)` (fixed 2026-07-30 with local-aware helpers, but
the fix is local to that file).

The current arrangement is correct only while every writer, every reader, and
every server process share one positive UTC offset. It is not robust to a
negative-offset viewer, and it makes UTC-based reads a latent trap.

## Current data state

Measured against `prisma/dev.db` (`substr(col,12,5)` = stored time-of-day):

| Column | Rows | At `00:00` | Notes on the rest |
|---|---|---|---|
| `Employee.startDate` | 399 | 385 | 11 at `14:00` (AEST local midnight), 3 arbitrary |
| `Employee.finishDate` | 267 | 262 | 5 non-midnight |
| `TicketRecords.dateIssued` | 392 | 234 | **114 at `00:02`** (import artifact), 34 at `14:00`, 3 at `13:00` (AEDT), ~7 arbitrary |
| `TicketRecords.expiryDate` | 379 | 333 | derived from `dateIssued`, inherits its skew |
| `TrainingRecords.dateCompleted` | 6160 | 6020 | 104 at `14:00`, 17 at `13:00`, ~19 arbitrary business-hours times |
| `TrainingRevision.effectiveDate` | 87 | 86 | 1 non-midnight |

Two distinct populations:

1. **`14:00` / `13:00` clusters** — app-created rows carrying local midnight.
   These are *already* stored one UTC day before their intended date. Any
   UTC-based read shows them a day early today.
2. **Arbitrary times** (`00:02`, `05:xx`, `06:xx`, `23:xx`) — a `new Date()`
   time-of-day got baked in, either by the typed-input path or by
   `dateCompleted: new Date()` style writes.

Roughly **150 rows carry local-midnight instants** and **~160 carry arbitrary
times** across the domain tables. The bulk of history is already clean UTC
midnight, which makes the target invariant the cheaper one to converge on.

Related: `[[datetime-storage-corruption]]` — a prior import stored some of these
columns as integer epoch-ms, breaking SQL range comparisons. Domain columns were
normalised to canonical ISO text 2026-07-10; **auth tables were deliberately
left**. Any backfill here must re-verify
`typeof(col) IN ('integer','real')` is 0 first, or the `GLOB`/`LIKE` guards
silently skip rows.

## Target invariant

> A date-only column always stores `YYYY-MM-DDT00:00:00.000Z`. The calendar date
> is read from the **UTC** components, never the local ones.

This makes the stored value timezone-independent and makes UTC-based reads
(`substring(0, 10)`, `toISOString().split("T")[0]`, SQL `date()`) correct by
construction — the opposite of today's rule, where only local reads are safe.

## Column inventory

**In scope — date-only (9 columns):**

| Column | Schema line |
|---|---|
| `Employee.startDate` | `prisma/schema.prisma:20` |
| `Employee.finishDate` | `:21` |
| `OnboardingRequest.startDate` | `:157` |
| `TrainingRevision.effectiveDate` | `:284` |
| `TrainingRecords.dateCompleted` | `:302` |
| `TicketRecords.dateIssued` | `:447` |
| `TicketRecords.expiryDate` | `:451` |
| `TrainingExemption.startDate` / `.endDate` | `:494` / `:495` |
| `TrainingRequest.trainingDate` / `.intendedCompletionDate` | `:759` / `:760` |

**Out of scope — genuine instants.** Every `createdAt` / `updatedAt`, plus
`reviewedAt`, `uploadedAt`, `submittedAt`, `markedAt`, `startedAt`,
`completedAt`, `History.timestamp`, `JobRun.scheduledAt`, and all better-auth
columns (`Session.expiresAt`, `Account.accessTokenExpiresAt`, `User.banExpires`,
rate-limit `lastRequest`/`lastRefillAt`). These have real time-of-day meaning
and must not be touched.

`TrainingExemption.startDate` has `@default(now())`, which writes a true
instant. Either drop the default or accept that defaulted rows aren't
normalised — a decision, not a mechanical change.

## Work breakdown

### 1. Helper layer (new, ~1 file)

`lib/date-only.ts` with the canonical conversions:

- `toUtcDateOnly(d: Date | string): Date` — snap to `T00:00:00.000Z` using the
  source's **local** Y/M/D (so an existing local-midnight instant maps to the
  date the user meant, not the UTC date it currently reads as).
- `fromDateInputValue(v: string): Date` / `toDateInputValue(d: Date): string` —
  `<input type="date">` bridge, UTC-based.
- `formatDateOnly(d, fmt)` — display without a local-timezone shift.

This is the piece the recent onboarding fix inlined; it should move here and the
inline helpers in `onboarding-detail-content.tsx` should collapse into it.

### 2. Write path

Normalise at the **service boundary**, not in the forms — the forms are many and
the services are the chokepoint, and it keeps the invariant enforced regardless
of which client writes.

Sites (excluding tests):
- `lib/services/employeeService.ts:224-225`, `:384-390`, `:480-481`
- `lib/services/onboardingService.ts:171`, `:294-296`
- `lib/services/employeeRehire.ts:31-32` (`parseDate`), `:82-101`, `:125-126`
- `lib/services/ticketRecordService.ts:24`, `:395`, `:448`
- `lib/services/trainingRevisionService.ts:50`, `:98`
- `app/api/training/[id]/revisions/route.ts:58`
- `lib/services/trainingRequestService.ts:41-42`
- `lib/services/quizService.ts` (`dateCompleted` write path)
- exemption create/update service
- `lib/expiry-utils.ts:6-21` (`calculateExpiryDate`) — `setFullYear` on a
  local-time `Date` also drifts across a DST boundary; should operate in UTC.
  Note `:18`'s `setDate(getDate())` is a no-op and can go.

### 3. Read / display path

`format(new Date(iso), …)` becomes wrong once values are UTC midnight for any
viewer west of UTC, so display helpers must switch to UTC-based formatting in
lockstep. Known display helpers: `onboarding-list-content.tsx:72`,
`onboarding-tab.tsx:54`, `onboarding-detail-content.tsx` `fmt`,
`onboarding-rehire-panel.tsx:144-147`, plus `lib/export-utils.ts` and the report
pages. Needs a sweep of `format(new Date(` across `app/` and `components/`.

The 13 `DateSelector` consumers don't strictly need changing if services
normalise — but `DateSelector` itself should stop baking in time-of-day
(`parseInputDate` returning a UTC-midnight `Date`), otherwise every new write
depends on the service catching it.

### 4. Range queries — the sharp edge

These compare date-only columns against `new Date()`-derived local bounds. Each
must move to UTC day boundaries or it will be off by one after normalisation:

- `lib/services/quizService.ts:442` — `dateCompleted: { gte: today, lt: nextDay(today) }`
  where `today = startOfDay(completedAt)` is **local**. Same-day dedup for quiz
  completions; breaks first and most visibly.
- `lib/services/ticketRecordService.ts:45` — `expiryDate: { gte: new Date() }`
- `lib/services/ticketService.ts:84-85` — `gt: now, lte: cutoffDate`
- `lib/jobs/handlers/ticketExpiry.ts:35` — `expiryDate: { lte: warnCutoff }`
- `lib/jobs/handlers/exemptionExpiry.ts:12` — `endDate: { lte: now }`
- `lib/jobs/handlers/inactiveEmployeeCheck.ts:14` — `finishDate: { lte: now }`
- `lib/jobs/handlers/trainingRevisionCrossing.ts:15` — `effectiveDate` window
- `lib/services/employeeService.ts:39-43` — `startDate` report filters
- `lib/services/trainingCompliance.ts:15-26` and
  `lib/services/ticketCompliance.ts:6` — `getTime()` comparisons against `now`;
  a UTC-midnight `effectiveDate` becomes "current" up to 10h later than today
- `app/reports/employee/onboarding/page.tsx:40-41` — `toISOString().split("T")[0]`
  range bounds, already skewed today

### 5. Backfill

One idempotent script (pattern exists: `scripts/backfill-ticket-expiry.ts`,
`scripts/migrate-training-revisions.ts`), per column:

- `14:00` / `13:00` rows → **advance to the next UTC midnight** (they mean the
  following calendar date).
- Other non-midnight rows → **truncate to the same UTC day** (`00:02`, `05:xx`
  etc. are the intended date with junk time).

Those two rules move rows in *opposite* directions, so the split has to be
right. Recommend: derive the intended date by rendering each value in
`Australia/Brisbane`/`Sydney` and snapping to that Y/M/D — one rule, no
offset-cluster special-casing. Must be run with the app stopped, after a
`prisma/dev.db` copy, and must re-check for integer-typed values first per
`[[datetime-storage-corruption]]`.

Verification query per column: `substr(col,12) = '00:00:00.000+00:00'` for all
rows, and a before/after calendar-date diff report so any row whose *date*
changed is reviewable.

### 6. Tests

Existing suites assert current behaviour, so expect churn in
`employeeRehire`, `onboardingService`, `employeeService`, `ticketRecordService`,
`trainingRevisionService`, `quizService`, and the `ticketExpiry` /
`exemptionExpiry` / `inactiveEmployeeCheck` job tests. Worth adding a
`TZ=America/New_York` run of the suite as the regression gate — that is the
condition the whole exercise is meant to survive, and nothing currently proves
it.

## Effort and sequencing

Roughly **9 date-only columns, ~15 service write sites, ~11 range-query sites, a
display sweep, 1 backfill script, and ~10 test files**. Not a one-sitting
change; the write path, read path, and backfill have to land together or dates
visibly shift for users mid-deploy.

Suggested order:

1. `lib/date-only.ts` + tests (no behaviour change).
2. One column end-to-end as a pilot — **`TrainingRevision.effectiveDate`** (87
   rows, 1 non-midnight, few writers, self-contained "newest on-or-before today"
   read). Proves the pattern cheaply.
3. `Employee.startDate` / `finishDate` + `OnboardingRequest.startDate` — highest
   user visibility, already has the onboarding fix as a bridgehead.
4. Ticket columns, including `calculateExpiryDate` in UTC.
5. `TrainingRecords.dateCompleted` (6160 rows — largest backfill) with the
   `quizService` day-boundary query.
6. Exemptions and training requests.
7. `TZ=America/New_York` suite run as the closing gate.

## Open decisions

- **Is a non-AEST viewer actually in scope?** If the app will only ever be
  served to Australian users on an Australian server, this is latent-trap
  cleanup rather than a live bug, and steps 3–6 could be deferred. The one real
  bug found so far (the onboarding review screen) is already fixed. That
  judgement drives whether this is worth doing at all.
- **`TrainingExemption.startDate`'s `@default(now())`** — drop the default, or
  accept unnormalised defaulted rows?
- **Do the auth tables stay excluded?** Recommend yes, consistent with the
  earlier decision — they're instants anyway, so they fall out of scope
  naturally.
- **Backfill rows whose calendar date changes** — the ~150 local-midnight rows
  will shift date by one. Confirm that's the intent (it is a correction, but it
  changes historical records and should be signed off, with the diff report as
  the artifact).
