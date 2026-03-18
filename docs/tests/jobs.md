# Job System Tests

## Overview

The background job system has 66 unit tests across 9 test files. All tests are written with [Vitest](https://vitest.dev/) and use `vi.mock` / `vi.hoisted` to isolate the unit under test from Prisma, the filesystem, and other services — no real database or disk I/O is performed.

**Run the tests:**
```bash
pnpm test          # single run
pnpm test:watch    # re-runs on file changes
```

**Test file locations:**
```
lib/jobs/__tests__/
├── jobQueue.test.ts
├── jobRunner.test.ts
└── handlers/
    ├── exemptionExpiry.test.ts
    ├── ticketExpiry.test.ts
    ├── requirementsCacheRebuild.test.ts
    ├── requirementsCacheInvalidate.test.ts
    ├── inactiveEmployeeCheck.test.ts
    ├── orphanedImageCleanup.test.ts
    └── historyArchival.test.ts
```

---

## Mocking approach

Each test file defines its mock objects inside `vi.hoisted()` so they are available when `vi.mock()` is hoisted to the top of the module by Vitest. The pattern looks like:

```ts
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = { someModel: { someMethod: vi.fn() } };
  return { mockPrisma };
});

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
```

This keeps each test file self-contained and avoids shared global state between test suites.

---

## `jobQueue.test.ts` — 5 tests

Tests the `enqueue()` function from `lib/jobs/jobQueue.ts`.

**Mocks:** `@/lib/prisma` (`backgroundJob.findFirst`, `backgroundJob.create`)

| Test | What it verifies |
|------|-----------------|
| Creates a job when no duplicate exists | When `findFirst` returns `null`, `create` is called with the correct `type` and `payload: null` |
| Skips creation when a duplicate pending job exists | When `findFirst` returns an existing job, `create` is not called |
| Serialises the payload as a JSON string | The payload object is stringified and passed to both `findFirst` (for deduplication) and `create` |
| Uses the provided `scheduledAt` date | When a future date is passed, it is forwarded to `create` unchanged |
| Defaults `scheduledAt` to now | When no date is passed, the created job's `scheduledAt` falls within the time window of the test call |

**Why these matter:** Deduplication is a critical correctness property — without it, rapid record saves could flood the queue with redundant invalidation jobs. The `scheduledAt` default ensures jobs are picked up immediately rather than waiting indefinitely.

---

## `jobRunner.test.ts` — 5 tests

Tests the poll loop and handler dispatch in `lib/jobs/jobRunner.ts` by starting the runner for 150 ms and then stopping it.

**Mocks:** `@/lib/prisma` (`backgroundJob.findFirst`, `backgroundJob.update`), `@/lib/services/appSettingService` (returns `pollIntervalMs: "100"` so tests complete quickly)

| Test | What it verifies |
|------|-----------------|
| Does not call `update` when there are no pending jobs | When `findFirst` returns `null`, `update` is never called |
| Marks Running then Completed on handler success | `update` is called twice: once with `status: Running`, once with `status: Completed` and the serialised `resultSummary` |
| Marks Failed when the handler throws | `update` is called with `status: Failed` and the error message |
| Marks Failed when no handler is registered | If the job type has no registered handler, `update` is called with `status: Failed` and an error message containing "No handler registered" |
| Deserialises the payload JSON and passes it to the handler | The handler receives the parsed object, not the raw JSON string |

**Why these matters:** The runner is the core of the job system. These tests verify the full lifecycle of a job — from pending to terminal state — and ensure that errors in handlers are captured rather than crashing the process.

---

## `exemptionExpiry.test.ts` — 6 tests

Tests `lib/jobs/handlers/exemptionExpiry.ts`.

**Mocks:** `@/lib/prisma` (`trainingTicketExemption.findMany`, `trainingTicketExemption.updateMany`), `@/lib/jobs/jobQueue` (`enqueue`)

| Test | What it verifies |
|------|-----------------|
| Returns `{ expired: 0 }` and skips `updateMany` when no exemptions found | Early-exit path when there is nothing to expire |
| Updates matching exemptions to `Expired` status | `updateMany` is called with `{ id: { in: [...] }, data: { status: "Expired" } }` |
| Enqueues cache invalidation for each unique employee | `enqueue("REQUIREMENTS_CACHE_INVALIDATE", { employeeId })` is called once per distinct employee |
| Deduplicates employees | Two exemptions belonging to the same employee produce only one `enqueue` call |
| Returns the correct `expired` and `employeesAffected` counts | The return shape is `{ expired: N, employeesAffected: M }` |
| Queries only `Active` exemptions with `endDate` at or before now | The `findMany` `where` clause contains `status: "Active"` and `endDate: { lte: <Date> }` |

**Why these matter:** The deduplication test is particularly important — without it, one employee with two expiring exemptions would trigger two cache rebuilds instead of one. The query shape test guards against accidentally fetching Revoked or future exemptions.

---

## `ticketExpiry.test.ts` — 4 tests

Tests `lib/jobs/handlers/ticketExpiry.ts`.

**Mocks:** `@/lib/prisma` (`ticketRecords.count`)

| Test | What it verifies |
|------|-----------------|
| Returns `expired` and `expiringSoon` counts | Both `count` results are returned in the correct shape |
| Returns zeros when there are no expired or expiring tickets | The zero case is handled without errors |
| Expired query uses `expiryDate: { lte: now }` | The first `count` call has the correct date filter |
| Expiring-soon window is approximately 30 days from now | The `gt`/`lte` bounds span roughly 30 days, confirming the window hasn't silently changed |

**Why these matter:** The 30-day window test catches accidental changes to the lookahead duration. Because this handler is reporting-only, the tests focus on query correctness rather than mutations.

---

## `inactiveEmployeeCheck.test.ts` — 4 tests

Tests `lib/jobs/handlers/inactiveEmployeeCheck.ts`.

**Mocks:** `@/lib/prisma` (`employee.updateMany`)

| Test | What it verifies |
|------|-----------------|
| Calls `updateMany` with `isActive: true` and `finishDate: { lte: now }` | The where clause correctly targets only currently-active employees whose finish date has passed |
| Sets `isActive: false` on matched employees | The data clause is correct |
| Returns the deactivated count from `updateMany` | The return value mirrors `updateMany`'s `count` |
| Returns `{ deactivated: 0 }` when no employees are past their finish date | Zero case handled correctly |

**Why these matter:** An incorrect `where` clause here could accidentally deactivate employees who are still active, or miss employees who should be deactivated. The tests pin both the filter and the mutation data.

---

## `historyArchival.test.ts` — 6 tests

Tests `lib/jobs/handlers/historyArchival.ts`.

**Mocks:** `@/lib/prisma` (`history.findMany`, `history.deleteMany`), `@/lib/services/appSettingService` (`getSettings`)

| Test | What it verifies |
|------|-----------------|
| Returns `{ deleted: 0 }` and skips `deleteMany` when no eligible records | When `findMany` immediately returns `[]`, `deleteMany` is never called |
| Reads `retentionYears` from app settings | The configured value is used, not a hardcoded constant |
| Defaults to 7 years when the setting is absent | Missing configuration falls back safely |
| Cutoff date is exactly `retentionYears` ago | The calculated cutoff is within a ±1 day tolerance of the expected value |
| Deletes all records in a single batch | `deleteMany` is called once with the correct ID list |
| Loops until no records remain (two-batch scenario) | `deleteMany` is called twice and the total `deleted` count accumulates correctly |

**Why these matter:** The batch loop and accumulator tests protect against a common bug where early-exit logic breaks multi-batch deletions. The settings tests ensure the retention policy is genuinely configurable rather than effectively hardcoded.

---

## `orphanedImageCleanup.test.ts` — 8 tests

Tests `lib/jobs/handlers/orphanedImageCleanup.ts`.

**Mocks:** `@/lib/prisma` (`trainingImage.findMany/deleteMany`, `ticketImage.findMany/deleteMany`), `fs` (module-level mock via `vi.mock("fs")`)

The `fs` mock uses `vi.mocked(fs.existsSync)`, `vi.mocked(fs.readdirSync)`, and `vi.mocked(fs.unlinkSync)` to simulate the filesystem without touching disk.

### DB records without files on disk

| Test | What it verifies |
|------|-----------------|
| Deletes training image records whose file is missing | `trainingImage.deleteMany` is called with the correct IDs |
| Does NOT delete training image records whose file exists | `trainingImage.deleteMany` is not called when `existsSync` returns `true` |
| Deletes ticket image records whose file is missing | Same as above for ticket images |
| Accumulates `orphanedDbRecords` across both image types | The return count reflects deletions from both tables |

### Files on disk without DB records

| Test | What it verifies |
|------|-----------------|
| Does not scan when the uploads directory does not exist | `readdirSync` is never called; `orphanedFiles` is `0` |
| Deletes disk files not referenced in the DB | `unlinkSync` is called with the correct path |
| Does NOT delete disk files that ARE referenced in the DB | `unlinkSync` is not called when the file path is in the DB |

### Return value

| Test | What it verifies |
|------|-----------------|
| Returns `{ orphanedDbRecords: 0, orphanedFiles: 0 }` when everything is clean | Zero case for both phases |

**Why these matter:** Without the filesystem mock, these tests would require real files and would be sensitive to the test environment. Mocking `fs` lets us precisely control which files "exist" and verify that the handler responds correctly to each case.

---

## `requirementsCacheRebuild.test.ts` — 14 tests

Tests `lib/jobs/handlers/requirementsCacheRebuild.ts`, which is the most complex handler.

**Mocks:** `@/lib/prisma` (employee, trainingRequirement, ticketRequirement, trainingRecords, ticketRecords, trainingTicketExemption, requirementsCacheEntry, `$transaction`)

Each test configures only the Prisma calls relevant to the scenario being tested; the `beforeEach` block defaults everything to empty arrays.

### Basics

| Test | What it verifies |
|------|-----------------|
| Returns `{ totalEntries: 0, employeesProcessed: 0 }` with no employees | Zero base case |
| Calls `$transaction` and `deleteMany({})` | The full wipe always happens before the insert |

### Training requirement matching

| Test | What it verifies |
|------|-----------------|
| Exact dept/loc match → Training entry created | The happy path for a new unmet training requirement |
| Completed training → no entry | A matching training record removes the item from the cache |
| Exempted training → no entry | An `Active` exemption of type `Training` suppresses the entry |
| Inactive training → no entry | A requirement whose training has `isActive: false` is skipped |
| Wildcard `departmentId: -1` matches any department | Any employee in the right location gets the entry |
| Wildcard `locationId: -1` matches any location | Any employee in the right department gets the entry |
| Wrong department → no entry | Non-matching department is correctly filtered out |
| Wrong location → no entry | Non-matching location is correctly filtered out |

### Ticket requirement matching

| Test | What it verifies |
|------|-----------------|
| Exact match → Ticket entry created | Happy path for tickets |
| Already holds ticket → no entry | Existing ticket record suppresses the entry |
| Exempted ticket → no entry | Active exemption of type `Ticket` suppresses the entry |
| Inactive ticket → no entry | `isActive: false` on the ticket skips the requirement |

### Multi-employee

| Test | What it verifies |
|------|-----------------|
| Two employees, requirement matches only one | Both are counted in `employeesProcessed`; only the matching employee gets a cache entry |

**Why these matter:** The matching logic (exact, wildcard, exclusions) is the core business rule of the entire requirements system. These tests document every branching condition so that future changes to the matching algorithm have an explicit, failing test to catch regressions.

---

## `requirementsCacheInvalidate.test.ts` — 14 tests

Tests `lib/jobs/handlers/requirementsCacheInvalidate.ts`, which performs the same logic as the full rebuild but scoped to a single employee.

**Mocks:** Same as rebuild tests, plus `employee.findUnique`.

### Validation

| Test | What it verifies |
|------|-----------------|
| Throws when `employeeId` is missing from the payload | Missing payload is rejected with a descriptive error |

### Inactive / missing employee

| Test | What it verifies |
|------|-----------------|
| Employee not found → clears cache and returns `{ cleared: true }` | `deleteMany({ where: { employeeId } })` is called; no `$transaction` for rebuild |
| Employee inactive → clears cache and returns `{ cleared: true }` | Same as above for `isActive: false` |

### Training requirements (active employee)

| Test | What it verifies |
|------|-----------------|
| Unmet training req → entry created | Happy path |
| Completed training → no entry | Training record suppresses the entry |
| Exempted training → no entry | Active Training exemption suppresses the entry |
| Inactive training → no entry | `isActive: false` skips the requirement |

### Ticket requirements (active employee)

| Test | What it verifies |
|------|-----------------|
| Unmet ticket req → entry created | Happy path |
| Already holds ticket → no entry | Ticket record suppresses the entry |
| Exempted ticket → no entry | Active Ticket exemption suppresses the entry |
| Inactive ticket → no entry | `isActive: false` skips the requirement |

### Transaction

| Test | What it verifies |
|------|-----------------|
| Wraps `deleteMany` and `createMany` in a `$transaction` | The employee's old entries are wiped and replaced atomically |

**Why these matter:** The "cleared" path tests are distinct from the rebuild handler — they confirm that an employee who leaves or has their account deactivated gets their cache entries removed rather than stale data lingering. The transaction test protects against a future refactor that accidentally loses atomicity.
