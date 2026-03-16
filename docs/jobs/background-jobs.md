# Background Jobs

## Overview

HRT Improved runs a set of background jobs to automate time-sensitive maintenance tasks: expiring old exemptions, deactivating past employees, cleaning up orphaned files, and keeping the requirements cache up to date. These run inside the same Node.js process as the Next.js application — no external queue infrastructure (Redis, SQS, etc.) is needed.

Jobs are backed by a SQLite table (`BackgroundJob`) which doubles as both the work queue and a persistent history log. This fits the single-container deployment model where every run of the application is a single Docker container.

---

## Architecture

### How jobs move through the system

```
Scheduler (node-cron)          Service mutations
        │                              │
        └──────────┬───────────────────┘
                   ▼
              jobQueue.enqueue()
                   │
                   ▼
           BackgroundJob table
           status: Pending
                   │
                   ▼
           jobRunner.tick()   ← polls every N ms (default 5 s)
                   │
         ┌─────────▼─────────┐
         │  status: Running   │
         └────────────────────┘
                   │
         ┌────────┴────────┐
         ▼                 ▼
  status: Completed   status: Failed
  resultSummary       errorMessage
```

### Key files

| Path | Purpose |
|------|---------|
| `lib/jobs/jobQueue.ts` | `enqueue()` — inserts a job with deduplication |
| `lib/jobs/jobRunner.ts` | Poll loop; dispatches one job per tick |
| `lib/jobs/scheduler.ts` | node-cron schedules for recurring jobs |
| `lib/jobs/index.ts` | Entry point; registers all handlers and starts the system |
| `lib/jobs/handlers/` | One file per job type |
| `instrumentation.ts` | Next.js startup hook that calls `start()` |

### Startup

`instrumentation.ts` is the Next.js [instrumentation hook](https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation). It runs once when the Node.js runtime boots and calls `lib/jobs/index.ts → start()`, which:

1. Registers all job handlers.
2. Enqueues a boot-time `REQUIREMENTS_CACHE_REBUILD` to warm the cache.
3. Starts the poll runner.
4. Starts the cron scheduler.

### Poll runner

`jobRunner` uses `setInterval` to call `tick()` every `jobs.pollIntervalMs` milliseconds (configurable in **Admin → App Settings**, default 5 000 ms). Each tick:

- Finds the oldest `Pending` job whose `scheduledAt` is in the past.
- Updates it to `Running`.
- Calls the registered handler with the deserialized payload.
- Updates it to `Completed` (with `resultSummary`) or `Failed` (with `errorMessage`).

Only one job is processed per tick to keep SQLite write pressure low.

### Deduplication

`enqueue()` checks whether an identical `Pending` job (same `type` + `payload`) already exists before inserting. This prevents a buildup of redundant invalidation jobs when many records are saved in quick succession.

---

## Job Types

### `EXEMPTION_EXPIRY`

**Schedule:** Daily at midnight.

**What it does:** Finds all `Active` exemptions where `endDate <= now` and sets their status to `Expired`. For each unique employee affected, it enqueues a `REQUIREMENTS_CACHE_INVALIDATE` job so their cache entry reflects the change.

**Why:** Exemptions have an optional end date. Without this job, an exemption would stay `Active` indefinitely after it lapses, incorrectly shielding employees from requirements they are no longer exempt from.

---

### `TICKET_EXPIRY`

**Schedule:** Daily at midnight.

**What it does:** Counts ticket records where `expiryDate <= now` (expired) and where `expiryDate` falls within the next 30 days (expiring soon). Returns a summary; it does not mutate any records.

**Why:** Surfaces a daily snapshot of the expiry landscape, useful for the job history dashboard and as a foundation for future notification features.

---

### `INACTIVE_EMPLOYEE_CHECK`

**Schedule:** Daily at midnight.

**What it does:** Calls `employee.updateMany` to set `isActive = false` for all employees where `isActive = true` and `finishDate <= now`.

**Why:** Employee finish dates are set in advance. Without this job, a departed employee would remain active, appear in reports, and accumulate requirement entries.

---

### `REQUIREMENTS_CACHE_REBUILD`

**Schedule:** On boot; also triggered manually from the admin dashboard or when training/ticket definitions change.

**What it does:** Rebuilds the entire `RequirementsCacheEntry` table from scratch in a single `$transaction([deleteMany, createMany])`. For every active employee it computes which training and ticket requirements apply (matching by `departmentId` and `locationId`, with `-1` acting as a wildcard for "all"), then filters out completed and actively-exempted items.

**Why:** The requirements calculation is expensive — it crosses employees, requirements, records, and exemptions. Materialising the result in a dedicated table means report pages and needs-analysis queries can read a single pre-computed table rather than recomputing on every request.

The cache is also invalidated at a targeted level (see `REQUIREMENTS_CACHE_INVALIDATE`) whenever individual records change, so a full rebuild is only needed on boot or when the requirement definitions themselves change.

**Department / location matching rules:**

| `departmentId` | `locationId` | Matches employee |
|---|---|---|
| Specific value | Specific value | Only that exact combination |
| `-1` | Specific value | Any department at that location |
| Specific value | `-1` | That department at any location |
| `-1` | `-1` | All employees |

---

### `REQUIREMENTS_CACHE_INVALIDATE`

**Schedule:** Triggered automatically after any create/update/delete on `TrainingRecords`, `TicketRecords`, or `TrainingTicketExemption`. Also triggered by `EXEMPTION_EXPIRY` for each affected employee.

**Payload:** `{ employeeId: number }`

**What it does:** Rebuilds the `RequirementsCacheEntry` rows for a single employee. If the employee no longer exists or is inactive, their cache entries are wiped and the handler exits without reinserting. Otherwise it runs the same requirement-matching logic as the full rebuild but scoped to one person, wrapped in a `$transaction`.

**Why:** A full cache rebuild on every record save would be expensive and would introduce unnecessary churn for unrelated employees. Targeted invalidation means only the affected employee's rows are touched.

---

### `ORPHANED_IMAGE_CLEANUP`

**Schedule:** Weekly, Sunday at 2 am.

**What it does:** Two-phase cleanup:

1. **DB → disk:** Finds all `TrainingImage` and `TicketImage` records in the database, checks whether the file referenced by `imagePath` exists on disk. If not, deletes the DB record.
2. **Disk → DB:** Recursively scans the `uploads/` directory. Any file not referenced by any DB record is deleted from disk.

**Why:** Image files can become orphaned when records are deleted without their associated files being cleaned up, or if a file upload partially fails. This job prevents silent disk and database bloat.

---

### `HISTORY_ARCHIVAL`

**Schedule:** On-demand from the admin dashboard only.

**What it does:** Reads the `jobs.historyRetentionYears` setting (default 7 years) and deletes `History` records older than the cutoff date in batches of 500 to avoid long SQLite locks.

**Why:** Every create, update, and delete in the application writes a history row. Over time this table can become very large. Archival keeps it manageable while respecting configurable retention requirements.

**Admin confirmation:** The admin dashboard shows the number of eligible records and their cutoff date before the job can be triggered, requiring explicit confirmation before deletion proceeds. This job is intentionally never scheduled automatically.

---

## Admin Dashboard

The job dashboard lives at `/admin/jobs` and is accessible to Admin users only.

**Scheduled Jobs card:** Lists all job types with their schedule and a "Run now" button. Any job can be triggered manually at any time.

**Job History table:** Paginated log of all `BackgroundJob` records with status/type filters, duration, and result or error message. Auto-refreshable.

**History Archival card:** Shows the current retention policy, the cutoff date, and the number of eligible records. Displays a confirmation dialog before triggering the `HISTORY_ARCHIVAL` job.

---

## Configuration

These settings are managed in **Admin → App Settings** and are stored in the `AppSetting` table so they can be changed at runtime without redeploying.

| Key | Default | Description |
|-----|---------|-------------|
| `jobs.pollIntervalMs` | `5000` | How often the runner polls for pending jobs (milliseconds) |
| `jobs.historyRetentionYears` | `7` | How many years of history to retain before archival |

---

## Cache Invalidation Strategy

There are two granularities of cache invalidation:

**Targeted (`REQUIREMENTS_CACHE_INVALIDATE`):** Triggered by mutations to individual records (training records, ticket records, exemptions). Only the affected employee's cache entries are recalculated. Fast and low-impact.

**Full rebuild (`REQUIREMENTS_CACHE_REBUILD`):** Triggered when the requirement definitions change (training or ticket create/update/delete). Because a requirement change can affect an unknown number of employees, a full rebuild is necessary. Also runs on application boot to warm the cache from a cold start.

This two-tier approach avoids unnecessary work while keeping the cache consistent.

---

## Adding a New Job

1. Create a handler in `lib/jobs/handlers/yourJob.ts` following the signature:
   ```ts
   export async function yourJobHandler(
     payload: Record<string, unknown>,
   ): Promise<Record<string, unknown>> {
     // ...
     return { summary: "data" };
   }
   ```

2. Add the new job type to the `JobType` enum in `prisma/schema.prisma` and run `pnpm prisma db push && pnpm prisma generate`.

3. Register the handler in `lib/jobs/index.ts`:
   ```ts
   registerHandler("YOUR_JOB", yourJobHandler);
   ```

4. Optionally schedule it in `lib/jobs/scheduler.ts` using a node-cron expression.

5. Add the job type to the `SCHEDULED_JOBS` list in `app/admin/jobs/scheduled-jobs-card.tsx` so it appears in the dashboard.

6. Write tests in `lib/jobs/__tests__/handlers/yourJob.test.ts`.
