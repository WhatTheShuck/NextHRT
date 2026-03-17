# Background Job Queue Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a SQLite-backed in-process job queue with scheduled maintenance jobs, event-driven cache invalidation, and an admin dashboard.

**Architecture:** A `BackgroundJob` table serves as both queue and history log. A poll loop runs inside the Next.js process (started via `instrumentation.ts`), picking up `Pending` jobs and dispatching to typed handlers. Data mutations enqueue targeted invalidation jobs; a node-cron scheduler enqueues time-based jobs.

**Tech Stack:** Next.js 16 App Router, Prisma 7 (SQLite), node-cron, TypeScript. No new infrastructure required.

**Spec:** `docs/superpowers/specs/2026-03-16-background-job-queue-design.md`

---

## File Map

### New files
```
prisma/schema.prisma                              — add BackgroundJob, RequirementsCacheEntry, enums
lib/jobs/index.ts                                 — exports start() to init runner + scheduler
lib/jobs/jobQueue.ts                              — enqueue() with deduplication
lib/jobs/jobRunner.ts                             — poll loop, dispatches to handlers
lib/jobs/scheduler.ts                             — node-cron setup for time-based jobs
lib/jobs/handlers/exemptionExpiry.ts
lib/jobs/handlers/ticketExpiry.ts
lib/jobs/handlers/requirementsCacheRebuild.ts
lib/jobs/handlers/requirementsCacheInvalidate.ts
lib/jobs/handlers/inactiveEmployeeCheck.ts
lib/jobs/handlers/orphanedImageCleanup.ts
lib/jobs/handlers/historyArchival.ts
instrumentation.ts                                — Next.js startup hook, calls lib/jobs/index.ts
app/api/jobs/route.ts                             — GET (list jobs + status), POST (manual trigger)
app/api/jobs/archival-count/route.ts              — GET count of history records past threshold
app/admin/jobs/page.tsx                           — server component, Admin auth guard
app/admin/jobs/jobs-page-content.tsx              — client component, assembles dashboard
app/admin/jobs/scheduled-jobs-card.tsx            — grid of scheduled jobs with Run Now buttons
app/admin/jobs/job-history-table.tsx              — paginated filterable job history
app/admin/jobs/history-archival-card.tsx          — archival count + confirm + enqueue UI
```

### Modified files
```
lib/services/appSettingService.ts                 — add jobs.* setting defaults
lib/services/trainingRecordService.ts             — enqueue REQUIREMENTS_CACHE_INVALIDATE on mutations
lib/services/ticketRecordService.ts               — enqueue REQUIREMENTS_CACHE_INVALIDATE on mutations
lib/services/exemptionService.ts                  — enqueue REQUIREMENTS_CACHE_INVALIDATE on mutations
lib/services/trainingService.ts                   — enqueue REQUIREMENTS_CACHE_REBUILD on mutations
lib/services/ticketService.ts                     — enqueue REQUIREMENTS_CACHE_REBUILD on mutations
lib/data.ts                                       — add Jobs link to admin nav
next.config.ts                                    — enable instrumentationHook
```

---

## Chunk 1: Schema + Core Infrastructure

### Task 1: Schema — add BackgroundJob and RequirementsCacheEntry

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Add enums and models** to `prisma/schema.prisma`:

```prisma
enum JobType {
  EXEMPTION_EXPIRY
  TICKET_EXPIRY
  REQUIREMENTS_CACHE_REBUILD
  REQUIREMENTS_CACHE_INVALIDATE
  INACTIVE_EMPLOYEE_CHECK
  ORPHANED_IMAGE_CLEANUP
  HISTORY_ARCHIVAL
}

enum JobStatus {
  Pending
  Running
  Completed
  Failed
}

enum CacheItemType {
  Training
  Ticket
}

model BackgroundJob {
  id            Int       @id @default(autoincrement())
  type          JobType
  status        JobStatus @default(Pending)
  payload       String?   // JSON string
  resultSummary String?   // JSON string
  errorMessage  String?
  scheduledAt   DateTime  @default(now())
  startedAt     DateTime?
  completedAt   DateTime?
  createdAt     DateTime  @default(now())

  @@index([status, scheduledAt])
  @@index([type])
}

model RequirementsCacheEntry {
  id         Int           @id @default(autoincrement())
  employeeId Int
  itemType   CacheItemType
  itemId     Int
  updatedAt  DateTime      @updatedAt

  employee   Employee      @relation(fields: [employeeId], references: [id], onDelete: Cascade)

  @@unique([employeeId, itemType, itemId])
  @@index([employeeId])
  @@index([itemType, itemId])
}
```

- [ ] **Add `requirementsCacheEntries` relation to `Employee` model** in `prisma/schema.prisma`:

```prisma
// Inside model Employee, add:
requirementsCacheEntries RequirementsCacheEntry[]
```

- [ ] **Push schema to DB:**

```bash
pnpm prisma db push
```

Expected: "Your database is now in sync with your Prisma schema."

- [ ] **Verify generated client** has the new types:

```bash
grep -r "BackgroundJob\|RequirementsCacheEntry" generated/prisma_client/client.d.ts | head -5
```

Expected: both model names appear.

---

### Task 2: Add job setting defaults to AppSettingService

**Files:**
- Modify: `lib/services/appSettingService.ts`

- [ ] **Add two new entries** to `SETTING_DEFAULTS` array in `lib/services/appSettingService.ts`:

```typescript
{
  key: "jobs.historyRetentionYears",
  envVar: "JOBS_HISTORY_RETENTION_YEARS",
  defaultValue: "7",
  description: "History records older than this many years are eligible for pruning",
},
{
  key: "jobs.pollIntervalMs",
  envVar: "JOBS_POLL_INTERVAL_MS",
  defaultValue: "5000",
  description: "How often the job runner polls for pending work (milliseconds)",
},
```

- [ ] **Verify no TS errors:**

```bash
pnpm tsc --noEmit 2>&1 | grep appSettingService
```

Expected: no output.

---

### Task 3: Install node-cron

**Files:**
- `package.json` (modified by pnpm)

- [ ] **Install node-cron and its types:**

```bash
pnpm add node-cron
pnpm add -D @types/node-cron
```

- [ ] **Verify install:**

```bash
grep "node-cron" package.json
```

Expected: `"node-cron": "^X.X.X"` appears in dependencies.

---

### Task 4: Job queue — enqueue with deduplication

**Files:**
- Create: `lib/jobs/jobQueue.ts`

- [ ] **Create `lib/jobs/jobQueue.ts`:**

```typescript
import prisma from "@/lib/prisma";
import { JobType } from "@/generated/prisma_client/client";

export async function enqueue(
  type: JobType,
  payload?: Record<string, unknown>,
  scheduledAt?: Date,
): Promise<void> {
  const payloadStr = payload ? JSON.stringify(payload) : null;

  // Deduplication: skip if an identical Pending job already exists
  const existing = await prisma.backgroundJob.findFirst({
    where: {
      type,
      status: "Pending",
      payload: payloadStr,
    },
  });

  if (existing) return;

  await prisma.backgroundJob.create({
    data: {
      type,
      payload: payloadStr,
      scheduledAt: scheduledAt ?? new Date(),
    },
  });
}
```

- [ ] **Verify no TS errors:**

```bash
pnpm tsc --noEmit 2>&1 | grep jobQueue
```

Expected: no output.

---

### Task 5: Job runner — poll loop + handler registry

**Files:**
- Create: `lib/jobs/jobRunner.ts`

- [ ] **Create `lib/jobs/jobRunner.ts`:**

```typescript
import prisma from "@/lib/prisma";
import { JobType } from "@/generated/prisma_client/client";
import { appSettingService } from "@/lib/services/appSettingService";

type HandlerFn = (payload: Record<string, unknown>) => Promise<Record<string, unknown>>;

const handlers = new Map<JobType, HandlerFn>();

export function registerHandler(type: JobType, handler: HandlerFn): void {
  handlers.set(type, handler);
}

async function tick(): Promise<void> {
  const job = await prisma.backgroundJob.findFirst({
    where: {
      status: "Pending",
      scheduledAt: { lte: new Date() },
    },
    orderBy: { scheduledAt: "asc" },
  });

  if (!job) return;

  await prisma.backgroundJob.update({
    where: { id: job.id },
    data: { status: "Running", startedAt: new Date() },
  });

  const handler = handlers.get(job.type);

  if (!handler) {
    await prisma.backgroundJob.update({
      where: { id: job.id },
      data: {
        status: "Failed",
        errorMessage: `No handler registered for job type: ${job.type}`,
        completedAt: new Date(),
      },
    });
    return;
  }

  try {
    const payload = job.payload ? JSON.parse(job.payload) : {};
    const result = await handler(payload);
    await prisma.backgroundJob.update({
      where: { id: job.id },
      data: {
        status: "Completed",
        resultSummary: JSON.stringify(result),
        completedAt: new Date(),
      },
    });
  } catch (err) {
    await prisma.backgroundJob.update({
      where: { id: job.id },
      data: {
        status: "Failed",
        errorMessage: err instanceof Error ? err.message : String(err),
        completedAt: new Date(),
      },
    });
  }
}

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export async function startRunner(): Promise<void> {
  if (intervalHandle) return; // already running

  const settings = await appSettingService.getSettings();
  const intervalMs = parseInt(settings["jobs.pollIntervalMs"] ?? "5000", 10);

  intervalHandle = setInterval(() => {
    tick().catch((err) =>
      console.error("[JobRunner] Unhandled tick error:", err),
    );
  }, intervalMs);

  console.log(`[JobRunner] Started — polling every ${intervalMs}ms`);
}

export function stopRunner(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
```

- [ ] **Verify no TS errors:**

```bash
pnpm tsc --noEmit 2>&1 | grep jobRunner
```

Expected: no output.

---

## Chunk 2: Job Handlers

### Task 6: Handler — exemptionExpiry

**Files:**
- Create: `lib/jobs/handlers/exemptionExpiry.ts`

- [ ] **Create `lib/jobs/handlers/exemptionExpiry.ts`:**

```typescript
import prisma from "@/lib/prisma";
import { enqueue } from "@/lib/jobs/jobQueue";

export async function exemptionExpiryHandler(
  _payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const now = new Date();

  const expiredExemptions = await prisma.trainingTicketExemption.findMany({
    where: {
      status: "Active",
      endDate: { lte: now },
    },
    select: { id: true, employeeId: true },
  });

  if (expiredExemptions.length === 0) {
    return { expired: 0 };
  }

  const ids = expiredExemptions.map((e) => e.id);

  await prisma.trainingTicketExemption.updateMany({
    where: { id: { in: ids } },
    data: { status: "Expired" },
  });

  // Invalidate cache for each affected employee
  const uniqueEmployeeIds = [...new Set(expiredExemptions.map((e) => e.employeeId))];
  for (const employeeId of uniqueEmployeeIds) {
    await enqueue("REQUIREMENTS_CACHE_INVALIDATE", { employeeId });
  }

  return { expired: expiredExemptions.length, employeesAffected: uniqueEmployeeIds.length };
}
```

---

### Task 7: Handler — ticketExpiry

**Files:**
- Create: `lib/jobs/handlers/ticketExpiry.ts`

- [ ] **Create `lib/jobs/handlers/ticketExpiry.ts`:**

```typescript
import prisma from "@/lib/prisma";

export async function ticketExpiryHandler(
  _payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const now = new Date();

  // Count tickets that have passed expiry — used for reporting/future notifications
  const expiredCount = await prisma.ticketRecords.count({
    where: {
      expiryDate: { lte: now },
    },
  });

  const expiringSoonCount = await prisma.ticketRecords.count({
    where: {
      expiryDate: {
        gt: now,
        lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      },
    },
  });

  return { expired: expiredCount, expiringSoon: expiringSoonCount };
}
```

---

### Task 8: Handler — requirementsCacheRebuild

**Files:**
- Create: `lib/jobs/handlers/requirementsCacheRebuild.ts`

- [ ] **Create `lib/jobs/handlers/requirementsCacheRebuild.ts`:**

```typescript
import prisma from "@/lib/prisma";

export async function requirementsCacheRebuildHandler(
  _payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  // Fetch all active employees with their dept/location
  const allEmployees = await prisma.employee.findMany({
    where: { isActive: true },
    select: { id: true, departmentId: true, locationId: true },
  });

  // Fetch all training requirements
  const trainingRequirements = await prisma.trainingRequirement.findMany({
    include: { training: { select: { isActive: true } } },
  });

  // Fetch all ticket requirements
  const ticketRequirements = await prisma.ticketRequirement.findMany({
    include: { ticket: { select: { isActive: true } } },
  });

  // Fetch all completed training records
  const trainingRecords = await prisma.trainingRecords.findMany({
    select: { employeeId: true, trainingId: true },
  });

  // Fetch all completed ticket records
  const ticketRecords = await prisma.ticketRecords.findMany({
    select: { employeeId: true, ticketId: true },
  });

  // Fetch all active exemptions
  const exemptions = await prisma.trainingTicketExemption.findMany({
    where: { status: "Active" },
    select: { employeeId: true, type: true, trainingId: true, ticketId: true },
  });

  // Build lookup sets
  const completedTraining = new Set(
    trainingRecords.map((r) => `${r.employeeId}:${r.trainingId}`),
  );
  const completedTickets = new Set(
    ticketRecords.map((r) => `${r.employeeId}:${r.ticketId}`),
  );
  const exemptTraining = new Set(
    exemptions
      .filter((e) => e.type === "Training" && e.trainingId)
      .map((e) => `${e.employeeId}:${e.trainingId}`),
  );
  const exemptTickets = new Set(
    exemptions
      .filter((e) => e.type === "Ticket" && e.ticketId)
      .map((e) => `${e.employeeId}:${e.ticketId}`),
  );

  const entries: { employeeId: number; itemType: "Training" | "Ticket"; itemId: number }[] = [];

  for (const employee of allEmployees) {
    // Determine required training IDs for this employee
    for (const req of trainingRequirements) {
      if (!req.training.isActive) continue;
      const deptMatch = req.departmentId === -1 || req.departmentId === employee.departmentId;
      const locMatch = req.locationId === -1 || req.locationId === employee.locationId;
      if (!deptMatch || !locMatch) continue;
      const key = `${employee.id}:${req.trainingId}`;
      if (!completedTraining.has(key) && !exemptTraining.has(key)) {
        entries.push({ employeeId: employee.id, itemType: "Training", itemId: req.trainingId });
      }
    }

    // Determine required ticket IDs for this employee
    for (const req of ticketRequirements) {
      if (!req.ticket.isActive) continue;
      const deptMatch = req.departmentId === -1 || req.departmentId === employee.departmentId;
      const locMatch = req.locationId === -1 || req.locationId === employee.locationId;
      if (!deptMatch || !locMatch) continue;
      const key = `${employee.id}:${req.ticketId}`;
      if (!completedTickets.has(key) && !exemptTickets.has(key)) {
        entries.push({ employeeId: employee.id, itemType: "Ticket", itemId: req.ticketId });
      }
    }
  }

  // Wipe and rebuild atomically
  await prisma.$transaction([
    prisma.requirementsCacheEntry.deleteMany({}),
    prisma.requirementsCacheEntry.createMany({ data: entries }),
  ]);

  return { totalEntries: entries.length, employeesProcessed: allEmployees.length };
}
```

---

### Task 9: Handler — requirementsCacheInvalidate

**Files:**
- Create: `lib/jobs/handlers/requirementsCacheInvalidate.ts`

- [ ] **Create `lib/jobs/handlers/requirementsCacheInvalidate.ts`:**

```typescript
import prisma from "@/lib/prisma";

export async function requirementsCacheInvalidateHandler(
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const employeeId = payload.employeeId as number;

  if (!employeeId) {
    throw new Error("requirementsCacheInvalidate: missing employeeId in payload");
  }

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, departmentId: true, locationId: true, isActive: true },
  });

  // If employee no longer exists or is inactive, wipe their cache entries and exit
  if (!employee || !employee.isActive) {
    await prisma.requirementsCacheEntry.deleteMany({ where: { employeeId } });
    return { employeeId, cleared: true };
  }

  const [trainingRequirements, ticketRequirements, trainingRecords, ticketRecords, exemptions] =
    await Promise.all([
      prisma.trainingRequirement.findMany({
        where: {
          OR: [
            { departmentId: employee.departmentId, locationId: employee.locationId },
            { departmentId: -1, locationId: employee.locationId },
            { departmentId: employee.departmentId, locationId: -1 },
            { departmentId: -1, locationId: -1 },
          ],
        },
        include: { training: { select: { isActive: true } } },
      }),
      prisma.ticketRequirement.findMany({
        where: {
          OR: [
            { departmentId: employee.departmentId, locationId: employee.locationId },
            { departmentId: -1, locationId: employee.locationId },
            { departmentId: employee.departmentId, locationId: -1 },
            { departmentId: -1, locationId: -1 },
          ],
        },
        include: { ticket: { select: { isActive: true } } },
      }),
      prisma.trainingRecords.findMany({
        where: { employeeId },
        select: { trainingId: true },
      }),
      prisma.ticketRecords.findMany({
        where: { employeeId },
        select: { ticketId: true },
      }),
      prisma.trainingTicketExemption.findMany({
        where: { employeeId, status: "Active" },
        select: { type: true, trainingId: true, ticketId: true },
      }),
    ]);

  const completedTrainingIds = new Set(trainingRecords.map((r) => r.trainingId));
  const completedTicketIds = new Set(ticketRecords.map((r) => r.ticketId));
  const exemptTrainingIds = new Set(
    exemptions.filter((e) => e.type === "Training" && e.trainingId).map((e) => e.trainingId!),
  );
  const exemptTicketIds = new Set(
    exemptions.filter((e) => e.type === "Ticket" && e.ticketId).map((e) => e.ticketId!),
  );

  const entries: { employeeId: number; itemType: "Training" | "Ticket"; itemId: number }[] = [];

  for (const req of trainingRequirements) {
    if (!req.training.isActive) continue;
    if (!completedTrainingIds.has(req.trainingId) && !exemptTrainingIds.has(req.trainingId)) {
      entries.push({ employeeId, itemType: "Training", itemId: req.trainingId });
    }
  }

  for (const req of ticketRequirements) {
    if (!req.ticket.isActive) continue;
    if (!completedTicketIds.has(req.ticketId) && !exemptTicketIds.has(req.ticketId)) {
      entries.push({ employeeId, itemType: "Ticket", itemId: req.ticketId });
    }
  }

  // Replace this employee's cache entries atomically
  await prisma.$transaction([
    prisma.requirementsCacheEntry.deleteMany({ where: { employeeId } }),
    prisma.requirementsCacheEntry.createMany({ data: entries }),
  ]);

  return { employeeId, entries: entries.length };
}
```

---

### Task 10: Handler — inactiveEmployeeCheck

**Files:**
- Create: `lib/jobs/handlers/inactiveEmployeeCheck.ts`

- [ ] **Create `lib/jobs/handlers/inactiveEmployeeCheck.ts`:**

```typescript
import prisma from "@/lib/prisma";

export async function inactiveEmployeeCheckHandler(
  _payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const now = new Date();

  const result = await prisma.employee.updateMany({
    where: {
      isActive: true,
      finishDate: { lte: now },
    },
    data: { isActive: false },
  });

  return { deactivated: result.count };
}
```

---

### Task 11: Handler — orphanedImageCleanup

**Files:**
- Create: `lib/jobs/handlers/orphanedImageCleanup.ts`

- [ ] **Create `lib/jobs/handlers/orphanedImageCleanup.ts`:**

```typescript
import prisma from "@/lib/prisma";
import fs from "fs";
import path from "path";

export async function orphanedImageCleanupHandler(
  _payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  let orphanedDbRecords = 0;
  let orphanedFiles = 0;

  // Check TrainingImages: DB records whose file is missing on disk
  const trainingImages = await prisma.trainingImage.findMany({
    select: { id: true, imagePath: true },
  });

  const missingTrainingImageIds: number[] = [];
  for (const img of trainingImages) {
    const fullPath = path.join(process.cwd(), img.imagePath);
    if (!fs.existsSync(fullPath)) {
      missingTrainingImageIds.push(img.id);
    }
  }

  if (missingTrainingImageIds.length > 0) {
    await prisma.trainingImage.deleteMany({
      where: { id: { in: missingTrainingImageIds } },
    });
    orphanedDbRecords += missingTrainingImageIds.length;
  }

  // Check TicketImages: DB records whose file is missing on disk
  const ticketImages = await prisma.ticketImage.findMany({
    select: { id: true, imagePath: true },
  });

  const missingTicketImageIds: number[] = [];
  for (const img of ticketImages) {
    const fullPath = path.join(process.cwd(), img.imagePath);
    if (!fs.existsSync(fullPath)) {
      missingTicketImageIds.push(img.id);
    }
  }

  if (missingTicketImageIds.length > 0) {
    await prisma.ticketImage.deleteMany({
      where: { id: { in: missingTicketImageIds } },
    });
    orphanedDbRecords += missingTicketImageIds.length;
  }

  // Check for files on disk not referenced in DB (scan uploads/ directory)
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (fs.existsSync(uploadsDir)) {
    const allDbPaths = new Set([
      ...trainingImages.map((i) => path.join(process.cwd(), i.imagePath)),
      ...ticketImages.map((i) => path.join(process.cwd(), i.imagePath)),
    ]);

    const scanDir = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (!allDbPaths.has(fullPath)) {
          fs.unlinkSync(fullPath);
          orphanedFiles++;
        }
      }
    };

    scanDir(uploadsDir);
  }

  return { orphanedDbRecords, orphanedFiles };
}
```

---

### Task 12: Handler — historyArchival

**Files:**
- Create: `lib/jobs/handlers/historyArchival.ts`

- [ ] **Create `lib/jobs/handlers/historyArchival.ts`:**

```typescript
import prisma from "@/lib/prisma";
import { appSettingService } from "@/lib/services/appSettingService";

const BATCH_SIZE = 500;

export async function historyArchivalHandler(
  _payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const settings = await appSettingService.getSettings();
  const retentionYears = parseInt(settings["jobs.historyRetentionYears"] ?? "7", 10);

  const cutoffDate = new Date();
  cutoffDate.setFullYear(cutoffDate.getFullYear() - retentionYears);

  let totalDeleted = 0;

  // Delete in batches to avoid locking SQLite for too long
  while (true) {
    const batch = await prisma.history.findMany({
      where: { timestamp: { lt: cutoffDate } },
      select: { id: true },
      take: BATCH_SIZE,
    });

    if (batch.length === 0) break;

    const ids = batch.map((r) => r.id);
    const result = await prisma.history.deleteMany({
      where: { id: { in: ids } },
    });

    totalDeleted += result.count;
  }

  return { deleted: totalDeleted, cutoffDate: cutoffDate.toISOString(), retentionYears };
}
```

---

## Chunk 3: Scheduler, Startup, and Service Integration

### Task 13: Scheduler

**Files:**
- Create: `lib/jobs/scheduler.ts`

- [ ] **Create `lib/jobs/scheduler.ts`:**

```typescript
import cron from "node-cron";
import { enqueue } from "@/lib/jobs/jobQueue";

export function startScheduler(): void {
  // Daily at midnight
  cron.schedule("0 0 * * *", async () => {
    await enqueue("EXEMPTION_EXPIRY");
    await enqueue("TICKET_EXPIRY");
    await enqueue("INACTIVE_EMPLOYEE_CHECK");
    console.log("[Scheduler] Enqueued daily maintenance jobs");
  });

  // Weekly Sunday at 2am
  cron.schedule("0 2 * * 0", async () => {
    await enqueue("ORPHANED_IMAGE_CLEANUP");
    console.log("[Scheduler] Enqueued weekly cleanup job");
  });

  console.log("[Scheduler] Started");
}
```

---

### Task 14: Entry point, instrumentation, and next.config.ts

**Files:**
- Create: `lib/jobs/index.ts`
- Create: `instrumentation.ts`
- Modify: `next.config.ts`

- [ ] **Create `lib/jobs/index.ts`** — registers all handlers and starts runner + scheduler:

```typescript
import { registerHandler } from "@/lib/jobs/jobRunner";
import { startRunner } from "@/lib/jobs/jobRunner";
import { startScheduler } from "@/lib/jobs/scheduler";
import { enqueue } from "@/lib/jobs/jobQueue";
import { exemptionExpiryHandler } from "@/lib/jobs/handlers/exemptionExpiry";
import { ticketExpiryHandler } from "@/lib/jobs/handlers/ticketExpiry";
import { requirementsCacheRebuildHandler } from "@/lib/jobs/handlers/requirementsCacheRebuild";
import { requirementsCacheInvalidateHandler } from "@/lib/jobs/handlers/requirementsCacheInvalidate";
import { inactiveEmployeeCheckHandler } from "@/lib/jobs/handlers/inactiveEmployeeCheck";
import { orphanedImageCleanupHandler } from "@/lib/jobs/handlers/orphanedImageCleanup";
import { historyArchivalHandler } from "@/lib/jobs/handlers/historyArchival";

export async function start(): Promise<void> {
  // Register all handlers
  registerHandler("EXEMPTION_EXPIRY", exemptionExpiryHandler);
  registerHandler("TICKET_EXPIRY", ticketExpiryHandler);
  registerHandler("REQUIREMENTS_CACHE_REBUILD", requirementsCacheRebuildHandler);
  registerHandler("REQUIREMENTS_CACHE_INVALIDATE", requirementsCacheInvalidateHandler);
  registerHandler("INACTIVE_EMPLOYEE_CHECK", inactiveEmployeeCheckHandler);
  registerHandler("ORPHANED_IMAGE_CLEANUP", orphanedImageCleanupHandler);
  registerHandler("HISTORY_ARCHIVAL", historyArchivalHandler);

  // Warm the requirements cache on boot
  await enqueue("REQUIREMENTS_CACHE_REBUILD");

  // Start the poll loop and cron scheduler
  await startRunner();
  startScheduler();

  console.log("[Jobs] Background job system started");
}
```

- [ ] **Create `instrumentation.ts`** at repo root:

```typescript
export async function register() {
  // Only run in Node.js runtime, not Edge
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { start } = await import("@/lib/jobs/index");
    await start();
  }
}
```

- [ ] **Enable instrumentation hook** in `next.config.ts`:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    instrumentationHook: true,
  },
};

export default nextConfig;
```

- [ ] **Verify no TS errors:**

```bash
pnpm tsc --noEmit 2>&1 | grep -E "jobs/index|instrumentation|scheduler"
```

Expected: no output.

---

### Task 15: Enqueue invalidation from record services

**Files:**
- Modify: `lib/services/trainingRecordService.ts`
- Modify: `lib/services/ticketRecordService.ts`
- Modify: `lib/services/exemptionService.ts`

For each of these three services, the pattern is identical: import `enqueue` and call it after the DB write succeeds. The `enqueue` call must be **after** the mutation — not before, not in a catch block.

- [ ] **Add to `trainingRecordService.ts`** — import at top:

```typescript
import { enqueue } from "@/lib/jobs/jobQueue";
```

- [ ] **Add `enqueue` call after each successful DB write** in `createTrainingRecord`, `updateTrainingRecord`, `deleteTrainingRecord`. In each case, use the `employeeId` of the affected record:

```typescript
// After the prisma create/update/delete succeeds:
await enqueue("REQUIREMENTS_CACHE_INVALIDATE", { employeeId });
```

For `deleteTrainingRecord`, the `employeeId` comes from fetching the record before deletion — it's already fetched for the history log. Use that value.

- [ ] **Repeat the same pattern** in `ticketRecordService.ts` for `createTicketRecord`, `updateTicketRecord`, `deleteTicketRecord`.

- [ ] **Repeat the same pattern** in `exemptionService.ts` for `createExemption`, `updateExemption`, `deleteExemption`.

- [ ] **Verify no TS errors:**

```bash
pnpm tsc --noEmit 2>&1 | grep -E "trainingRecordService|ticketRecordService|exemptionService"
```

Expected: no output (or only pre-existing errors already documented in MEMORY.md).

---

### Task 16: Enqueue rebuild from training/ticket services

**Files:**
- Modify: `lib/services/trainingService.ts`
- Modify: `lib/services/ticketService.ts`

Requirements changing affects an unknown number of employees so we enqueue a full `REQUIREMENTS_CACHE_REBUILD` instead of a targeted invalidation.

- [ ] **Add to `trainingService.ts`** — import at top:

```typescript
import { enqueue } from "@/lib/jobs/jobQueue";
```

- [ ] **Enqueue `REQUIREMENTS_CACHE_REBUILD`** (no payload) after each of `createTraining`, `updateTraining`, `deleteTraining`:

```typescript
await enqueue("REQUIREMENTS_CACHE_REBUILD");
```

- [ ] **Repeat** the same for `ticketService.ts` — `createTicket`, `updateTicket`, `deleteTicket`.

- [ ] **Verify no TS errors:**

```bash
pnpm tsc --noEmit 2>&1 | grep -E "trainingService|ticketService"
```

Expected: no output (or only pre-existing errors).

---

## Chunk 4: API Routes and Admin Dashboard

### Task 17: API routes

**Files:**
- Create: `app/api/jobs/route.ts`
- Create: `app/api/jobs/archival-count/route.ts`

- [ ] **Create `app/api/jobs/route.ts`:**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { enqueue } from "@/lib/jobs/jobQueue";
import prisma from "@/lib/prisma";
import { JobType } from "@/generated/prisma_client/client";

const MANUAL_JOB_TYPES: JobType[] = [
  "EXEMPTION_EXPIRY",
  "TICKET_EXPIRY",
  "REQUIREMENTS_CACHE_REBUILD",
  "INACTIVE_EMPLOYEE_CHECK",
  "ORPHANED_IMAGE_CLEANUP",
  "HISTORY_ARCHIVAL",
];

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  if (session.user.role !== "Admin") return NextResponse.json({ message: "Not authorised" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const type = searchParams.get("type") as JobType | null;
  const limit = parseInt(searchParams.get("limit") ?? "50", 10);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  const where = {
    ...(status && { status: status as any }),
    ...(type && { type }),
  };

  const [jobs, total] = await Promise.all([
    prisma.backgroundJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.backgroundJob.count({ where }),
  ]);

  // Get last completed run per job type for the scheduled jobs card
  const lastRuns = await prisma.backgroundJob.groupBy({
    by: ["type"],
    where: { status: { in: ["Completed", "Failed"] } },
    _max: { completedAt: true },
  });

  return NextResponse.json({ jobs, total, lastRuns });
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  if (session.user.role !== "Admin") return NextResponse.json({ message: "Not authorised" }, { status: 403 });

  const body = await request.json();
  const { type } = body as { type: JobType };

  if (!MANUAL_JOB_TYPES.includes(type)) {
    return NextResponse.json({ error: "Invalid or non-triggerable job type" }, { status: 400 });
  }

  await enqueue(type);
  return NextResponse.json({ success: true });
}
```

- [ ] **Create `app/api/jobs/archival-count/route.ts`:**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { appSettingService } from "@/lib/services/appSettingService";

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  if (session.user.role !== "Admin") return NextResponse.json({ message: "Not authorised" }, { status: 403 });

  const settings = await appSettingService.getSettings();
  const retentionYears = parseInt(settings["jobs.historyRetentionYears"] ?? "7", 10);

  const cutoffDate = new Date();
  cutoffDate.setFullYear(cutoffDate.getFullYear() - retentionYears);

  const count = await prisma.history.count({
    where: { timestamp: { lt: cutoffDate } },
  });

  return NextResponse.json({ count, retentionYears, cutoffDate });
}
```

- [ ] **Verify no TS errors:**

```bash
pnpm tsc --noEmit 2>&1 | grep "api/jobs"
```

Expected: no output.

---

### Task 18: Admin jobs page shell

**Files:**
- Create: `app/admin/jobs/page.tsx`
- Create: `app/admin/jobs/jobs-page-content.tsx`

- [ ] **Create `app/admin/jobs/page.tsx`:**

```typescript
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { JobsPageContent } from "./jobs-page-content";

export default async function JobsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "Admin") redirect("/");
  return <JobsPageContent />;
}
```

- [ ] **Create `app/admin/jobs/jobs-page-content.tsx`:**

```typescript
"use client";

import { ScheduledJobsCard } from "./scheduled-jobs-card";
import { JobHistoryTable } from "./job-history-table";
import { HistoryArchivalCard } from "./history-archival-card";

export function JobsPageContent() {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-10 space-y-8">
      <h1 className="text-3xl font-bold">Background Jobs</h1>
      <ScheduledJobsCard />
      <JobHistoryTable />
      <HistoryArchivalCard />
    </div>
  );
}
```

---

### Task 19: ScheduledJobsCard component

**Files:**
- Create: `app/admin/jobs/scheduled-jobs-card.tsx`

- [ ] **Create `app/admin/jobs/scheduled-jobs-card.tsx`:**

```typescript
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Clock } from "lucide-react";
import { format } from "date-fns";
import api from "@/lib/axios";

interface ScheduledJobDef {
  type: string;
  label: string;
  description: string;
  schedule: string;
}

const SCHEDULED_JOBS: ScheduledJobDef[] = [
  { type: "EXEMPTION_EXPIRY", label: "Exemption Expiry", description: "Transitions Active exemptions past their end date to Expired status.", schedule: "Daily at midnight" },
  { type: "TICKET_EXPIRY", label: "Ticket Expiry Check", description: "Counts expired and expiring-soon ticket records for reporting.", schedule: "Daily at midnight" },
  { type: "INACTIVE_EMPLOYEE_CHECK", label: "Inactive Employee Check", description: "Flips isActive to false for employees whose finish date has passed.", schedule: "Daily at midnight" },
  { type: "REQUIREMENTS_CACHE_REBUILD", label: "Requirements Cache Rebuild", description: "Rebuilds the full requirements cache snapshot for all employees.", schedule: "On boot + on requirement changes" },
  { type: "ORPHANED_IMAGE_CLEANUP", label: "Orphaned Image Cleanup", description: "Reconciles image files on disk against DB records, removing orphans.", schedule: "Weekly (Sunday 2am)" },
];

export function ScheduledJobsCard() {
  const [lastRuns, setLastRuns] = useState<Record<string, string | null>>({});
  const [lastStatuses, setLastStatuses] = useState<Record<string, string>>({});
  const [triggering, setTriggering] = useState<string | null>(null);

  useEffect(() => {
    fetchLastRuns();
  }, []);

  const fetchLastRuns = async () => {
    try {
      const res = await api.get("/api/jobs?limit=0");
      const runs: Record<string, string | null> = {};
      const statuses: Record<string, string> = {};
      for (const entry of res.data.lastRuns) {
        runs[entry.type] = entry._max.completedAt;
      }
      // Get last status per type
      const detail = await api.get("/api/jobs?limit=100");
      for (const job of detail.data.jobs) {
        if (!statuses[job.type]) statuses[job.type] = job.status;
      }
      setLastRuns(runs);
      setLastStatuses(statuses);
    } catch {
      // non-fatal
    }
  };

  const handleRunNow = async (type: string) => {
    setTriggering(type);
    try {
      await api.post("/api/jobs", { type });
      setTimeout(fetchLastRuns, 1000);
    } finally {
      setTriggering(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scheduled Jobs</CardTitle>
        <CardDescription>Automated background tasks — run on their schedule or trigger manually.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SCHEDULED_JOBS.map((job) => (
            <div key={job.type} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-sm leading-tight">{job.label}</p>
                {lastStatuses[job.type] && (
                  <Badge
                    variant={
                      lastStatuses[job.type] === "Completed" ? "default" :
                      lastStatuses[job.type] === "Failed" ? "destructive" :
                      lastStatuses[job.type] === "Running" ? "secondary" : "outline"
                    }
                    className="shrink-0 text-xs"
                  >
                    {lastStatuses[job.type]}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{job.description}</p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {job.schedule}
              </div>
              {lastRuns[job.type] && (
                <p className="text-xs text-muted-foreground">
                  Last run: {format(new Date(lastRuns[job.type]!), "PPp")}
                </p>
              )}
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                disabled={triggering === job.type}
                onClick={() => handleRunNow(job.type)}
              >
                <Play className="h-3 w-3 mr-1" />
                {triggering === job.type ? "Queued..." : "Run Now"}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

---

### Task 20: JobHistoryTable component

**Files:**
- Create: `app/admin/jobs/job-history-table.tsx`

- [ ] **Create `app/admin/jobs/job-history-table.tsx`:**

```typescript
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import api from "@/lib/axios";

const LIMIT = 20;

interface BackgroundJob {
  id: number;
  type: string;
  status: string;
  payload: string | null;
  resultSummary: string | null;
  errorMessage: string | null;
  scheduledAt: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  Completed: "default",
  Failed: "destructive",
  Running: "secondary",
  Pending: "outline",
};

const formatJobType = (type: string) =>
  type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const parseJson = (s: string | null): Record<string, unknown> | null => {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
};

export function JobHistoryTable() {
  const [jobs, setJobs] = useState<BackgroundJob[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPage(0);
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    fetchJobs();
  }, [page, statusFilter, typeFilter]);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(LIMIT),
        offset: String(page * LIMIT),
        ...(statusFilter !== "all" && { status: statusFilter }),
        ...(typeFilter !== "all" && { type: typeFilter }),
      });
      const res = await api.get(`/api/jobs?${params}`);
      setJobs(res.data.jobs);
      setTotal(res.data.total);
    } finally {
      setLoading(false);
    }
  };

  const hasMore = (page + 1) * LIMIT < total;

  const paginationControls = (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page === 0 || loading}>
        <ChevronLeft className="h-4 w-4 mr-1" /> Previous
      </Button>
      <span className="text-sm text-muted-foreground">Page {page + 1}</span>
      <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={!hasMore || loading}>
        Next <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Job History</CardTitle>
            <CardDescription>{total} total job{total !== 1 ? "s" : ""}</CardDescription>
          </div>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Running">Running</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="EXEMPTION_EXPIRY">Exemption Expiry</SelectItem>
                <SelectItem value="TICKET_EXPIRY">Ticket Expiry</SelectItem>
                <SelectItem value="REQUIREMENTS_CACHE_REBUILD">Cache Rebuild</SelectItem>
                <SelectItem value="REQUIREMENTS_CACHE_INVALIDATE">Cache Invalidate</SelectItem>
                <SelectItem value="INACTIVE_EMPLOYEE_CHECK">Inactive Employee</SelectItem>
                <SelectItem value="ORPHANED_IMAGE_CLEANUP">Image Cleanup</SelectItem>
                <SelectItem value="HISTORY_ARCHIVAL">History Archival</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading && page === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No jobs found.</p>
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Scheduled</TableHead>
                    <TableHead>Completed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => {
                    const result = parseJson(job.resultSummary);
                    return (
                      <TableRow key={job.id}>
                        <TableCell className="font-medium">{formatJobType(job.type)}</TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANTS[job.status] ?? "outline"}>
                            {job.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                          {job.errorMessage
                            ? <span className="text-destructive">{job.errorMessage}</span>
                            : result
                            ? Object.entries(result).map(([k, v]) => `${k}: ${v}`).join(", ")
                            : "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(job.scheduledAt), "PPp")}
                        </TableCell>
                        <TableCell className="text-sm">
                          {job.completedAt ? format(new Date(job.completedAt), "PPp") : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile */}
            <div className="md:hidden space-y-3">
              {jobs.map((job) => {
                const result = parseJson(job.resultSummary);
                return (
                  <div key={job.id} className="border rounded-lg p-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{formatJobType(job.type)}</span>
                      <Badge variant={STATUS_VARIANTS[job.status] ?? "outline"}>{job.status}</Badge>
                    </div>
                    {job.errorMessage && (
                      <p className="text-destructive text-xs">{job.errorMessage}</p>
                    )}
                    {result && (
                      <p className="text-muted-foreground text-xs">
                        {Object.entries(result).map(([k, v]) => `${k}: ${v}`).join(", ")}
                      </p>
                    )}
                    <p className="text-muted-foreground text-xs">
                      {job.completedAt
                        ? `Completed: ${format(new Date(job.completedAt), "PPp")}`
                        : `Scheduled: ${format(new Date(job.scheduledAt), "PPp")}`}
                    </p>
                  </div>
                );
              })}
            </div>

            {total > LIMIT && (
              <div className="flex justify-end pt-4">{paginationControls}</div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
```

---

### Task 21: HistoryArchivalCard component

**Files:**
- Create: `app/admin/jobs/history-archival-card.tsx`

- [ ] **Create `app/admin/jobs/history-archival-card.tsx`:**

```typescript
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Trash2 } from "lucide-react";
import api from "@/lib/axios";

interface ArchivalData {
  count: number;
  retentionYears: number;
  cutoffDate: string;
}

export function HistoryArchivalCard() {
  const [data, setData] = useState<ArchivalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [queued, setQueued] = useState(false);
  const [triggering, setTriggering] = useState(false);

  useEffect(() => {
    fetchCount();
  }, []);

  const fetchCount = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/jobs/archival-count");
      setData(res.data);
    } finally {
      setLoading(false);
    }
  };

  const handleStartPruning = async () => {
    setTriggering(true);
    try {
      await api.post("/api/jobs", { type: "HISTORY_ARCHIVAL" });
      setQueued(true);
    } finally {
      setTriggering(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trash2 className="h-5 w-5" />
          History Archival
        </CardTitle>
        <CardDescription>
          Delete audit log records past the configured retention threshold. This action is irreversible.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-5 w-64" />
            <Skeleton className="h-9 w-36" />
          </div>
        ) : data ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 border rounded-lg bg-muted/50">
              {data.count > 0 && <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />}
              <div className="space-y-1">
                <p className="font-medium text-sm">
                  {data.count === 0
                    ? `No records are older than ${data.retentionYears} years.`
                    : `${data.count.toLocaleString()} record${data.count !== 1 ? "s are" : " is"} older than ${data.retentionYears} year${data.retentionYears !== 1 ? "s" : ""}.`}
                </p>
                <p className="text-xs text-muted-foreground">
                  Retention threshold: {data.retentionYears} years
                  {" · "}
                  Records before {new Date(data.cutoffDate).toLocaleDateString()} are eligible.
                  {" "}
                  Configure via <span className="font-mono">jobs.historyRetentionYears</span> in App Settings.
                </p>
              </div>
            </div>

            <Button
              variant="destructive"
              disabled={data.count === 0 || queued || triggering}
              onClick={handleStartPruning}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {queued
                ? "Pruning job queued"
                : triggering
                ? "Queuing..."
                : `Start Pruning (${data.count.toLocaleString()} records)`}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Failed to load archival data.</p>
        )}
      </CardContent>
    </Card>
  );
}
```

---

### Task 22: Add Jobs to admin nav

**Files:**
- Modify: `lib/data.ts`

- [ ] **Add a Jobs nav entry** in `lib/data.ts` alongside the existing admin navigation items (near the `/admin/settings` entry):

```typescript
{
  title: "Background Jobs",
  href: "/admin/jobs",
  minimumAllowedPermission: "user:impersonate", // Admin only, same as other admin pages
  description: "Monitor and manage background jobs",
  icon: /* use whichever icon pattern the other items use */,
},
```

Check the existing entries in `lib/data.ts` to match the exact shape of the object and the icon pattern used.

- [ ] **Final type check across the whole project:**

```bash
pnpm tsc --noEmit 2>&1 | grep -v "bulk-training\|add-exemption-dialog\|edit-exemption-dialog\|training-edit-form\|employee-add-form\|employee-edit-form\|sign-out\|requirements/route\|profile-details\|seed.ts"
```

Expected: no new errors (the excluded files contain pre-existing errors documented in MEMORY.md).

- [ ] **Start dev server and verify:**

```bash
pnpm dev
```

Navigate to `/admin/jobs` — confirm the page loads with three sections. Trigger a job with "Run Now" — confirm it appears in Job History with `Pending` → `Completed` after a few seconds. Check `/admin/settings` → Change History tab still works.
