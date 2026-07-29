# DESLOPPIFY — Cleanup Backlog

Generated 2026-07-02 from a full-project review. Verified against a fresh `tsc --noEmit`
(2 errors, both in one test file) and `vitest run` (271 passed, 2 failed).

Status legend: `[ ]` open · `[x]` done · **SAFE NOW** = no conflict with in-flight rehire work · **WAIT** = touches in-flight code or needs a decision first.

---

## 🔴 Critical

### C1. `[x]` `/api/stats` has no authentication — DONE 2026-07-06
- **Where:** `app/api/stats/route.ts`
- **Why it matters:** It is the only one of ~70 API routes with no `getAuth()` check. It leaks org-wide aggregate counts (employees, departments, programs, hardware…) to any unauthenticated caller. Low-sensitivity data, but it's a hole in an otherwise consistent auth wall, and the pattern invites copy-paste of an unauthenticated route.
- **Fix:** Add the standard `getAuth(request)` + 401 guard used by every sibling route.
- **Effort:** 5 minutes.

### C2. `[x]` Real database files sitting in the working tree, not gitignored — DONE 2026-07-06 (backups moved to ignored `backups/`; `prisma/dev.db*`, `db-migration/`, `backups/` gitignored; which backups to keep still an open call)
- **Where:** `prisma/dev.db.bak-*` (4 files), `prisma/dev.db.good`, `db-migration/` (5 files including `prod.db` — production HR data with PII)
- **Why it matters:** `.gitignore` covers only `prisma/dev.db`. One `git add -A` commits ~25 MB of employee data (names, USIs, notes) into git history permanently. This is the highest-consequence item on the list.
- **Fix:** Add `prisma/dev.db*` and `db-migration/` to `.gitignore`; move the backups outside the repo (or into an ignored `backups/` dir). Decide which backups are still needed — most predate merged features.
- **Effort:** 10 minutes.

### C3. `[x]` 2 failing tests on main (`onboardingService.test.ts`) — DONE 2026-07-06 (fixtures fixed + service check hardened to `!= null`)
- **Where:** `lib/services/__tests__/onboardingService.test.ts` → `approveRequest` tests; throw originates at `lib/services/onboardingService.ts:213`
- **Why it matters:** The pending-org-request feature added `pendingDepartmentRequestId !== null` checks, but the test fixtures never set those fields, so `undefined !== null` → the service thinks requests are pending. A red suite on main trains everyone to ignore test failures.
- **Fix:** Add `pendingDepartmentRequestId: null, pendingLocationRequestId: null` to the fixtures. Optionally harden the service check to `!= null` so absent fields aren't treated as pending.
- **Effort:** 15 minutes.

### C4. `[ ]` No input validation layer on API routes — SAFE NOW (incremental)
- **Where:** All `app/api/**/route.ts`; e.g. `app/api/employees/[id]/rehire/route.ts` passes the raw `request.json()` body straight into `employeeService.rehireEmployee`, and the service casts `data.status as EmployeeStatus` unchecked.
- **Why it matters:** No zod/yup/valibot anywhere. Malformed bodies surface as Prisma 500s instead of 400s; enum/string casts (`as EmployeeStatus`, `as UserRole`) can push invalid values deep into the stack. Every new route re-invents ad-hoc guards (the rehire route's `FORBIDDEN_BODY_KEYS` list is a symptom).
- **Fix:** Adopt zod. Start with mutation routes on core data (employees, rehire, onboarding approve), then spread outward. Don't boil the ocean in one PR.
- **Effort:** ~1 hour for the first 3 routes + pattern; ongoing after.

---

## 🟡 Medium

### M1. `[x]` Dead code: `components/forms/employee-request-form.tsx` — DONE 2026-07-06 (re-verified zero importers, deleted)
- **Where:** 297-line component, **zero importers** (superseded by `onboarding-form.tsx`).
- **Why it matters:** It keeps getting swept up in refactors — it's even in the current uncommitted diff — so it costs maintenance while serving nothing.
- **Fix:** Delete it (git history keeps it). Verify once more before deleting.

### M2. `[ ]` `requirementService.ts` training/ticket near-duplication — WAIT (until rehire work lands)
- **Where:** `lib/services/requirementService.ts` (904 lines). `getTrainingRequirements`/`getTicketRequirements` and `getAllIncompleteTrainingRequirements`/`getAllIncompleteTicketRequirements` are parallel ~120–140-line blocks differing only in model names. Bonus slop: `prisma.training.findMany({ where: { id: { in: [trainingId] } } })` to fetch one record.
- **Why it matters:** Every compliance rule change (revisions, expiry) must be made twice; the recent revision-aware work already shows drift risk. Biggest file in `lib/services`.
- **Fix:** Extract a shared requirement-resolution core parameterized by subject (training|ticket). Good test coverage exists (`requirementService.test.ts`, both compliance test files), so refactor is well-guarded.
- **Effort:** Half a day.

### M3. `[ ]` 21 near-identical entity CRUD dialogs — SAFE NOW (incremental)
- **Where:** `components/dialogs/{department,location,job-family,program,medical-standard,tickets,training}/{add,edit,delete}-*-dialog.tsx` — ~98 differing lines per pair after entity-name normalization; ~4,500 lines total.
- **Why it matters:** The responsive Dialog/Drawer pattern, error handling, and submit flow are copy-pasted 21×. A UX or a11y fix must be applied 21 times (and history shows they drift — 409 handling differs between entities).
- **Fix:** Extract a `ResponsiveCrudDialog` shell + `useCrudSubmit` hook; migrate one entity per PR. Don't force-fit dialogs with genuinely custom fields (tickets/training edit).
- **Effort:** 1 day spread across small PRs.

### M4. `[~]` `any`-typed report pages + dead state — needs-analysis DONE 2026-07-06 (`EmployeeRequirementsResponse` exported from requirementService, page fully typed, dead `employees` state removed); rest of the 82 `any`s remain
- **Where:** Worst: `app/reports/employee/needs-analysis/page.tsx` (8 `any`s, `requirementsData: any`, and an `employees` state that is written but never read). 82 `any` occurrences across non-test source, concentrated in reports and `lib/export-utils.ts`.
- **Why it matters:** The requirements payload shape is load-bearing for compliance display; `any` means renames in the API silently break the report at runtime, not compile time.
- **Fix:** Define a `RequirementsResponse` type (ideally exported from the service/route), replace the `any`s, delete the unused `employees` state.
- **Effort:** ~1 hour for needs-analysis; chip away at the rest.

### M5. `[~]` Silent failure UX — notes-editor DONE 2026-07-06 (also fixed: its PATCH body was fetch-style options, so notes saves were silently a no-op; now sends `{ notes }` and shows `toast.error` on failure); the 76-catch sweep remains
- **Where:** `components/notes-editor.tsx:54-57` swallows save errors with `console.error` and a literal `// You might want to show a toast notification here` comment. Sonner's `<Toaster>` is mounted in `app/layout.tsx` but `toast()` is used in exactly **one** file (`required-training-page-content.tsx`). 76 `console.error`-only catches in client components.
- **Why it matters:** A user whose notes save fails sees the editor close as if it succeeded — data loss with no signal.
- **Fix:** Standardize: inline `setError` inside dialogs/forms (already the convention), `toast.error` for background/inline saves. Fix notes-editor first.
- **Effort:** notes-editor 10 min; sweep is incremental.

### M6. `[ ]` Non-`Error` throws and inconsistent error payload shape — SAFE NOW (small)
- **Where:** `lib/services/employeeService.ts` throws a plain object `{ code: "DUPLICATE_EMPLOYEE", matches }`; routes elsewhere throw `new Error("STRING_CODE")`. API responses mix `{ message }` and `{ error }` — sometimes in the same route (`rehire/route.ts` returns `message` on 401 and `error` on 403).
- **Why it matters:** Plain-object throws lose stack traces and defeat `error instanceof Error` branches; clients can't rely on one field for error text (some dialogs read `err.response?.data?.error`, others `.message`).
- **Fix:** Introduce a small `AppError extends Error { code; payload }`; standardize responses on `{ error, code? }`. Do routes opportunistically as they're touched.
- **Effort:** Pattern in 30 min; migration incremental.

### M7. `[~]` Repo clutter / stale artifacts — mostly DONE 2026-07-06: `tsc-output.txt` + `documentation.md` deleted (facts folded into README "Background notes"), `employee-add-form.txt` → `docs/employee-add-form-design-notes.txt`, `test-plan.md` → `docs/`, `memory/feedback_git_commits.md` deleted (external memory holds a stronger copy). Remaining: **confirm `mdb-tools/` can be deleted/archived** (README now references it — update that line too if removed)
- **Where & what:**
  - `tsc-output.txt` (root) — stale; lists errors that no longer exist. **Delete.**
  - `components/forms/employee-add-form.txt` — design notes for the onboarding form living in `components/`. **Move to `docs/`** (it's the origin spec, still useful).
  - `test-plan.md` (root, 528 lines) — likely belongs in `docs/`. **Move.**
  - `documentation.md` (root) — literally titled "Scratchpad for now", untouched since May. **Fold into README or docs/, then delete.**
  - `mdb-tools/` — one-off Access→SQLite migration tooling from Jan 2025. **Confirm the migration is final, then delete or archive.**
  - `memory/feedback_git_commits.md` — agent memory inside the repo; the real memory dir is external. **Confirm not referenced, then delete.**
- **Why it matters:** Root-level noise makes it hard to tell living docs from corpses; the `.txt` in `components/` will confuse tooling and humans.

### M8. `[x]` Fix 2 TS errors in `orphanedImageCleanup.test.ts` — DONE 2026-07-06 (`tsc --noEmit` now fully clean)
- **Where:** `lib/jobs/__tests__/handlers/orphanedImageCleanup.test.ts:120,141` — `Dirent<string>` vs `Dirent<NonSharedBuffer>` mismatch from a newer `@types/node`.
- **Why it matters:** These are the *only* two typecheck errors left in the project (the old "pre-existing errors" list is otherwise resolved). Getting to a clean `tsc --noEmit` makes typecheck a usable CI gate.
- **Fix:** Type the mock as `Dirent<string>[]` via the overload, or cast at the mock boundary.
- **Effort:** 15 minutes.

### M9. `[ ]` `onboarding-form.tsx` monolith — WAIT (onboarding is active work)
- **Where:** `components/forms/onboarding-form.tsx` (1,203 lines); `components/dialogs/duplicate-employee-dialog.tsx` is heading the same way (638 lines, growing in the current diff).
- **Why it matters:** Single-file forms this size make merge conflicts and review painful; the form has clear section boundaries (HRT / forms / programs / hardware / notes) begging to be components.
- **Fix:** After the rehire/onboarding work lands, split by section with a shared form context. Don't do it mid-feature.

---

## 🟢 Nice-to-have polish

### P1. `[ ]` Component file-naming inconsistency — SAFE NOW
- `components/ExportButtons.tsx`, `components/ProfileButton.tsx` (PascalCase) vs kebab-case everywhere else; `app/forms/formsContent.tsx`, `app/reports/reportsContent.tsx` (camelCase) vs the `*-page-content.tsx` convention. Pure `git mv` + import updates.

### P2. `[ ]` Standardize client HTTP on `lib/axios` — SAFE NOW
- 89 files use the axios instance; 9 (jobs admin cards, theme settings, expiry-notification settings) use raw `fetch`. Two error-handling idioms for no reason. Convert the 9.

### P3. `[ ]` `console.log` in runtime paths — SAFE NOW
- 30 occurrences: mostly `lib/jobs/*` (arguably intentional job logging — consider routing through `logService` for consistency) plus a stray one in `app/profile/[id]/main-profile-card.tsx`.

### P4. `[ ]` `apiRBAC.hasAccessToEmployee` query fan-out — WAIT (measure first)
- `lib/apiRBAC.ts:56-72` loops managed departments issuing one child-department query each, and callers like `requirementService.getAccessibleEmployeeIds` invoke it per-request. Fine at current scale (SQLite, small org); batch with a single `findMany({ parentDepartmentId: { in } })` if report pages ever feel slow.

### P5. `[ ]` `prisma.training.findMany` single-ID lookups — fold into M2
- Same file/pattern; noted so it isn't fixed twice.

### P6. `[ ]` Route auth boilerplate — WAIT (nice with C4)
- Every route hand-rolls the same 10 lines of session + role check. A `requireRole(request, "Admin")` helper (returning session or a ready `NextResponse`) would shrink every route and make C1-style omissions impossible to miss. Pairs naturally with the zod work in C4.

---

## Suggested order of attack

| # | Item | Size |
|---|------|------|
| 1 | C2 gitignore + relocate DB backups | XS |
| 2 | C1 auth on `/api/stats` | XS |
| 3 | C3 fix failing onboarding tests | S |
| 4 | M8 fix last 2 TS errors | S |
| 5 | M1 delete dead employee-request-form | XS |
| 6 | M7 clutter sweep (delete/move stale files) | S |
| 7 | M5 notes-editor silent failure | S |
| 8 | M4 de-`any` needs-analysis report | M |
| 9 | C4 zod on mutation routes (start) | M |
| 10 | M6 AppError + payload shape | M |
| 11 | P1 / P2 / P3 naming, axios, logs | S each |
| 12 | M3 CRUD dialog consolidation | L |
| 13 | M2 requirementService dedup | L |
| 14 | M9 onboarding-form split (after feature lands) | L |

---
---

# Round 2 — 2026-07-06

Follow-up scan focused on the uncommitted rehire / prior-employment work plus a
re-sweep of the whole tree. Verified against a fresh `tsc --noEmit` (**clean**)
and `vitest run` (**273/273 passing, 32 files**) — both gates earned in Round 1
are still holding. The new `History @@index([tableName, recordId, action])` is
confirmed present in `dev.db`.

Overall: the rehire feature is in good shape — atomic transaction, snapshotted
names, real unit tests, hot-path guard on the extra fetch. The items below are
the slop around its edges plus a few things Round 1 missed.

## 🔴 Critical (Round 2)

### C5. `[ ]` Rehire date guard silently bypassed by invalid input — SAFE NOW
- **Where:** `lib/services/employeeService.ts:552-554` (`rehireEmployee`), fed by `app/api/employees/[id]/rehire/route.ts` which passes `request.json()` through unvalidated.
- **Why it matters:** `new Date(data.startDate)` on a malformed string yields `Invalid Date`, and `Invalid Date <= anything` is `false` — so the `INVALID_REHIRE_DATE` business rule **passes silently** and the request only dies later as a Prisma/`toISOString()` 500 inside the transaction. Same for a malformed `priorFinishDate`. Missing `title`/`departmentId`/`locationId` and a bad `status` enum likewise surface as 500s, and the 500 handler echoes `details: message` (internal error text) to the client. No data corruption is possible (the transaction aborts), but a validation guard that evaluates to "pass" on garbage input is a correctness hole, not just a robustness one.
- **Fix:** This is the concrete first target for **C4 (zod)**: a `rehireBodySchema` with `z.string().datetime()` dates, `z.nativeEnum(EmployeeStatus)`, and required ids would eliminate the bypass, the 500s, and the `FORBIDDEN_BODY_KEYS` hand-rolling in one move. Add an explicit `isNaN(date.getTime())` check in the service too — defense in depth for non-route callers.
- **Safe now?** Yes — additive validation, feature's tests already cover the happy and error paths.

## 🟡 Medium (Round 2)

### M10. `[ ]` History helpers duplicated across two files — and they've already drifted — SAFE NOW
- **Where:** `parseJsonSafely`, `getActionVariant`, `getTableDisplayName` are copy-pasted between `app/employees/[id]/components/tabs/history-tab.tsx` and `components/dialogs/history-record-details-dialog.tsx`.
- **Why it matters:** The drift the pattern invites has **already happened in this diff**: the tab added `getActionLabel` so REHIRE renders as "Rehired" (`history-tab.tsx:107-114`), but the details dialog still renders the raw `record.action` (`history-record-details-dialog.tsx:139-141`) — the user sees "Rehired" in the list and "REHIRE" in the popup for the same row.
- **Fix:** Extract the four helpers to `lib/history-display.ts` (or similar) and import from both. Ten-minute job that fixes a live inconsistency.
- **Safe now?** Yes.

### M11. `[ ]` `history-tab.tsx` double-fetch and pagination race — SAFE NOW
- **Where:** `app/employees/[id]/components/tabs/history-tab.tsx:47-58` — two `useEffect`s (one on `[employee?.id, includeOrphaned]` that calls `setPage(0)` **and** fetches; one on `[page]` that fetches).
- **Why it matters:** On mount both effects fire → two identical requests. Toggling "Include deleted records" while on page > 1 fires a fetch with the *old* page + *new* flag, then the `setPage(0)` triggers a second fetch — two in-flight requests with no cancellation, so whichever lands last wins and the table can briefly (or permanently, on a slow first response) show the wrong page.
- **Fix:** Single effect on `[employee?.id, page, includeOrphaned]`; reset page inside the toggle handler (`onCheckedChange={(v) => { setIncludeOrphaned(v); setPage(0); }}`); add an `AbortController` or a stale-response guard. Also a natural moment to switch its raw `fetch` to `lib/axios` (P2).
- **Safe now?** Yes — isolated to one component.

### M12. `[ ]` `duplicate-employee-dialog.tsx` is hard-coded light-mode — SAFE NOW
- **Where:** `components/dialogs/duplicate-employee-dialog.tsx` — 38 `gray-*` utilities plus `bg-white`, `bg-blue-50`, hard-coded amber buttons. It is the only dialog in `components/dialogs/` using `text-gray-900`.
- **Why it matters:** The app is fully theme-aware (theme provider, toggle, semantic tokens everywhere else). In dark mode this dialog renders near-white cards with near-black text — the most jarring surface in an otherwise consistent UI, and it's the flagship new feature's main screen.
- **Fix:** Mechanical swap to semantic tokens: `text-gray-900` → `text-foreground`, `text-gray-500/600` → `text-muted-foreground`, `bg-white` → `bg-card` / `bg-background`, `border-gray-200` → `border`, selection blue → `border-primary bg-primary/5`. Keep amber as an accent via explicit `dark:` variants if wanted.
- **Safe now?** Yes — class-only change; verify visually in both themes.

### M13. `[ ]` Duplicate detection is case-sensitive (and misses name swaps) — SAFE NOW (small), decide scope
- **Where:** `lib/services/employeeService.ts:188-204` — `legalFirstName: { equals }` / `legalLastName: { equals }` on SQLite, which is case-sensitive.
- **Why it matters:** "jane smith" typed against an existing "Jane Smith" sails past the duplicate check — the exact scenario the rehire flow exists to catch. HR data entry is exactly where casing varies.
- **Fix:** Prisma on SQLite has no `mode: "insensitive"`, but SQLite's `LIKE` is ASCII-case-insensitive: a `$queryRaw` with `WHERE legalFirstName LIKE ? AND legalLastName LIKE ?` (no wildcards) gets exact-but-case-insensitive matching cheaply. (Matching swapped preferred/legal names or typos is `matchingService` territory — out of scope unless you want it.)
- **Safe now?** Yes — tighter matching only ever *adds* candidates to an advisory dialog.

### M14. `[ ]` Duplicate-match payload lies about its type — SAFE NOW
- **Where:** `lib/services/employeeService.ts:216-234` builds `matches` with `department: emp.department || "Unknown"` (a **string** where the type promises a relation object); `components/dialogs/duplicate-employee-dialog.tsx:46` then types the wire payload as `EmployeeWithRelations[]`, which it isn't (it's a hand-picked subset, post-JSON so dates are strings).
- **Why it matters:** `match.department?.name` on the string `"Unknown"` returns `undefined` and the UI happens to fall back to "Not specified" — it works by coincidence. The `EmployeeWithRelations` annotation also invites future code to reach for fields (`trainingRecords`…) that aren't in the payload; the compiler won't object.
- **Fix:** In the service, send `department: emp.department ?? null` (drop the string sentinel), and export a real `DuplicateMatch` type from the service that the dialog imports. Pairs naturally with M6 (`AppError`) since this is the payload of the plain-object `DUPLICATE_EMPLOYEE` throw.
- **Safe now?** Yes.

### M15. `[ ]` Leftover `as any` / `undefined as any` casts in employeeService — SAFE NOW
- **Where:** `lib/services/employeeService.ts:259` and `:481` (`status: data.status as any`), `:383` (`updateData.startDate = … : (undefined as any)`).
- **Why it matters:** The `status` casts push unvalidated strings into a typed enum column (same family as C5); the `undefined as any` is a confusing no-op — assigning `undefined` is already legal and means "don't touch".
- **Fix:** Type the `data` params' `status` as `EmployeeStatus` (validated at the route per C4) and delete the casts; replace the ternary at `:380-384` with `if (data.startDate) updateData.startDate = new Date(data.startDate);`.
- **Safe now?** Yes — behavior-preserving cleanup, service has tests.

### M16. `[ ]` Inconsistent param/id hygiene between the two new routes — SAFE NOW
- **Where:** `app/api/employees/[id]/rehire/route.ts:30` checks `Number.isNaN(employeeId)`; `app/api/employees/[id]/prior-employment/route.ts:20` does not — `/api/employees/abc/prior-employment` feeds `NaN` into `hasAccessToEmployee` and the History query. Same pair also disagrees on error shape (`{ message }` for 401, `{ error }` for everything else — the M6 pattern) and the 500s echo internal `details`.
- **Why it matters:** Two routes written the same week by the same feature already disagree on basics; this is exactly how the route-boilerplate drift Round 1 flagged (P6) keeps growing.
- **Fix:** Add the NaN guard to prior-employment now (2 lines). The real cure is the P6 `requireRole`/`parseIdParam` helper + C4 — treat these two routes as its pilot.
- **Safe now?** Yes.

## 🟢 Nice-to-have polish (Round 2)

### P7. `[ ]` `getEmployees` self-view branch double-fetches the employee — SAFE NOW
- `lib/services/employeeService.ts:146-163`: loads `user` with `include: { employee: true }`, then immediately re-queries the same employee by id for `department`/`location`. One query with a nested include does it. Trivial, tested path.

### P8. `[ ]` Rehire review panel client-side date UX — SAFE NOW
- `components/dialogs/duplicate-employee-dialog.tsx`: "Prior Finish Date" defaults to *today* and nothing client-side checks `rehireStart > priorFinish` — the user only learns from the server 400 after submitting. A disabled Confirm button + inline hint when the dates are inverted would catch it pre-submit. Also `handleCreateAnyway` swallows the server's error detail (`console.error` + generic message) while the rehire path surfaces `response.data.error` — align them.

### P9. `[ ]` Prior-stints fetch fails silently on the overview tab — fold into M5 sweep
- `app/employees/[id]/components/tabs/overview-tab.tsx:41`: `catch(console.error)` — if the fetch fails, the "Previous employment" section just doesn't render, indistinguishable from having no history. A `toast.error` (pattern now established in notes-editor) is enough. Listed so the M5 sweep picks it up.

### P10. `[ ]` Planning-doc accumulation in `docs/` — WAIT (owner call)
- `docs/onboarding-build-plan.md`, `docs/test-plan.md`, `docs/versioned-training-ticket-renewal-brainstorm.md`, `docs/superpowers/`, `docs/tests/` — build plans and brainstorms for features that have since shipped. Decide a policy (delete when merged vs. move to `docs/archive/`) before the folder becomes the new root-clutter. The spec (`employee-onboarding-spec.md`) is living documentation and stays.

## Updated order of attack (open items only)

| # | Item | Size | Notes |
|---|------|------|-------|
| 1 | M10 dedupe history helpers (fixes live REHIRE-label drift) | XS | |
| 2 | M16 NaN guard on prior-employment route | XS | |
| 3 | C5 + C4 zod pilot on rehire route (+ employees POST) | M | kills the date-guard bypass |
| 4 | M15 remove `as any` casts in employeeService | S | rides on #3 |
| 5 | M11 history-tab double-fetch/race | S | do P2-for-this-file while in there |
| 6 | M12 dark-mode tokens in duplicate dialog | S | visual check both themes |
| 7 | M13 case-insensitive duplicate match | S | |
| 8 | M14 typed `DuplicateMatch` payload | S | pairs with M6 |
| 9 | M6 AppError + `{ error }` shape (Round 1) | M | |
| 10 | P7 / P8 / P9 small polish | XS each | |
| 11 | M3 / M2 big consolidations (Round 1) | L | |
| 12 | M9 onboarding-form split — unblocked once rehire work is committed | L | |
| 13 | P10 docs policy | XS | owner decision |

---
---

# Round 3 — 2026-07-06 (later)

Sweep of territory Rounds 1–2 didn't cover: the background-job infrastructure
(`lib/jobs/*`), the mail / template / onboarding fan-out stack, `scripts/`,
tracked repo strays, and a full API-route auth audit. Gates re-verified fresh:
`tsc --noEmit` **clean**, `vitest run` **273/273 passing**. Auth audit result:
every route under `app/api` has a session check except the better-auth handler
itself — C1's class of bug has not reappeared.

## 🔴 Critical (Round 3)

### C6. `[ ]` Tracked repo strays + gitignore holes: `dev.db`, `middleware.ts.old`, `uploads/` — SAFE NOW
- **Where:** Repo root. `dev.db` (147 KB SQLite binary, committed in the "Prisma upgrade to v7" commit) and `middleware.ts.old` are **tracked in git**. `.gitignore` covers `prisma/dev.db*` but not a root-level `dev.db`, and does not cover `uploads/` at all.
- **Why it matters:** The committed `dev.db` is a stale pre-migration schema with **0 employee rows** (verified via sqlite3), so no PII has leaked — but the ignore hole is live: anything that writes a root `dev.db` (a mis-set `DATABASE_URL=file:./dev.db` does exactly this) gets committed by the next `git add -A`. Same C2 failure mode, one directory up. `uploads/` is where onboarding compliance attachments land at runtime (`onboardingFanOutService` reads from it); it's empty today, but the first real upload becomes committable employee paperwork. `middleware.ts.old` still imports **next-auth** — dead since the better-auth migration — and is the kind of file that gets grepped and trusted.
- **Fix:** `git rm --cached dev.db middleware.ts.old`, delete both files, add `dev.db` and `/uploads/` to `.gitignore`.
- **Safe now?** Yes — 10 minutes, no code paths involved. (History rewrite to purge the old blob is optional; the data is empty-schema.)

## 🟡 Medium (Round 3)

### M17. `[ ]` Onboarding fan-out fabricates the new hire's email address — and sends mail to it — SAFE NOW (guard), decide real fix
- **Where:** `lib/services/onboardingFanOutService.ts:436-439` — `` `${preferredFirst.toLowerCase()}.${preferredLast.toLowerCase()}@${domain}` ``. The guess is interpolated into every template (`{email}` token) **and used as a live recipient** for the medical follow-up email (`:320-325`).
- **Why it matters:** Names with spaces ("Mary Jane"), apostrophes ("O'Brien"), or diacritics produce syntactically invalid addresses; duplicate names produce the *wrong valid* address. The medical follow-up then bounces or misdelivers silently — the exact category of quiet failure the compliance flow exists to prevent. It also mails PII-adjacent content (medical instructions) to an unverified address.
- **Fix:** Minimum: sanitize (strip to `[a-z.\-]`, collapse spaces to nothing or a hyphen) and log a warning when sanitization changed anything. Real fix: make the email an explicit field on the onboarding request (IT knows the convention; the approver can confirm it), falling back to the guess as a pre-filled default.
- **Safe now?** The sanitize+log guard, yes. The schema/form change should wait for an owner decision.

### M18. `[ ]` Email template interpolation does not HTML-escape values — SAFE NOW
- **Where:** `lib/services/emailTemplateService.ts:254-262` (`interpolate` does raw string replace); `lib/services/onboardingFanOutService.ts:183-187` (`buildProgramsList` concatenates `program.name`, `infoRequired`, reference-user names straight into `<li>` HTML).
- **Why it matters:** Free-text fields (HR/payroll/IT notes from the onboarding form, program names, employee names) flow into HTML email bodies unescaped. A note containing `<` or `&` renders broken; a deliberate `<img src=…>` or `<a href=…>` in a note is HTML injection into internal mail. Internal-only and low severity, but it's the classic slop-now/incident-later pattern.
- **Fix:** Add an `escapeHtml` helper; escape all vars in `interpolate` by default with an explicit raw-token allowlist for the two pre-rendered HTML tokens (`programs`, and `notes` if you choose to keep formatting — otherwise escape it too and wrap in `<pre>`/`<p>`).
- **Safe now?** Yes — templates are seeded/owned in-app; escaping value substitution can't break the surrounding template HTML.

### M19. `[ ]` Job runner: crashed jobs stay "Running" forever; job claim isn't atomic — SAFE NOW
- **Where:** `lib/jobs/jobRunner.ts:16-29` (findFirst → update, no status guard) and the absence of any startup recovery; `:105-109` (`setInterval` fires ticks without awaiting the previous one).
- **Why it matters:** If the process dies mid-job (deploy, crash), the row stays `Running` permanently — the runner only ever selects `Pending`, so that email/hardware request is silently never delivered and nothing surfaces it. Separately, the findFirst→update window plus non-serialized ticks means a slow tick can race a later one into double-processing the same job (double email). Low probability at one instance + 5 s polling, but both are structural.
- **Fix:** (1) In `startRunner`, sweep `Running` jobs whose `startedAt` is older than a timeout back to `Pending` (attempts+1). (2) Claim atomically: `updateMany({ where: { id, status: "Pending" }, data: { status: "Running", … } })` and skip if count === 0. (3) Optionally guard tick re-entry with a simple `isTicking` flag.
- **Safe now?** Yes — jobRunner has tests (`lib/jobs/__tests__`), and all three changes are behavior-preserving for the happy path.

### M20. `[ ]` Fan-out failures bypass the app log — SAFE NOW
- **Where:** `lib/services/onboardingFanOutService.ts:451-458` (rejected `Promise.allSettled` sections → `console.error`) and `:265-269` (oversized-attachment fallback → `console.error`).
- **Why it matters:** `mailService` writes every send/failure to `logService` (AppLog), so admins have one place to look — except the layer that decides *which* onboarding emails exist logs its failures only to stdout. A failed section means a manager/IT/medical email was never even enqueued, and the only trace evaporates with the console.
- **Fix:** Replace both `console.error`s with `logService.log(…, AppLogSeverity.Error, "onboardingFanOut")` (keep the console line if you like). Ten minutes; also fold these two spots into the M5 silent-failure sweep so they aren't double-counted.
- **Safe now?** Yes.

### M21. `[ ]` `scripts/migrate-training-images.mjs` is a broken duplicate of the `.ts` version — SAFE NOW
- **Where:** `scripts/migrate-training-images.{ts,mjs}` — same one-shot migration twice; the `.mjs` imports `../generated/prisma_client/index.js`, **which does not exist under Prisma v7** (no index in the generated client), and constructs `new PrismaClient()` without the required better-sqlite3 adapter. It cannot run.
- **Why it matters:** A dead, subtly-different copy of a data-migration script is exactly what someone runs by accident during an incident. Also raises the standing question of one-shot script retention (`backfill-ticket-expiry.ts`, `migrate-training-revisions.ts` have both shipped).
- **Fix:** Delete the `.mjs`. Then decide the same policy as P10 for shipped one-shot scripts: delete when confirmed run (git history keeps them) or move to `scripts/archive/`.
- **Safe now?** Deleting the `.mjs`, yes. The retention policy is an owner call.

## 🟢 Nice-to-have polish (Round 3)

### P11. `[ ]` Hardware integration placeholders are invisible-by-design — SAFE NOW (tracking only)
- `lib/jobs/handlers/hardwareRequest.ts:57` (`TODO: implement when hardware platform contract is confirmed`) and `lib/services/hardwareService.ts:21-30` (seeded `payloadTemplate`s containing literal `"<TODO>"`). Known-unfinished integration — fine — but nothing outside the code tracks it. Add it to whatever backlog is real (this file works) so the `<TODO>` payloads don't ship to a live hardware platform unnoticed.

### P12. `[ ]` Job runner settings are read once at startup — WAIT (only if it ever bites)
- `lib/jobs/jobRunner.ts:100-103`: `jobs.pollIntervalMs` / `maxRetries` / `retryBackoffMs` are admin-editable AppSettings, but changes take effect only on process restart, and nothing in the settings UI says so. Cheapest fix is a help-text note on those fields; re-reading per tick is overkill.

### P13. `[ ]` M7 remainder: `mdb-tools/` still awaiting the archive/delete call — unchanged from Round 1
- Still present (`convert_mdb.sh`, schema dump, script output). Listed so it doesn't fall off; the decision hasn't been made, the item hasn't rotted further.

## Updated order of attack (all open items, Rounds 1–3)

| # | Item | Size | Notes |
|---|------|------|-------|
| 1 | C6 untrack `dev.db` + `middleware.ts.old`, gitignore `dev.db`/`uploads/` | XS | same class as C2 |
| 2 | M21 delete broken `.mjs` migration script | XS | |
| 3 | M10 dedupe history helpers (fixes live REHIRE-label drift) | XS | Round 2 |
| 4 | M16 NaN guard on prior-employment route | XS | Round 2 |
| 5 | M20 fan-out failures → logService | XS | fold into M5 sweep |
| 6 | C5 + C4 zod pilot on rehire route (+ employees POST) | M | kills the date-guard bypass |
| 7 | M15 remove `as any` casts in employeeService | S | rides on #6 |
| 8 | M19 job-runner stuck-job recovery + atomic claim | S | |
| 9 | M18 HTML-escape email interpolation | S | |
| 10 | M17 sanitize guessed employee email (+ owner call on real fix) | S | |
| 11 | M11 history-tab double-fetch/race | S | Round 2 |
| 12 | M12 dark-mode tokens in duplicate dialog | S | Round 2 |
| 13 | M13 case-insensitive duplicate match | S | Round 2 |
| 14 | M14 typed `DuplicateMatch` payload | S | Round 2 |
| 15 | M6 AppError + `{ error }` shape | M | Round 1 |
| 16 | P7 / P8 / P9 / P11 / P12 small polish | XS each | |
| 17 | M3 / M2 big consolidations | L | Round 1 |
| 18 | M9 onboarding-form split (after rehire work is committed) | L | Round 1 |
| 19 | P10 / M21-policy / P13 — docs, scripts, mdb-tools retention calls | XS | owner decisions |
