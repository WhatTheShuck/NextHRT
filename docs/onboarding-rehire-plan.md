# Rehire handling for the onboarding form — implementation plan

> **Status: implemented 2026-07-30** (uncommitted). All ten steps landed as written
> below, with the review amendments folded in. Verified: 599 tests pass
> (`pnpm exec vitest run --exclude "**/.worktrees/**"`, 52 files),
> `pnpm exec tsc --noEmit` clean, `pnpm build` clean with
> `/api/employees/name-matches` registered. **Not** done: the browser walkthrough of
> both modes (§10 step 9).
>
> Files added: `lib/services/employeeDuplicateService.ts`,
> `lib/services/employeeRehire.ts`, `app/api/employees/name-matches/route.ts`,
> `components/rehire/reconciliation.tsx`,
> `components/rehire/onboarding-rehire-panel.tsx`, plus four test files.
> `DESLOPPIFY.md` M13 and M14 are ticked; C5 is marked partly done (service-side
> guard landed, route zod still open).

## Problem

The rehire flow exists but is wired only into the direct-add path
(`/employees/new` → `employeeService.createEmployee` → `DuplicateEmployeeDialog` →
`POST /api/employees/[id]/rehire`).

The onboarding form path bypasses it completely:

- `components/forms/onboarding-form.tsx` — no duplicate/rehire concept at all.
- `POST /api/onboarding` → `onboardingService.createRequest()` — no name-match lookup.
- `onboardingService.approveRequest()` calls `tx.employee.create({…})` **directly**
  (`lib/services/onboardingService.ts:255`). It copied `createEmployee`'s field
  mapping but not its duplicate guard, so `DUPLICATE_EMPLOYEE` never fires here.
- `app/admin/onboarding/[id]/onboarding-detail-content.tsx` shows the reviewing
  admin no name-collision warning.

Result for a returning employee onboarded this way: a second `Employee` row,
`hasPriorEmployment` left `false`, no `REHIRE` history row, and all prior
training/tickets/USI orphaned on the old departed record.

## Core decision: detect in two places, decide in one

The rehire decision is a data-integrity merge decision, so it belongs to the
**Admin at approval** — the same gate that already owns dept/location and the
core HR edits (spec §6.3).

The submitter still needs a nudge, because they are the one who knows the person
is returning. But `POST /api/onboarding` has **no role check** (any authenticated
user can submit), so the submit-side check must not disclose other employees'
records. Submit-side is therefore *advisory and non-disclosing*; approval-side is
*authoritative and fully detailed*.

| Stage | Actor | Sees | Effect |
|---|---|---|---|
| Submit | any authenticated user | "An existing record matches this name" (count only) | sets `possibleRehire` hint on the request |
| Approve | Admin | full match records + reconciliation panel | rehire existing record **or** create new |

**"Decide in one" does not mean "guard in one".** The Admin makes the *judgement*
in the UI, but the server must still refuse to create silently over a match — see
§3f. The direct-add path already works this way (`createEmployee` needs an
explicit `confirmDuplicate: true`, `employeeService.ts:182`/`:188`); the approval
path must match it, or the only thing standing between a returning employee and a
duplicate row is a button in one React component.

## 0. Verified facts this plan rests on

Checked against the working tree before writing, so the implementer doesn't have
to re-derive them:

- `equals` on SQLite **is** case-sensitive. Probed against `prisma/dev.db` with
  the app's own client: for the stored name `"Lianne"`, `equals: "lianne"` → 0
  rows, `equals: "LIANNE"` → 0 rows, `equals: "Lianne"` → 1 row. This is the hole
  §1 closes.
- **`contains` is not a usable case-insensitive prefilter** — an earlier draft of
  this plan assumed it was. It maps to `LIKE`, which folds **ASCII only**, while
  the JS filter that follows it uses full-Unicode `toLowerCase()`. Probed:
  `'José' LIKE '%JOSÉ%'` → false, `'Müller' LIKE '%MÜLLER%'` → false, but
  `'JOSÉ'.toLowerCase() === 'josé'` → true. A `contains` prefilter therefore drops
  exactly the rows the filter would accept, and SQLite's `lower()` is ASCII-only
  too, so there is no SQL-side fix without ICU. See §1 for what replaced it.
- **Prisma's `contains` cannot be escaped.** It emits `LIKE ?` with no `ESCAPE`
  clause, so a backslash is matched literally. Probed over 399 employees:
  `contains: "%"` → 399 rows, `contains: "\\%"` → **0 rows**, `contains: "_"` →
  399 rows. Sanitising `%`/`_` by backslash-prefixing does not neutralise the
  wildcard, it produces a query that can never match. Also why §1 has no escaping
  step.
- `orderBy: { finishDate: "desc" }` puts departed records first and active ones
  last: SQLite sorts NULLs last under `DESC`, and Prisma emits a plain `ORDER BY`
  with no `NULLS` clause. Probed — first rows are `2026-03-17`, `2026-02-26`, …,
  the last row is `null`, 132 of 399 rows are null. §1 relies on this and §8 tests
  it.
- `preferredFirstName` / `preferredLastName` are nullable on `Employee`
  (`schema.prisma:17-18`), so §3e's clear-to-`null` controls are safe.
- `createdEmployeeId` is a bare nullable `Int` with no `@unique` and no relation,
  so populating it on both paths is safe, and it is the precedent for adding
  `rehireOfEmployeeId` the same way (no FK, consistent with the model as it
  stands).
- `OnboardingRequest` genuinely has no `usi` / `notes` columns (the payload's
  `notes{it,hr,payroll}` is a different thing) — hence the field-set divergence
  in §3c. Conversely `Employee` has **no** `medicalStandardId`
  (`schema.prisma:13-48`) while the request does, so the request's medical
  standard is request-only and there is nothing to reconcile there either.
- `createEmployee`'s duplicate check is wrapped in `if (!data.confirmDuplicate)`
  (`employeeService.ts:182`, `:188`) — the create-anyway escape hatch the dialog
  posts. §1's rewire must keep the wrapper, and §3f gives the approval path its
  own equivalent.
- `Employee.phone` / `Employee.mobile` (`schema.prisma:28-29`) are Snipe-IT-synced
  and survive offboarding — `rehireEmployee`'s update data touches neither. §3a
  clears them.
- `onboarding-detail-content.tsx:509` (inside `handleApprove`, from `:504`) is the
  **only** caller of the approve route, so the body-shape change in §4 has exactly
  one client.
- The existing `employeeService` rehire tests survive the §3a extraction:
  `employeeService.test.ts:62` passes `mockPrisma` itself as the tx client, and
  the `expect(update).not.toHaveBeenCalled()` assertions still hold once the
  throws move inside the transaction.

## 1. Shared name-match helper

Three call sites will need the same predicate (`createEmployee`, onboarding
submit, onboarding approve). Extract it once — new
`lib/services/employeeDuplicateService.ts`:

```ts
findNameMatches(firstName: string, lastName: string): Promise<EmployeeMatch[]>
```

**Not** `employeeMatchService` — a `matchingService` already exists (user↔employee
account linking, driven by the app settings). Two services called "match" will be
confused for each other on sight. `employeeDuplicateService` names what it is for.

Returns matches ordered `finishDate desc`, each carrying the full prior field set
the reconciliation panel needs (mirror the projection at
`employeeService.ts:217-235`), plus `department`/`location` relations.

**Case sensitivity — and why there is no SQL prefilter.** Prisma's
`mode: "insensitive"` is a PostgreSQL/MongoDB feature, unavailable on SQLite and
used nowhere in this repo. The current `equals` match is therefore
case-*sensitive*, which is `DESLOPPIFY.md` **M13** (`:182-186` — "jane smith"
sails past "Jane Smith").

Neither obvious SQL fix works here (both probed — see §0): a `contains` prefilter
folds ASCII only and so silently drops the non-ASCII rows the JS filter would
accept, and Prisma's `contains` has no `ESCAPE` clause so `%`/`_` can be neither
escaped nor relied upon. **So do the comparison entirely in JS:**

```ts
// 1. cheap two-column scan — ~400 rows in this deployment
const candidates = await prisma.employee.findMany({
  select: { id: true, legalFirstName: true, legalLastName: true },
});
// 2. exact match, Unicode-normalised and case-folded
const norm = (s: string) => s.trim().normalize("NFKC").toLowerCase();
const ids = candidates.filter(
  (c) => norm(c.legalFirstName) === norm(firstName) &&
         norm(c.legalLastName) === norm(lastName),
).map((c) => c.id);
// 3. hydrate only the matches with the relations the panel needs
if (ids.length === 0) return [];
return prisma.employee.findMany({
  where: { id: { in: ids } },
  include: { department: true, location: true },
  orderBy: { finishDate: "desc" },
});
```

This is the design call worth understanding, because it looks like the naive one:
`Employee` is a ~400-row HR table, so a two-column scan is cheaper than the
correctness surface a `LIKE` prefilter costs. Doing it this way deletes the
escaping problem, the blank-name wildcard problem and the ASCII-folding hole
together, rather than adding a guard for each. Leave a comment recording the
table-size assumption so a future 100k-row deployment knows to revisit it (at
which point the answer is a normalised/generated lowercase column with an index,
not `LIKE`).

`normalize("NFKC")` matters because "José" typed on macOS (decomposed `e` + combining
acute) and "José" stored from Windows (precomposed `é`) are different strings that
`toLowerCase()` alone will not reconcile. Accent-*insensitive* matching ("Jose" vs
"José") is deliberately still out — that is `matchingService` fuzzy territory.

Map step 3's rows through the `DuplicateMatch` projection before returning, so the
helper's contract is the honest field set (below) rather than a full
`Employee & { department, location }`.

Two details the §8 ordering test depends on: `orderBy: { finishDate: "desc" }` is
carried over from the current inline block unchanged, and SQLite sorts NULLs last
under `DESC`, so **departed records come first and active ones last** — which is
what the panel wants, since only departed records are selectable.

One guard remains: return `[]` immediately if either name is blank after trimming.
Not for query safety any more, just so a blank never matches a malformed stored
row.

This supersedes M13's recorded fix note (which suggested `$queryRaw` + `LIKE`) —
tick M13 as done and amend the note, so nobody later implements both.

Then rewrite `employeeService.createEmployee`'s inline block to call the helper,
keeping the existing `{ code: "DUPLICATE_EMPLOYEE", matches, suggestions }` throw
shape so `employee-add-form.tsx` needs no change — and **keep the
`if (!data.confirmDuplicate)` wrapper** (`employeeService.ts:188`). Easy to drop
in an extraction, and dropping it makes create-anyway impossible. It matters more
after this change, not less: case-insensitive matching routes strictly more names
through that dialog.

**Scope note — matching is over `Employee` only.** Two managers submitting the
same new hire produces two pending `OnboardingRequest` rows that neither the
submit-side nor the approval-side check will notice, because no `Employee` exists
yet. That is at least as likely as the rehire case and is logged in §9 rather than
solved here; if it comes into scope, it is a second `status: "Pending"` name scan
in this same helper.

While building the projection, close `DESLOPPIFY.md` **M14** — *both* halves, or it
stays open:

- Service side: `department: emp.department || "Unknown"` puts a string where the
  type promises a relation, and the fallback is dead code anyway — `departmentId`
  is a required relation, so `emp.department` is always present when included.
  Type the match object honestly (export a `DuplicateMatch` type from the new
  service) and drop both fallbacks.
- Client side: `duplicate-employee-dialog.tsx:46` types the wire payload
  `EmployeeWithRelations[]`, which it has never been. Point it at
  `DuplicateMatch` (dates as strings, post-JSON). Small, and it is the half that
  actually stops future code reaching for `trainingRecords` on a payload that
  has none.

## 2. Schema (`prisma/schema.prisma`, `model OnboardingRequest`)

```prisma
possibleRehire     Boolean @default(false)  // submitter's hint at submit time
rehireOfEmployeeId Int?                     // set on approval when approved as a rehire
```

One nullable field carries both the fact and the target — `approvedAsRehire` is
just `rehireOfEmployeeId != null`. Bare scalar with no relation, matching
`createdEmployeeId` (§0).

Note `createdEmployeeId` is populated on both paths (on a rehire it equals the
reactivated employee's id), so the employee profile's onboarding tab
(`listRequests({ createdEmployeeId })`) keeps working with no change — and a
returning employee correctly shows both their original and their rehire request,
since the column is not unique.

Show `possibleRehire` as a badge in the **pending-request list** as well as on the
detail page (§6). It costs one badge and it is what makes the column earn its
keep — an Admin can then triage the flagged requests first instead of discovering
the flag only after opening each one.

Apply with `pnpm prisma db push` (migration drift — see project memory), then
`pnpm prisma generate`.

## 3. Service layer

### 3a. Required refactor: make the rehire core transaction-injectable

`employeeService.rehireEmployee` opens its own `prisma.$transaction`
(`employeeService.ts:604`), and `approveRequest` is already inside one. You must
not nest — the better-sqlite3 adapter runs on a single connection, so an inner
`BEGIN` will fail or deadlock.

Extract the archive+reactivate body into a **module-level function in a new
`lib/services/employeeRehire.ts`**, not a method on `EmployeeService`:

```ts
// lib/services/employeeRehire.ts
export interface RehireData { /* …as employeeService.ts:548-560, plus §3d */ }

export async function rehireInTx(
  tx: Prisma.TransactionClient,
  employeeId: number,
  data: RehireData,
  userId: string,
)
```

Free function, not a method, for two reasons. It cannot be `private` — the whole
point is that `onboardingService` calls it, and TypeScript will reject a private
method from another class. And making it public on `employeeService` would force
`onboardingService` to import `employeeService`, a dependency it does not
currently have, purely to reach one function. A free function that takes its `tx`
touches no module singleton and imports nothing but `serializePriorStint` /
`deriveEmploymentType` from `lib/employment.ts` (both already pure and both
already imported by `employeeService.ts:5`), so it is trivially testable on its
own.

Use `Prisma.TransactionClient` — `approvalService.ts:18` already establishes that
type for exactly this pattern; don't invent a local `TxClient` alias.

`rehireEmployee()` becomes `prisma.$transaction(tx => rehireInTx(tx, …))`,
and `approveRequest` calls `rehireInTx` with its own `tx`. All the existing
validation (`ACTIVE_EMPLOYEE`, `MISSING_FINISH_DATE`, `INVALID_REHIRE_DATE`,
prior-stint snapshot via `serializePriorStint`) moves inside `rehireInTx` so both
callers get it identically.

Three requirements on the extraction:

- **Keep `include: { department: true, location: true }` on the returned
  `employee.update`.** This is load-bearing for §7:
  `onboardingFanOutService.ts:15-17` derives `FanOutEmployee` from
  `Awaited<ReturnType<approveRequest>>` and reads `employee.department.name` /
  `employee.location.name`. Return the *same* shape from both approval branches
  so the return type stays a single object rather than becoming a union.
- **Add the `isNaN(date.getTime())` guard** on `startDate` / `priorFinishDate` —
  this closes `DESLOPPIFY.md` C5 for both paths (an `Invalid Date` currently
  makes the `INVALID_REHIRE_DATE` comparison evaluate to "pass").
- **Accept optional legal names** — see §3d.
- **Type `startDate` as `string | Date`.** The current signature says `string`
  (`employeeService.ts:549`) because its only caller is a route reading JSON, but
  `approveRequest`'s merged `startDate` is a `Date` (`onboardingService.ts:244-246`).
  Widening the field is cleaner than making the caller round-trip through
  `.toISOString()`; `new Date(value)` accepts both and the `isNaN` guard above
  covers both.
- **Clear `phone` and `mobile`.** Both are Snipe-IT-synced (§0) and both survive
  offboarding today, so a reactivated record reappears holding a landline and SIM
  the employee handed back. Worse, `mobile`'s own schema comment says it is "used
  for phone-number reuse on onboarding" — a stale number makes the returning
  employee a reuse candidate for a number that has since been reassigned. Set both
  to `null` in `rehireInTx`; the Snipe sync repopulates them once the new hardware
  is issued.

Free win worth noting: today the active/exists check reads *outside* the
transaction (`employeeService.ts:564`), so there is a TOCTOU window where the
record can be reactivated between the check and the update. Moving the
`findUnique` inside the tx closes it.

### 3b. Post-commit: invalidate the requirements cache

A reactivated employee keeps their `RequirementsCacheEntry` rows from the old
stint — computed against the *old* department/location. Nothing currently fixes
this: `employeeService` never enqueues `REQUIREMENTS_CACHE_INVALIDATE` (zero hits
in that file), and the nightly `REQUIREMENTS_CACHE_REBUILD` filters
`isActive: true` (`requirementsCacheRebuild.ts:17`), so the stale rows survive
offboarding and are still there when the employee comes back. Symptom: wrong
training/ticket requirements on the returning employee's profile until 1am.

`requirementsCacheInvalidate.ts:16-40` already recomputes a single employee from
their current dept/location, so the fix is one enqueue:

```ts
await enqueue("REQUIREMENTS_CACHE_INVALIDATE", { employeeId });
```

**Fix both ends, not just rehire.** The same handler already *wipes* cache entries
when it finds the employee inactive (`requirementsCacheInvalidate.ts:26-29`), so
the root fix is to enqueue it on offboarding too — otherwise every departed
employee sits on stale rows and the rehire-side enqueue is only papering over
them. That is one line inside `enqueueOffboardingIfDeactivated`
(`employeeService.ts:345-359`), a method this step is already touching.

**Enqueue after the transaction commits, not inside `rehireInTx`.** Two reasons,
and the ordering one is the real one: the job runner can pick a `Job` row up as
soon as it is visible, so enqueueing pre-commit races the recompute against data
that has not landed — it would recompute from the *old* dept/location, which is
the exact bug being fixed. Second, `enqueue` must not be able to fail the write
that already succeeded. Both callers therefore do it after their `$transaction`
resolves, wrapped in a try/catch that logs and swallows — mirror
`enqueueOffboardingIfDeactivated`, which exists for precisely that reason.

This is pre-existing and affects the direct-add rehire path identically, but it
lands inside this step's blast radius for a few lines, and if left alone it will
be reported as a bug in *this* feature.

### 3c. `createRequest`

Accept `possibleRehire?: boolean` and persist it as
`data.possibleRehire === true`. No lookup in the service — detection is a separate
read the form performs (§5).

The `=== true` coercion is not paranoia: `POST /api/onboarding` hands
`request.json()` straight to `createRequest` with **no validation of any kind**,
and `createRequest` explicitly maps each field
(`onboardingService.ts:110-140`), so a non-boolean `possibleRehire` reaches Prisma
and 500s the submission. §4's guards only cover the approve route.

### 3d. Legal names on rehire — decide it explicitly

`rehireEmployee`'s update data (`employeeService.ts:618-640`) contains no
`legalFirstName` / `legalLastName`. In rehire mode the merged names *are*
persisted back onto the request (`onboardingService.ts:292-293`) but never onto
the Employee, so the two rows end up disagreeing and a genuine correction —
married name, fixed misspelling — silently vanishes.

Resolution:

- `RehireData` gains `legalFirstName?: string` / `legalLastName?: string`.
  `rehireInTx` writes them **only when supplied**.
- The §6 reconciliation panel gets legal-name rows in its comparison table with
  keep/replace controls, **defaulting to keep-existing**. Case-only differences
  are the normal case now that matching is case-insensitive (that is *why* the
  record matched), so keep-existing is the right default; a material difference
  shows as a highlighted row the Admin has to consciously act on.
- The direct-add path passes neither field, so its behaviour is unchanged.
  Offering the same control in `DuplicateEmployeeDialog` is a follow-up (§9).

### 3e. `approveRequest` gains a decision argument

```ts
type ApprovalDecision =
  | { mode: "create"; confirmDuplicate?: boolean }
  | { mode: "rehire"; employeeId: number; priorFinishDate?: string | null;
      legalFirstName?: string; legalLastName?: string;
      optionalFields?: { jobFamilyId?: number | null;
                         preferredFirstName?: string | null;
                         preferredLastName?: string | null } };

approveRequest(id, userId, edits?, decision: ApprovalDecision = { mode: "create" })
```

**No `startDate` on the decision — it travels in `edits`.** §6's reconciliation
panel offers a rehire start date; that control writes `edits.startDate`, not a
decision field. The request `update` persists `startDate` back onto the request
(`onboardingService.ts:301`), so routing it through `edits` keeps the request and
the reactivated Employee agreeing about when the new stint began. A decision-only
start date would set the Employee and leave the request saying something else.
`rehireInTx` then receives the same merged `startDate` the create branch would
have used.

Inside the existing transaction, after the current pending / org-request /
dept+location guards and the edits merge:

- `mode: "create"` → today's `tx.employee.create` + `Employee` `CREATE` history.
  Unchanged.
- `mode: "rehire"` → `rehireInTx(tx, decision.employeeId, {…merged fields…}, userId)`.
  The `REHIRE` history row replaces the `CREATE` row; `hasPriorEmployment` is set
  and the prior stint archived by the shared code.
- anything else → throw `INVALID_APPROVAL_DECISION`. Do **not** let an
  unrecognised `mode` fall through to `create`: a typo'd mode silently creating
  the duplicate employee is the exact failure this feature exists to prevent.

Then the request `update` sets `createdEmployeeId` to the returned employee id
(both modes) plus `rehireOfEmployeeId` in rehire mode. The
`OnboardingRequest` `UPDATE` history row is written as it is today. After the
transaction resolves, the §3b enqueue runs in rehire mode.

**Error codes: reuse, don't invent.** `rehireInTx` already throws
`EMPLOYEE_NOT_FOUND`, `ACTIVE_EMPLOYEE`, `MISSING_FINISH_DATE`,
`INVALID_REHIRE_DATE`. The shared code throws one canonical set and each route
maps it; there is no `REHIRE_TARGET_NOT_FOUND` / `REHIRE_TARGET_ACTIVE`.

### 3f. `mode: "create"` needs a server-side duplicate guard

Without one, this feature's guarantee is a button in one React component.
`{ mode: "create" }` goes straight to `tx.employee.create` with no lookup, and §4's
validation cannot help — the mode is perfectly valid. Any other caller, a replayed
request, or a future second approval UI creates exactly the duplicate row the
feature exists to prevent.

So inside the transaction, in `create` mode only:

```ts
if (!decision.confirmDuplicate) {
  const matches = await findNameMatches(legalFirstName, legalLastName, tx);
  if (matches.length > 0) throw { code: "DUPLICATE_EMPLOYEE", matches, suggestions };
}
```

Same `{ code, matches, suggestions }` plain-object throw as `createEmployee`, so
the code and the client-side handling stay one thing rather than two. This means
`findNameMatches` must accept an optional `Prisma.TransactionClient` (default
`prisma`) — one extra parameter in §1, and the read belongs inside the tx anyway
for the same TOCTOU reason §3a gives.

The payoff beyond safety: "Not the same person — create new" becomes a real
assertion the server records the Admin having made, instead of a UI-only click.
The button posts `confirmDuplicate: true`.

Route mapping: `DUPLICATE_EMPLOYEE` → **409** on the approve route (a state
conflict the Admin resolves by choosing a mode), distinct from the direct-add
route's existing shape, which stays untouched.

Note the **field-set divergence** from the direct-add rehire: the onboarding
request has no `usi` and no `notes` fields, so those two can never be reconciled
here — leave whatever the prior record holds untouched (pass `undefined`; Prisma
treats it as "don't touch"). Only `jobFamilyId`, `preferredFirstName`,
`preferredLastName` get keep/clear treatment, plus the legal names per §3d. All
three are nullable on `Employee` (§0), so "clear" can pass `null` safely — keep
the `undefined` (don't touch) / `null` (clear) distinction intact end to end, and
note it is exactly the distinction the existing merge block relies on
(`onboardingService.ts:230-237`).

## 4. API

### `GET /api/employees/name-matches?firstName=&lastName=` — new

- 400 if either name is blank after trimming (no wildcard queries).
- Admin → full match objects (feeds the approval panel).
- non-Admin → `{ count, hasDepartedMatch }` only. No names, dates, or
  departments, and **don't echo the submitted name back** in the response; this
  is what the onboarding form calls.

Recording the disclosure trade-off deliberately: the count-only response is still
an existence oracle — any authenticated user can probe whether *some* record
matches a name they type, including departed staff they can't otherwise see
(`getEmployees` scopes non-admins by `employee.viewAll` / `viewDepartment`, and
the form's own manager picker uses `activeOnly=true`). Every authenticated user
here is a staff member and the answer is one bit about a name they already had to
know to ask, so this is accepted rather than mitigated.

### `POST /api/onboarding`

Pass `possibleRehire` through.

### `POST /api/onboarding/[id]/approve`

Body becomes `{ edits?, decision? }`. This is a **breaking shape change** —
today the whole body *is* the edits object (`approve/route.ts:27`, sent from
`onboarding-detail-content.tsx:509`).

Discriminating the two shapes is trivial, so just do it and drop the "land route
and client together" coupling: `Partial<OnboardingCoreHRData>` contains no
`edits` or `decision` key, so

```ts
const isObject =
  typeof body === "object" && body !== null && !Array.isArray(body);
const isNewShape = isObject && ("edits" in body || "decision" in body);
const edits = isNewShape ? body.edits : isObject ? body : undefined;
const decision = isNewShape ? body.decision : undefined;
```

is unambiguous. The `isObject` narrowing is load-bearing, not defensive noise:
`request.json()` happily returns a string or number for a body of `"hello"` or
`5`, and `"edits" in "hello"` is a **TypeError** → 500. The existing try/catch
around `request.json()` (`approve/route.ts:26-30`) only catches malformed JSON,
not valid-JSON-wrong-type.

Two more inline guards. Zod on this route is still §9 work, but both of these are
unvalidated input reaching a transaction (same family as C4/C5):

- `decision`: reject unless `mode` is one of the two known strings, and in rehire
  mode unless `Number.isInteger(decision.employeeId)` — both 422. Otherwise
  `decision.employeeId` reaches `tx.employee.findUnique` and a non-integer becomes
  a Prisma throw → 500. `confirmDuplicate` is read as `=== true`, so a junk value
  fails closed into the §3f guard rather than past it.
- `parseInt(id)` (`approve/route.ts:34`) is already unguarded today — `NaN` reaches
  `findUnique` the same way. One line while you are in the file:
  `Number.isInteger(n)` else 400.

Error mapping to add to the existing `switch`:

| code | status | note |
|---|---|---|
| `ACTIVE_EMPLOYEE` | 409 | state conflict, matches `ONBOARDING_REQUEST_NOT_PENDING` |
| `EMPLOYEE_NOT_FOUND` | **422** | *not* 404 — ambiguous with request-not-found; message must name the rehire target |
| `MISSING_FINISH_DATE` | 422 | |
| `INVALID_REHIRE_DATE` | 422 | |
| `INVALID_APPROVAL_DECISION` | 422 | |
| `DUPLICATE_EMPLOYEE` | 409 | §3f; plain-object throw, so match on `error.code` not `error.message` — the existing `switch` is on `Error` instances and will miss it |

Leave the direct-add rehire route's existing 400s alone — changing them would
break a working client for no gain.

## 5. UI — submit side (`components/forms/onboarding-form.tsx`)

Keep this deliberately small; the file is already 1409 lines and
`DESLOPPIFY.md` M9 wants it split.

- On blur of the legal-name fields (both non-empty), call the name-matches
  endpoint. Blur alone — no debounce on top of it; the two together just add
  in-flight races for no benefit. Failures silent.
- If `count > 0`, render an inline `Alert` under the names: "An existing employee
  record matches this name — the reviewer will check it before creating a
  duplicate."
- **Only offer the `possibleRehire` checkbox when `hasDepartedMatch` is true**, with
  the returning-employee wording ("If this is a returning employee, tick the box so
  the reviewer links the records instead of creating a duplicate"). Keying the
  checkbox on `count > 0` instead would prompt "returning employee?" for an
  *active* same-name colleague — the common case in a 400-person company — and
  train submitters to tick it wrongly, which is worse than no hint at all. This is
  also the only thing `hasDepartedMatch` exists for; without it, §4 returns a field
  nobody reads.
- Advisory only — never blocks submit, never affects `validate()`.

## 6. UI — approval side (`app/admin/onboarding/[id]/onboarding-detail-content.tsx`)

- On load, fetch name-matches for the request's legal name (Admin, so full
  records). If `possibleRehire` is set, show it as a badge on the request summary
  regardless of match results.
- **Refetch (debounced) when the Admin edits either legal name.** A single
  on-load fetch means correcting "Jon" → "John" in the edits panel never surfaces
  the departed "John Smith" — the collision the Admin is best placed to catch.
- Matches present → warning `Alert` above the Approve button, plus a match list
  that mirrors `DuplicateEmployeeDialog`'s cards: departed records selectable,
  active records shown but disabled.
- Selecting a departed record swaps "Approve & Create Employee" for a
  reconciliation panel: rehire start date (defaults to the request's
  `startDate`), prior-finish-date input when the record has none, and the
  old→new comparison table over `legalFirstName / legalLastName / title /
  department / location / status` plus keep-clear controls for the three optional
  fields. Legal names default to keep-existing (§3d).
- Confirm posts `{ edits, decision: { mode: "rehire", … } }` and, on success,
  routes to `/employees/{id}` as it does today (`onboarding-detail-content.tsx:509`
  → `:511`; in rehire mode that id is the reactivated record's).
- The rehire start date control writes `edits.startDate` (§3e), not a decision
  field — same control the create branch uses, so the request and the Employee
  cannot disagree about the new stint's start.
- "Not the same person — create new" posts
  `{ edits, decision: { mode: "create", confirmDuplicate: true } }` — the
  `confirmDuplicate` flag is what satisfies §3f's server-side guard. Approving a
  request with **no** matches sends `{ mode: "create" }` with no flag, so the guard
  stays armed for everything the UI did not explicitly review.
- **Surface the outcome after approval.** Once a request carries
  `rehireOfEmployeeId`, show "Approved as rehire of #123" (linked) on the approved
  request detail and on the employee profile's onboarding tab. Without it the
  column is write-only and an Admin reviewing history later cannot tell a rehire
  approval from a create approval without reading the `REHIRE` history row.
- **Surface the *dismissed* outcome too.** An Admin who reviews a flagged request
  and correctly decides "different person" currently leaves no trace, so six months
  on that is indistinguishable from never having looked. The state is already there
  for free: on an `Approved` request, `possibleRehire = true` with
  `rehireOfEmployeeId = null` means "flagged, reviewed, created new". Render it as
  "Reviewed — created a new record" wherever the rehire line above appears.

**On reuse:** don't force `DuplicateEmployeeDialog` to serve both. Its typed-side
is `EmployeeFormData` and its optional set includes `usi`/`notes` that don't
exist here. Extract the genuinely shared parts — `isBlank`, the keep/clear
resolver, and the old→new comparison row as a small presentational component —
into a shared module, and let each side own its own field config. Forcing one
component across two different field sets is worse than the small duplication.
Both panels must be Dialog-on-desktop / Drawer-on-mobile per project convention.

## 7. Fan-out — no code changes, but it is a decision, not an omission

`onboardingFanOutService.enqueueAll(request, employee)` only sends emails and
enqueues `HARDWARE_REQUEST` jobs keyed on `employee.id`. Given a rehired
employee it runs correctly as-is, and `approve/route.ts:41` already calls it
with whatever employee the service returns.

Mechanically that holds **only** while `rehireInTx` returns department and
location — the service infers `FanOutEmployee` from `approveRequest`'s return type
(`onboardingFanOutService.ts:15-17`) and reads `employee.department.name`. See the
first bullet in §3a.

**Deliberate call: a rehire gets the identical new-starter fan-out.** Worth stating
outright, because "no changes needed" above is only an argument about types, and
the six sections `enqueueAll` fires (`:463-470`) are all written for a first-time
hire: manager next-steps email, employment-forms jobs, program-access email,
landline email, HR/payroll notes, hardware requests. A returning employee genuinely
does need most of that — new hardware, re-granted program access, forms re-signed —
so sending it is right, but the Admin should not be surprised that new-starter-worded
emails go out for someone who worked here last year. If the wording turns out to
matter, the fix is rehire variants of the affected templates (the templates are
already DB-driven via `emailTemplateService`), **not** suppressing sections — a
skipped hardware request is a returning employee with no laptop. Logged in §9 rather
than done here.

## 8. Tests

- `lib/services/__tests__/employeeDuplicateService.test.ts` (new) — case
  insensitivity, whitespace trimming, **non-ASCII case folding ("MÜLLER" matches
  stored "Müller" — the case a `LIKE` prefilter would have dropped, §0)**,
  **NFKC normalisation (decomposed vs precomposed "José" match)**, `%`/`_` in a
  name matching literally rather than as wildcards, blank-name short-circuit,
  active-vs-departed ordering, no-match.
- `employeeService.createEmployee` — a case-differing name now throws
  `DUPLICATE_EMPLOYEE`. The helper tests above cover the helper; this covers the
  *rewiring*, which is the whole payoff of step 1, and asserts the throw shape
  (`matches` / `suggestions`) still matches what `employee-add-form.tsx` reads.
- `app/api/employees/name-matches` — **role gating**: Admin gets full match
  objects; non-Admin gets `{ count, hasDepartedMatch }` and the response body
  contains no names, dates, departments, or an echo of the submitted name. Plus
  400 on a blank name. This is the one new disclosure surface the feature adds
  (§4) and must not be the untested part.
- `lib/services/__tests__/onboardingService.test.ts` — extend with: rehire mode
  writes a `REHIRE` row and no `Employee` `CREATE`; sets `rehireOfEmployeeId` and
  `createdEmployeeId`; rejects an active target; rejects `startDate` ≤ prior
  finish; rejects an unparseable date; rejects an unknown `mode`; legal names
  written only when supplied; `REQUIREMENTS_CACHE_INVALIDATE` enqueued after
  commit in rehire mode and not in create mode; `mode: "create"` behaviour
  unchanged. The existing `vi.hoisted` mock's `txClient` needs
  `employee.findUnique`, `employee.update` and `employee.findMany` (§3f's guard
  read) added, and the module needs `@/lib/jobs/jobQueue` mocked.
- §3f guard, in `onboardingService.test.ts`: `mode: "create"` over a matching name
  **throws `DUPLICATE_EMPLOYEE` and creates no Employee**; the same call with
  `confirmDuplicate: true` creates it; `confirmDuplicate: "yes"` (junk) still
  throws. This is the guarantee the whole feature rests on, and it is the one that
  cannot be verified from the UI.
- `rehireInTx`: clears `phone` and `mobile`; accepts a `Date` as well as a string
  `startDate`; writes legal names only when supplied.
- Approve route — old body shape (bare edits object) still routes to
  `mode: "create"`; new shape parsed correctly; non-integer `employeeId` → 422;
  **a non-object JSON body (`"hello"`, `5`) does not 500** (the §4 `isObject`
  guard); non-integer route `id` → 400.
- `employeeService` rehire tests still pass through `rehireEmployee` → proves the
  `rehireInTx` extraction preserved behaviour (verified compatible, §0).
- `REQUIREMENTS_CACHE_INVALIDATE` is also enqueued when an update deactivates an
  employee (the §3b offboarding half), and an `enqueue` rejection does not fail
  the committed write on either path.
- Run with `pnpm exec vitest run --exclude "**/.worktrees/**"` (worktree copies
  fail on alias resolution).

## 9. Out of scope — worth logging separately

- **Snipe-IT reactivation.** Offboarding enqueues a job that disables the
  AssetCheckout user; nothing re-enables it on rehire, and `ensureUser` is a
  lookup-or-create, so a hardware request for a rehired employee resolves to the
  still-disabled account rather than failing loudly. This affects the *existing*
  rehire path identically, so it is a pre-existing gap, not one this work
  introduces.
- **Duplicate *pending onboarding requests*.** Matching is over `Employee` only
  (§1), so two managers submitting the same new hire get two pending requests and
  no warning on either — and since no `Employee` exists yet, §3f's guard cannot see
  it. The first approval creates the employee; the second then *does* trip the
  guard, so the failure mode is a confusing 409 at the second approval rather than a
  duplicate row. Tolerable, but the clean fix is a `status: "Pending"` name scan in
  `employeeDuplicateService` surfaced on the request detail.
- **Legal-name reconciliation on the direct-add path.** §3d gives the onboarding
  panel keep/replace controls for legal names; `DuplicateEmployeeDialog` should
  get the same, now that case-insensitive matching means the typed and stored
  names can legitimately differ.
- **Rehire-worded email templates.** §7 sends a returning employee the identical
  new-starter fan-out, which is functionally right but reads oddly. If it matters,
  add rehire variants of the manager next-steps / forms templates via
  `emailTemplateService` — do not suppress fan-out sections.
- **`REHIRE` label drift** (`DESLOPPIFY.md` M10): `history-tab.tsx:107-114` maps
  it to "Rehired" but `history-record-details-dialog.tsx:139-141` renders the raw
  action. Onboarding rehires will now produce these rows too, so it becomes more
  visible.
- **Zod on the approve route** (`DESLOPPIFY.md` C4/C5). §4's inline guards are a
  stopgap; the `decision` object is still hand-validated input reaching a
  transaction, which makes the approve route a better zod pilot than the rehire
  route.

## 10. Build order

| # | Step | Size | Notes |
|---|---|---|---|
| 1 | `employeeDuplicateService` (JS-side matching, NFKC, optional `tx` param) + rewire `createEmployee` (keep `confirmDuplicate`) + M14 typing **both halves** | S | closes M13; no `LIKE`, no escaping |
| 2 | `GET /api/employees/name-matches` (role-gated projection) + its role-gating tests | S | the new disclosure surface — test it here, not in step 9 |
| 3 | Schema fields + `db push` + `generate` | XS | |
| 4 | `lib/services/employeeRehire.ts` — free `rehireInTx` (`Prisma.TransactionClient`, keep includes, optional legal names, `isNaN` guards, `startDate: string \| Date`, clear `phone`/`mobile`) + cache invalidate on **both** rehire and offboarding | M | no behaviour change beyond the guards; existing tests are the check |
| 5 | `approveRequest` decision arg + **§3f create-mode duplicate guard** + service tests | M | the core of the feature |
| 6 | Approve route: dual body shape (+ `isObject` narrowing), `decision` and `id` guards, error mapping incl. `DUPLICATE_EMPLOYEE` → 409 | S | ships alone — old client keeps working |
| 7 | Admin approval UI: warning, match list, reconciliation panel, `confirmDuplicate` on create-new, post-approval "rehire of #123" / "reviewed" line | L | largest piece |
| 8 | `createRequest` `possibleRehire` (coerced) + form alert / `hasDepartedMatch`-gated checkbox + pending-list badge | S | keep the form change minimal |
| 9 | Full test run + browser walkthrough of both modes | S | |

Steps 1-4 and 6 are independently safe and shippable before any UI exists — step
6's back-compat discriminator is what decouples it from step 7.

**Step 5 is the exception, because §3f fails closed.** Once the guard lands, the
existing approval UI (which sends a bare edits body → `mode: "create"` with no
`confirmDuplicate`) gets a 409 on any request whose legal name matches an existing
employee, and it has no control to resolve it — including the legitimate
same-name-colleague case. So **land steps 5, 6 and 7 together**, or land 7 first.
Failing closed is the right default for a guard whose whole job is refusing to
create duplicates silently, but the interim window is a real block on a working
flow, not a theoretical one.

Step 1 is also the one step with a standalone payoff regardless of whether the rest
lands: it fixes a live duplicate-detection hole on the direct-add path (M13) that
currently lets "jane smith" through against a stored "Jane Smith".
