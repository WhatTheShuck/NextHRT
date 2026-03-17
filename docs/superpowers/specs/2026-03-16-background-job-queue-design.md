# Background Job Queue — Design Spec

**Date:** 2026-03-16
**Status:** Approved

## Overview

An in-process, SQLite-backed job queue for the HRT Improved app. Runs inside the existing Next.js Docker container with no additional services. Provides scheduled maintenance jobs, event-driven cache invalidation, and an admin dashboard for visibility and manual control.

---

## Schema

### `BackgroundJob`

The queue and history log in one table.

| Field | Type | Notes |
|---|---|---|
| `id` | Int (PK) | autoincrement |
| `type` | JobType (enum) | see below |
| `status` | JobStatus (enum) | Pending \| Running \| Completed \| Failed |
| `payload` | String? | JSON — job-specific input e.g. `{ employeeId: 5 }` |
| `resultSummary` | String? | JSON — what the job did e.g. `{ expired: 3 }` |
| `errorMessage` | String? | populated on failure |
| `scheduledAt` | DateTime | when the job should run, default now() |
| `startedAt` | DateTime? | |
| `completedAt` | DateTime? | |
| `createdAt` | DateTime | |

**`JobType` enum**
- `EXEMPTION_EXPIRY`
- `TICKET_EXPIRY`
- `REQUIREMENTS_CACHE_REBUILD`
- `REQUIREMENTS_CACHE_INVALIDATE`
- `INACTIVE_EMPLOYEE_CHECK`
- `ORPHANED_IMAGE_CLEANUP`
- `HISTORY_ARCHIVAL`

**`JobStatus` enum**
- `Pending`
- `Running`
- `Completed`
- `Failed`

---

### `RequirementsCacheEntry`

Full snapshot of all outstanding (incomplete, non-exempt) requirements across the org.

| Field | Type | Notes |
|---|---|---|
| `id` | Int (PK) | autoincrement |
| `employeeId` | Int | FK → Employee |
| `itemType` | CacheItemType (enum) | Training \| Ticket |
| `itemId` | Int | trainingId or ticketId |
| `updatedAt` | DateTime | |

**Indexes:** `@@index([employeeId])`, `@@index([itemType, itemId])`
**Unique:** `@@unique([employeeId, itemType, itemId])` — makes upserts idempotent

The two indexes serve both report views:
- Employee needs analysis → filter by `employeeId`
- Training/ticket needs analysis → filter by `(itemType, itemId)`

---

### `AppSetting` additions

Two new keys added via `ensureDefaults()` — no new model needed.

| Key | Default | Description |
|---|---|---|
| `jobs.historyRetentionYears` | `"7"` | History records older than this are eligible for pruning |
| `jobs.pollIntervalMs` | `"5000"` | How often the job runner polls for pending work |

---

## Job Runner Architecture

All job code lives in `lib/jobs/`.

### `lib/jobs/jobQueue.ts`

Single `enqueue(type, payload?, scheduledAt?)` function. Writes a `BackgroundJob` row with `status: Pending`.

**Deduplication:** Before inserting, checks for an existing `Pending` job of the same type and payload. If found, skips the insert. Prevents duplicate jobs when multiple mutations fire in quick succession for the same employee.

---

### `lib/jobs/handlers/`

One file per job type. Each exports a single async function `(payload?) => resultSummary`. No queue awareness — pure business logic only.

```
handlers/exemptionExpiry.ts         — find Active exemptions where endDate <= now(), set to Expired
handlers/ticketExpiry.ts            — flag TicketRecords where expiryDate <= now() (reporting/notifications)
handlers/requirementsCacheRebuild.ts — full wipe and rebuild of RequirementsCacheEntry table
handlers/requirementsCacheInvalidate.ts — recalc single employee's cache entries (payload: { employeeId })
handlers/inactiveEmployeeCheck.ts   — flip isActive=false where finishDate <= now()
handlers/orphanedImageCleanup.ts    — reconcile image files on disk vs DB records
handlers/historyArchival.ts         — delete History records older than configured threshold
```

---

### `lib/jobs/jobRunner.ts`

Poll loop started on app boot. Every N ms (from `AppSetting`):

1. Find the oldest `Pending` job where `scheduledAt <= now()`
2. Mark it `Running`, set `startedAt`
3. Dispatch to the matching handler
4. On success: mark `Completed`, write `resultSummary`, set `completedAt`
5. On failure: mark `Failed`, write `errorMessage`

Processes one job per tick to keep SQLite write pressure low.

---

### `lib/jobs/scheduler.ts`

node-cron setup. Enqueues scheduled jobs on their respective triggers.

| Schedule | Jobs |
|---|---|
| Daily at midnight | `EXEMPTION_EXPIRY`, `TICKET_EXPIRY`, `INACTIVE_EMPLOYEE_CHECK` |
| Weekly (Sunday 2am) | `ORPHANED_IMAGE_CLEANUP` |
| On first boot only | `REQUIREMENTS_CACHE_REBUILD` (cache warm) |
| Manual only | `HISTORY_ARCHIVAL` |

`REQUIREMENTS_CACHE_INVALIDATE` is never scheduled — only triggered by mutations.

---

### `instrumentation.ts` (repo root)

Next.js server startup hook. Imports and starts both `jobRunner` and `scheduler`. Correct App Router pattern for in-process background work.

---

## Integration Points

### Targeted invalidation — `REQUIREMENTS_CACHE_INVALIDATE` with `{ employeeId }`

Enqueued when an individual's compliance state changes:

| Service | Triggers |
|---|---|
| `trainingRecordService` | create, update, delete |
| `ticketRecordService` | create, update, delete |
| `exemptionService` | create, update (including status changes), delete |
| `employeeService` | update — only when `departmentId` or `locationId` changes |

### Full rebuild — `REQUIREMENTS_CACHE_REBUILD` (no payload)

Enqueued when requirements themselves change, affecting an unknown number of employees:

| Service | Triggers |
|---|---|
| `trainingService` | create, update (requirements changed or `isActive` toggled), delete |
| `ticketService` | create, update (requirements changed or `isActive` toggled), delete |

---

## Admin Dashboard — `/admin/jobs`

Admin-only page. Three sections:

### 1. Scheduled Jobs
Card grid — one card per recurring job type. Shows: name, description, cron schedule, last run time, last run status, "Run Now" button (enqueues immediately).

### 2. Job Queue & History
Paginated table of all `BackgroundJob` rows, newest first. Columns: type, status badge, scheduled at, started at, completed at, result summary, error message. Filterable by status and job type.

### 3. History Archival
Separate card with confirmation step:
- Retention threshold (read from `AppSetting`, editable inline)
- Live count: "1,243 records are older than 7 years"
- "Start Pruning" button — enqueues `HISTORY_ARCHIVAL`, disabled when count is zero or job is already queued
- Button shows "Pruning job queued" after enqueue until job completes

Count is a single `COUNT(*)` query on page load. Deletion happens in the background job, not the API route.

---

## Job Descriptions

| Job | Schedule | What it does |
|---|---|---|
| `EXEMPTION_EXPIRY` | Daily midnight | Finds `Active` exemptions where `endDate <= now()`, updates status to `Expired`, enqueues `REQUIREMENTS_CACHE_INVALIDATE` for each affected employee |
| `TICKET_EXPIRY` | Daily midnight | Identifies ticket records past `expiryDate` for reporting and future notifications |
| `REQUIREMENTS_CACHE_REBUILD` | Boot + on requirement change | Wipes `RequirementsCacheEntry` and rebuilds from scratch using `requirementService` logic |
| `REQUIREMENTS_CACHE_INVALIDATE` | On mutation | Recalculates cache entries for a single employee |
| `INACTIVE_EMPLOYEE_CHECK` | Daily midnight | Flips `isActive = false` on employees where `finishDate <= now()` |
| `ORPHANED_IMAGE_CLEANUP` | Weekly Sunday 2am | Reconciles `TrainingImage`/`TicketImage` DB records against files on disk, removes orphans from both |
| `HISTORY_ARCHIVAL` | Manual only | Deletes `History` records older than configured retention threshold (default 7 years), in batches |

---

## File Structure

```
lib/jobs/
  index.ts                          — exports start() which initialises runner + scheduler
  jobQueue.ts                       — enqueue() with deduplication
  jobRunner.ts                      — poll loop
  scheduler.ts                      — node-cron setup
  handlers/
    exemptionExpiry.ts
    ticketExpiry.ts
    requirementsCacheRebuild.ts
    requirementsCacheInvalidate.ts
    inactiveEmployeeCheck.ts
    orphanedImageCleanup.ts
    historyArchival.ts

instrumentation.ts                  — Next.js startup hook, calls lib/jobs/index.ts start()

app/admin/jobs/
  page.tsx                          — server component, auth guard
  jobs-page-content.tsx             — client component, dashboard UI
  scheduled-jobs-card.tsx
  job-history-table.tsx
  history-archival-card.tsx

app/api/jobs/
  route.ts                          — GET (fetch jobs), POST (enqueue manual trigger)
  archival-count/
    route.ts                        — GET count of history records past threshold
```
