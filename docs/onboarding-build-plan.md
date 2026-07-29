# Employee Onboarding — Parallel Build Plan

> **Companion to** [`docs/employee-onboarding-spec.md`](employee-onboarding-spec.md) (the source
> of truth for *what* to build). This doc covers *how to split the work* across parallel
> agents without them colliding. Read the spec first; section references below (§) point into it.

## 1. The real constraints (read this before splitting anything)

The thing that limits parallelism here is **not** the feature list — it's three shared
chokepoints. Every decision below exists to neutralize them:

1. **The name migration is a wide Employee sweep.** Renaming `firstName/lastName` →
   `legal*`/`preferred*` (§6.1) touches nearly every place that displays, searches, sorts, or
   filters employees. Anything else editing those same files at the same time **will** conflict.
   → It must land **first and alone**.
2. **`prisma/schema.prisma` + the generated client are a single shared resource.** Every agent
   that adds a model or column fights over one file, and `db push` + client regen need a
   coherent schema. → Land **all** schema additions in one pass up front, then freeze it.
3. **The admin nav (`lib/data.ts`, `landingPageNavigationItems`) is touched by every admin
   page.** Each managed-table project wants to add a nav entry. → Add them all in the same
   up-front pass; downstream agents don't touch nav.

## 2. The unlock: a schema + nav "landing pass"

After the name migration, **one agent** makes a single additive pass that adds every new
model/column/enum the spec calls for, runs `pnpm prisma db push` once, regenerates the client
once, and seeds the admin nav entries. After that, **no downstream agent edits
`schema.prisma`, the generated client, or the nav** — they build services/routes/UI against a
frozen model. This removes chokepoints #2 and #3 in one shot and is what makes Wave B safe to
fan out.

Schema to land in this pass (see spec for shapes):
- `JobFamily` + `Employee.jobFamilyId` (§6.5)
- `MedicalStandard` (§6.6)
- `Employee.employmentType` + `EmploymentType` enum (§6.2)
- Program catalogue + Hardware catalogue models (§6.4)
- `EmailTemplate` (§6.7)
- `OnboardingRequest` + `OnboardingStatus` enum (§6.3) — including `employmentStatus`
  (renamed from `status_`), `jobFamilyId`, `medicalStandardId`

## 3. Dependency graph

```
P0 ──▶ P0.5 ──▶ [P1 P2 P3 P4 P5 P6] ──▶ P7 ──▶ [P8  P9] ──▶ P10
 (migration)  (land schema   (6 parallel)        (2 parallel)
               + nav)
```

Realistic shape: **2 serial → 6 parallel → 1 serial → 2 parallel → 1 serial.** The fat middle
(Wave B) is where parallel agents pay off; the rest is serial because of genuine data/contract
dependencies.

## 4. The projects

### Wave A — solo, blocking
- **P0 — Name model migration** (§6.1, spec Phase 1). Rename `firstName/lastName` →
  `legalFirstName/legalLastName`, add `preferredFirstName/preferredLastName`, backfill
  `preferred = legal`, then sweep **every** read site (employee selector, search, sort,
  matchingService, duplicate detection, access-check reports, exports, add/edit forms,
  profile). Verify existing flows before anything else starts.
- **P0.5 — Schema + nav landing pass** (§2 above). Fast, mechanical, additive-only. One agent.

### Wave B — wide parallel fan-out (6 agents, identical managed-table/config shape)
All independent: different services, routes, and admin pages; none reference each other; none
touch schema or nav (P0.5 already did). Ideal for `isolation: worktree`.

| # | Project | Scope | Primary files (no overlap) |
|---|---|---|---|
| **P1** | JobFamily | managed table CRUD + API; wire `jobFamilyId` selector into add/edit forms | `lib/services/jobFamilyService.ts`, `app/api/job-families/`, admin page |
| **P2** | MedicalStandard | managed table CRUD + API; seed KSB Standard / No / Telfer | `medicalStandardService`, own route + page |
| **P3** | employmentType | `deriveEmploymentType(status)` helper; wire into Employee create/update | helper + Employee write paths |
| **P4** | Program catalogue | table CRUD + API; IT-ticket base-URL config; seed placeholders | own service/route/page |
| **P5** | Hardware catalogue | table CRUD + API; endpoint config; placeholder payload shape | own service/route/page |
| **P6** | Config backbone | `EmailTemplate` + interpolation; AppSetting scalars (recipients, base URLs, domain); compliance-attachment upload | extends `appSettingService` |

### Wave C — convergence, solo
- **P7 — OnboardingRequest core** (spec Phase 3). `onboardingService` (create/list/get/
  approve/reject) + `POST/GET /api/onboarding` + `GET [id]` + approve/reject routes (Admin).
  History logging on approve/reject. **Fix this API contract before Wave D starts** —
  everything downstream builds against it.

### Wave D — parallel (2 agents)
- **P8 — Onboarding form UI** (`components/forms/onboarding-form.tsx` + page, spec Phase 4).
  Needs P7's contract + P1/P2/P4/P5 option APIs. Conditional logic, Job-Family-driven prefills
  (§6.5), internal/external alert, display-only email confirmation.
- **P9 — Admin review/approve UI + Employee-creation-on-approve + profile "Onboarding" tab**
  (spec Phase 5). Needs P7 + P0 (creates `Employee` with legal/preferred names — **no User**,
  §6.3) + P3 (employmentType). Adds the read-only Onboarding tab to the employee profile.

### Wave E — solo (internally sub-parallelizable)
- **P10 — Job fan-out** (§7, spec Phase 6). Wire each job onto P9's approval hook via
  `mailService.send` / `scheduledAt`. Needs P6 templates + P4/P5 catalogues + P9's enqueue
  point. The individual jobs (manager email, forms, program, hardware, medical, licence) are
  independent once the enqueue point exists, but they share that wiring — **one owner is
  cleaner than six**.

## 5. GOTCHAS (the part that actually bites)

- **G1 — Do not start anything until P0 is merged and verified.** The name migration rewrites
  Employee read sites; any concurrent Employee-touching work conflicts. This is a hard barrier,
  not a suggestion.
- **G2 — After P0.5, schema is frozen. No downstream agent edits `prisma/schema.prisma`, the
  generated client, or `lib/data.ts` nav.** If a Wave B agent discovers it needs a schema
  change, it must **stop and route it back to a coordinator** for a fresh landing pass — never
  let two agents `db push` divergent schemas. Divergent schema + `db push` against the drift-y
  SQLite DB is exactly the failure mode that's hard to recover from.
- **G3 — P3 (employmentType) and P1 (JobFamily) both write the Employee create/update path.**
  If run truly concurrently they edit the same functions. Either give P3 to whoever owns P1, or
  sequence them. Don't hand them to two unaware agents in parallel.
- **G4 — P9's profile "Onboarding" tab and P0's profile sweep both touch the employee profile
  page.** P0 finishes first (Wave A), so normally fine — but if P0 needs a follow-up fix while
  P9 is in flight, coordinate; don't let both edit the profile page blind.
- **G5 — Nav entries: pick one owner.** P0.5 adds all admin-nav entries. If for some reason it
  didn't, exactly one Wave B agent adds them — not each of the six (that's six conflicting edits
  to one array).
- **G6 — Worktrees still share the database file.** `isolation: worktree` isolates the *code*,
  not `prisma/dev.db`. Wave B agents that seed data (P2 medical standards, P4/P5 catalogue
  placeholders) are writing the same SQLite file. Either seed idempotently (upsert on unique
  `name`) or merge code first and seed once at the end. Don't assume worktrees give DB isolation.
- **G7 — P7 is a true barrier for Wave D.** Don't let P8 (form) start against a guessed API
  shape — a churned `OnboardingRequest` contract means reworking the form. Freeze P7's
  request/response types first, then fan out P8/P9.
- **G8 — Honour project conventions everywhere** (see `memory/MEMORY.md`): pnpm, `db push` (not
  `migrate dev`), Prisma client imported from `@/generated/prisma_client/client`, class-based
  singleton services, auth-guarded routes, server-component admin pages, **responsive dialogs**
  (Dialog desktop / Drawer mobile). Reuse `mailService`/`SEND_EMAIL` — no bespoke SMTP.
- **G9 — No git commits unless explicitly asked** (standing rule for this repo).

## 6. Suggested agent dispatch

1. One agent: **P0**, run to completion, verify, merge.
2. One agent: **P0.5**, merge.
3. Up to **six** worktree agents: **P1–P6** (respecting G3 — fold P3 into P1's agent or run it
   just before/after). Merge each as it lands.
4. One agent: **P7**, freeze the contract, merge.
5. **Two** agents: **P8**, **P9**.
6. One agent: **P10** (may sub-dispatch the individual jobs).
