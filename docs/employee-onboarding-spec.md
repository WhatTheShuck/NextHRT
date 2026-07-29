# Employee Onboarding Form — Specification & Implementation Plan

> **Status:** DRAFT / planning. Derived from `components/forms/employee-add-form.txt` (the
> author's raw brain-dump). This document fleshes that brief into a buildable spec.
> Several sections are explicitly **UNFINISHED** and flagged inline — they depend on
> content/decisions only the business owner can supply (email copy, IT ticket links,
> hardware API contract). Do not treat flagged items as ready to build.

## 1. Purpose & one-paragraph summary

Today new employees are created directly via `EmployeeAddForm` → `POST /api/employees`.
The new **Onboarding Form** is a richer, manager-facing intake form that captures
everything needed to onboard a new hire (HR data, compliance forms, software access,
hardware) and then **fans out into a set of downstream jobs** (emails to the manager,
HR, Payroll, IT, Marketing; an HRT employee-creation approval; and hardware-platform API
requests). Crucially, **submitting the form does NOT create an Employee** — it creates a
pending **onboarding request** that an Admin reviews and approves, mainly for data
integrity (misspelled names are the stated pain point). On approval, the real `Employee`
is created and the downstream jobs fire. **No `User` is created or linked here** —
User↔Employee linking is a separate, pre-existing concern and is explicitly out of scope
for this spec.

The form is also intended to **accrete data on employees over time** so that a future
"reference user" feature can pre-fill most of the form from a similar existing employee.

## 2. Scope

**In scope (v1):**
- New multi-section onboarding form (manager-facing).
- A new persisted request model (`OnboardingRequest`) storing the full submission.
- Admin review/approve/reject UI that, on approval, creates the `Employee` (no `User`).
- Job fan-out: emails (manager next-steps, HR/Payroll/IT freeform, reminders, marketing,
  medical), and stubs for IT-access tickets and hardware-platform API calls.
- Schema migrations for name model (legal vs preferred) and onboarding storage.

**Out of scope / later (flagged, see §9):**
- Reference-user auto-fill (needs accumulated data first).
- Live integration with IT ticketing system (email-only for v1).
- Final email copy and IT ticket link catalogue (content not yet supplied).

## 3. Current-state facts (verified against the codebase)

These ground the plan; build on them, don't reinvent them.

- **Stack:** Next.js App Router, Prisma 7.4.1 (SQLite via `@prisma/adapter-better-sqlite3`),
  better-auth, shadcn/ui. Package manager **pnpm**. Prisma client imported from
  `@/generated/prisma_client/client`. Use `pnpm prisma db push` (migration drift — no
  `migrate dev`).
- **Employee model** (`prisma/schema.prisma`): has `firstName`, `lastName`, `title`,
  `startDate`, `finishDate?`, `departmentId`, `locationId`, `status` (`EmployeeStatus`
  enum), `isActive`, optional `User` relation. **No manager field today** (the author has
  deliberately avoided it — see §9.0).
- **`EmployeeStatus` enum:** `Permanent | Apprentice | LabourContractor |
  IndustryExperience | PartTimePermanent`. There is **no internal/external flag** yet —
  the brief's internal/external distinction must be derived or added (see §6.2).
- **Mail infra is already built and the right tool for the job-fan-out:**
  - `lib/mail.ts` — pooled nodemailer `transporter`.
  - `lib/services/mailService.ts` — `mailService.send(params)` enqueues a `SEND_EMAIL`
    background job (async, fire-and-forget, deduped on identical payload);
    `mailService.sendNow(params)` sends synchronously and throws on failure.
  - `lib/jobs/handlers/sendEmail.ts` — the `SEND_EMAIL` handler (already registered in
    `lib/jobs/index.ts`).
  - `app/actions/mail.ts` — `sendNotification()` server action (auth-guarded) for client
    components to queue mail.
  - `MailParams`: `{ to, subject, text?, html?, from?, cc?, bcc?, replyTo? }`.
- **Background-job system** (`lib/jobs/`): `JobType` enum + `BackgroundJob` model,
  `enqueue(type, payload?)`, handlers registered in `lib/jobs/index.ts`, a runner and a
  scheduler. **Scheduled/deferred sends** (e.g. "send on commencement date") fit the
  `BackgroundJob.scheduledAt` field — extend rather than invent.
- **Approval system exists** (`approvalService`, `ApprovalRequest` / `ApprovalAction`,
  `ApprovalStage` = `DepartmentManager → HRManager → Admin`) but is currently typed only
  for `ApprovalRequestType.Training`. The onboarding approval is **simpler** (single Admin
  gate) — decide whether to reuse this machinery or use a dedicated status field (§9.0 — decided: dedicated field).
- **History logging pattern:** `prisma.history.create({ tableName, recordId, action,
  changedFields, oldValues, newValues, userId })`.
- **Service/route conventions:** services are class-based singletons in `lib/services/`;
  API routes in `app/api/.../route.ts` check session + role then delegate to a service;
  admin pages are server components with an auth guard rendering a client
  `*-page-content.tsx`. Dialogs must be responsive (Dialog desktop / Drawer mobile).

## 4. Personas & flow

1. **Manager (submitter)** — fills the form. Prefilled as the employee's manager but can
   submit on behalf of someone else. Receives the "next steps" email after approval.
2. **Admin (reviewer)** — reviews the pending request, edits/corrects data (the data-
   integrity gate), then approves (creates the `Employee` record + fires jobs) or rejects
   (e.g. hire fell through).
3. **Downstream recipients** — HR, Payroll, IT, Marketing, and the new employee, who
   receive job-generated emails/requests.

**Happy path:** Manager submits → `OnboardingRequest(status=Pending)` persisted → Admin
notified → Admin reviews/edits → Approve → within one transaction create `Employee`
(no `User`), set request `Approved`, enqueue all downstream jobs → jobs deliver emails /
hit hardware API.

## 5. Form structure (sections, fields, behaviours)

Field types reflect the brief. "Prefill" = default value, still editable. Conditional
fields appear/hide based on another field.

### 5.1 HRT / core employee section
| Field | Type | Notes / behaviour |
|---|---|---|
| Legal first name | text | required |
| Legal last name | text | required |
| Preferred name == legal? | checkbox | default checked |
| Preferred first/last name | text ×2 | shown only when above unchecked. When shown, surface a note: *"There is an extra step in the Workday process to change to the preferred name; we'll include this in the email."* |
| Email confirmation | checkbox | **Display-only sanity prompt.** Show computed `firstname.lastname@{companyDetails.domain_extension}` (domain pulled from config, §6.7) and require the user to tick that it looks right. The actual mailbox is created outside HRT — this field does NOT create or reserve the address, so **no duplicate/collision handling is needed**. Its real purpose is to prompt the manager to catch name typos and to make the meaning of the **preferred name** concrete (showing how it shapes the address). |
| Manager | employee selector | prefill = submitting user's linked employee; editable (on-behalf-of) |
| Title | text | required |
| Department | dropdown + "add" | reuse `AddDepartmentDialog` pattern from current form |
| Location | dropdown + "add" | reuse `AddLocationDialog` pattern |
| Employment status | dropdown (`EmployeeStatus`) | drives internal/external (see §6.2). On change show alert: *"You've selected X — this means they are [Internal/External], i.e. they [are/are not] paid by KSB. This is important so your requests go to the right place."* |
| Start date | date picker | reuse `DateSelector` |

### 5.2 Forms / compliance section
| Field | Type | Prefill rule |
|---|---|---|
| Letter of offer signed | checkbox | — |
| Employment forms required | checkbox | internal → checked, external → unchecked |
| Police check required | checkbox | internal → checked, external → unchecked |
| Marketing induction required | checkbox | prefill checked when the selected **Job Family** is the designated sales/marketing-induction one (§6.5), else unchecked. Key off the Job Family record, **not** a `department === "Sales"` string match (Department is a free, admin-extendable list — name matching is brittle). |
| Pre-employment medical level | dropdown (from API) | Options pulled from the `MedicalStandard` managed table (§6.6), not a hard-coded enum. Seed: KSB Standard / No / Telfer. |
| Will receive a KSB vehicle | checkbox | — |
| Will be required to drive a KSB vehicle | checkbox | auto-check if "receive a KSB vehicle" is checked |

### 5.3 Programs / software-access section
Brief suggests this *could* be a single multi-select; listed as individual toggles for
clarity. **Recommend a config-driven list** (see §6.4) rendered as checkboxes.

| Field | Type | Behaviour |
|---|---|---|
| SAP | checkbox | if checked → require **SAP reference user** (employee selector). Prefill ref user from someone with the same title if possible (best-effort). |
| C4C Sales | checkbox | — |
| C4C Service | checkbox | if checked → require **C4C Service reference user** (employee selector, same prefill idea) |
| Easy Select | checkbox | — |
| KSBase | checkbox | — |
| Webshop / E2E | checkbox | — |
| Full Microsoft E3 licence | checkbox | prefill **unchecked** when Job Family is **Service Technician** (§6.5), else checked |

### 5.4 Hardware section
| Field | Type | Behaviour |
|---|---|---|
| Laptop | checkbox | prefill unchecked when Job Family is **Service Technician** (§6.5), else checked |
| Non-standard laptop | checkbox + justification textarea | visible only when laptop checked; prefill checked when Job Family is **Engineering** (§6.5); textarea required when checked |
| iPad | checkbox | prefill checked when Job Family is **Service Technician** (§6.5), else unchecked |
| Phone | checkbox | — |
| Non-standard phone | checkbox + justification textarea | visible only when phone checked; textarea required when checked |

### 5.5 Freeform notes (three separate fields)
- Note to **IT**, note to **HR**, note to **Payroll**. Each, if non-empty, becomes part of
  the email to that department. (The brief explicitly wants three separate boxes, not one.)

## 6. Data model & derivations

> **DECIDED (2026-06-19):** the four data-model forks below are now settled. Details inline;
> §9 retains the still-open content/contract questions.

### 6.1 Name model migration (brief "Extra Notes") — DECIDED: rename + add
- **Rename** `Employee.firstName/lastName` → `legalFirstName` / `legalLastName`, and **add**
  `preferredFirstName` / `preferredLastName`.
- Backfill: `preferred* = legal*` for all existing rows, then correct case-by-case.
- This is the more code-churny option (chosen deliberately for clarity): every read site
  must move off `firstName`/`lastName`.
- **Employee search must index on BOTH legal and preferred names.** Audit every place that
  searches/filters/sorts/displays `firstName`/`lastName` (employee selector,
  duplicate-detection, matchingService, access-check reports, exports, edit form, profile)
  and update them. This is the riskiest migration — see §8 build order.

### 6.2 Internal vs External — DECIDED: persist a derived field
The internal/external distinction is **deterministically derived from `EmployeeStatus`**
(there is an exclusive mapping — certain statuses are always internal, others always
external), **but we persist it in the DB** so it's cheap to read and query rather than
re-deriving the `status === Permanent || PartTimePermanent ? internal : external` logic
everywhere.
- Add a derived column (e.g. `employmentType: Internal | External`, or `isExternal: Boolean`)
  on `Employee`. Keep it authoritative-by-derivation: compute it from `status` on every
  create/update (single helper, e.g. `deriveEmploymentType(status)`), don't let it drift.
- **Mapping (CONFIRMED 2026-06-19):**
  - **Internal:** `Permanent`, `PartTimePermanent`.
  - **External:** `LabourContractor`, `IndustryExperience`, `Apprentice`.

### 6.3 OnboardingRequest model (new) — DECIDED: hybrid storage; admin gates only the Employee creation
Important framing from the owner: **the Admin review/approval is specifically the creation
of the `Employee` record inside HRT — i.e. the core HR fields. No `User` is created here**
(User↔Employee linking is a separate, pre-existing concern, out of scope). The programs, hardware,
forms, and notes are **not** the Admin's to approve; they only affect downstream job
fan-out and how the data lands in HRT. The **full submission is kept as JSON on the
employee's profile for historical reference** (and to feed future reference-user prefill).

Storage = **hybrid**:
- **Explicit columns** for the core HR fields the Admin reviews/edits and that map onto
  `Employee` (legal/preferred names, title, departmentId, locationId, status, startDate,
  derived employmentType, managerEmployeeId, email-confirmed flag).
- **JSON column(s)** for the non-HR sub-objects (programs[], hardware[], forms/compliance
  flags, the three department notes). Copied onto the employee's profile/history on approval.

```prisma
model OnboardingRequest {
  id                 Int      @id @default(autoincrement())
  status             OnboardingStatus @default(Pending) // Pending | Approved | Rejected | Cancelled
  submittedByUserId  String
  submittedByUser    User   @relation(fields: [submittedByUserId], references: [id])

  // --- Core HR fields the ADMIN reviews/edits → become the Employee on approval ---
  legalFirstName     String
  legalLastName      String
  preferredFirstName String?
  preferredLastName  String?
  title              String
  departmentId       Int
  locationId         Int
  employmentStatus   EmployeeStatus   // the hire's EmployeeStatus (named to avoid clashing with request `status`)
  employmentType     EmploymentType   // derived from employmentStatus via deriveEmploymentType()
  startDate          DateTime
  managerEmployeeId  Int?             // who the next-steps email goes to (request-only, §9.0 DECIDED)

  // --- Non-HR payload (NOT admin-approved; drives jobs; archived to profile) ---
  payload            String           // JSON: { programs[], hardware[], compliance{}, notes{it,hr,payroll} }

  // --- Lifecycle ---
  createdEmployeeId  Int?             // set on approval
  reviewedByUserId   String?
  reviewedAt         DateTime?
  reviewNotes        String?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
}
```
- **Manager is stored on the request only** (DECIDED — no first-class Employee/User manager
  field in v1).
- Add `JobType.ONBOARDING_*` entries only if you create dedicated handlers; otherwise reuse
  `SEND_EMAIL` for all email fan-out and add handlers only for hardware/IT-ticket calls.
- On approval, persist the JSON payload so the form data lives with the employee
  permanently, and **surface it in a new "Onboarding" tab in the employee profile**
  (read-only view of the programs/hardware/compliance flags + the three department notes).
  Add the tab to the existing employee-profile page alongside the current tabs.

### 6.4 Programs & hardware catalogues — DECIDED: admin-editable reference tables
Model as **admin-editable reference tables** (managed via the admin tools, §6.7), not
hard-coded:
- **`program catalogue`**: name, **IT ticket number** (not the full URL), "info required"
  text, `requiresReferenceUser` flag. The link is **constructed** as
  `https://itsp.intern.ksb.com/assystnet/#serviceOfferings/{ticketNumber}` (store the base
  URL as config so it's changeable). **Seed with placeholders for now** — real ticket
  numbers/text to be filled by an Admin later.
- **`hardware catalogue`**: name, request-type/payload template for the hardware API.
  **Hardware endpoint** = `https://checkout.ksb.com.au/` (placeholder; store as config).
  Auth + exact per-item payload TBD — **placeholder the request shape for now** (§9.1.2).

### 6.6 Pre-employment medical standards — DECIDED: managed table, NOT a Prisma enum
The medical-level field must be **flexible/extensible** (future mine sites beyond Telfer may
have their own standard), so do **not** use a Prisma enum. Use a managed reference table
(like Department/Location), admin-editable, and have the form **pull the options via API**.
- Seed values: **`KSB Standard`**, **`No`** (= none required), **`Telfer`**.
```prisma
model MedicalStandard {
  id       Int     @id @default(autoincrement())
  name     String  @unique
  isActive Boolean @default(true)
}
// OnboardingRequest stores the chosen medicalStandardId (or name in the JSON payload).
```

### 6.7 Admin-editable configuration surfaces — DECIDED
A recurring requirement from the owner: **most onboarding config must be Admin-editable
through the admin tools**, not hard-coded. Provide admin UI + persistence for:
- **Email templates / copy** — manager next-steps (internal & external branches), HR/Payroll/
  IT/Marketing/medical/licence emails. Owner will fill copy in over time; ship the editor +
  blank/placeholder templates now. (Consider a small `EmailTemplate` table keyed by a stable
  template id, with variable interpolation for fields like preferred name, start date, etc.)
- **Recipients** — Marketing induction address, medical contacts, the licence recipient
  (currently "Vicki"). Editable, not hard-coded.
- **Compliance form attachments** — employment forms + police-check files; Admin can upload/
  replace (reuse existing file-upload infra, `fileUploadService`/`imageService` patterns).
- **Program catalogue, hardware config, medical standards** — per §6.4 / §6.6.
- **Base URLs / endpoints** — IT ticket base URL, hardware endpoint — as config values.
- **Email domain** — the confirmed-email-address field is computed as
  `firstname.lastname@{companyDetails.domain_extension}`, pulling the domain from the
  `companyDetails.domain_extension` data property (config), not hard-coded.

The simplest consistent home is the existing **`AppSetting`** infra for scalar config
(URLs, recipients, domain) plus small dedicated tables for the list-like things (catalogue,
medical standards, email templates). Confirm during build which go where.

### 6.5 Job Family — DECIDED: first-class model (this project), requirements refactor is a SEPARATE later project
For **this onboarding project**, Job Family is scoped to exactly:
- A new managed reference model (like Department/Location), admin-editable.
- `Employee.jobFamilyId` (nullable, so existing rows backfill gradually).
- A form selector + driving the hardware/software prefills deterministically off the
  selected Job Family instead of sniffing the free-text `title` or matching on department
  name. Known mappings:
  - **Service Technician** → laptop unchecked, iPad checked, E3 licence unchecked.
  - **Engineering** → non-standard laptop checked.
  - the designated **sales/marketing** family → marketing induction checked (§5.2).
  The "which family triggers which prefill" rules should be data-driven (a designated family
  per rule, configurable) rather than hard-coded family names where practical.

```prisma
model JobFamily {
  id        Int      @id @default(autoincrement())
  name      String   @unique
  isActive  Boolean  @default(true)
  employees Employee[]
}
// Employee gains: jobFamilyId Int?  (nullable)
```

**OUT OF SCOPE here (DECIDED):** reworking required training/tickets to key on Job Family.
Requirements **stay keyed on department** for now ("good enough"). The Job-Family-driven
requirements work is **its own separate project, done AFTER this one**, and when it happens
it will most likely add Job Family as an **additional layer on top** of the existing
`(item, departmentId, locationId)` keying (some requirements are genuinely department-level,
not all) — **not** a replacement. Do not touch `requirementService` / the requirements cache
as part of onboarding.

## 7. Downstream jobs (the fan-out)

All of these run **after Admin approval**. Email jobs should go through the existing
`mailService` (`SEND_EMAIL`); deferred ones use `BackgroundJob.scheduledAt`.

### 7.1 Manager "next steps" email
- Thanks the manager; lists next steps. **Branches on internal vs external.**
- **External branch is partly drafted in the brief** (KSB IAM contractor form link +
  step-by-step fill-in instructions, valid-to = start + 1 year, etc.).
- **Internal branch is EMPTY in the brief — content UNFINISHED (§9.1.3).**
- External instructions reference specific values (Ext. Company convention "AIGroup",
  KSB Company "KSB Australia Pty Ltd. [5055]", cost center per department, etc.) — treat
  the brief text as a near-final template but **confirm before shipping**.

### 7.2 HRT employee creation (the approval gate)
- This *is* the Admin review step (§4), not a separate email. On approve: create the
  `Employee` from the (possibly Admin-edited) request data, in a transaction, with history
  logging. **No `User` is created or linked** (out of scope — see §6.3). Admin can reject
  (e.g., hire didn't happen).

### 7.3 Forms jobs
- Letter of offer **not** signed → reminder email to manager, **scheduled for commencement
  date**.
- Employment forms and/or police check required → email manager with the attached
  form(s) (manager gives them to employee pre-email). **Form attachments not supplied (§9.1.4).**
- Marketing induction → email Marketing to book a time. **Marketing recipient TBD (§9.1.5).**
- Medical required → email manager on commencement date + a follow-up email to the
  employee a few days later (must wait for their mailbox to exist). **Medical instructions
  copy UNFINISHED (§9.1.3).**
- Either vehicle checkbox → need a copy of driver licence for HRT; email them to give it to
  "Vicki", and create an Admin task to add a licence record (prefill like employee
  creation). **"Vicki" should be a configurable recipient, not hard-coded (§9.1.5).**

### 7.4 Program jobs
- For each selected program: email IT with the ticket link(s) + required info (incl.
  reference user where applicable). One consolidated email vs one-per-program is a choice
  (recommend one consolidated email to IT). **Depends on the program catalogue (§6.4).**

### 7.5 Hardware jobs
- For each selected hardware item: format a payload and POST to the hardware-request
  platform (one request per item; the platform handles approval routing). The platform
  needs the manager identity for approvals. **Hardware API contract UNFINISHED (§9.1.2).**

## 8. Proposed build order (phased — safe to parallelise where noted)

> **For splitting this across parallel agents**, see the companion
> [`docs/onboarding-build-plan.md`](onboarding-build-plan.md) — it maps these phases onto
> discrete projects with a dependency graph, a schema "landing pass", and the collision
> gotchas (shared `schema.prisma`, nav, and the DB file under worktrees).

> Rationale: land the risky data migration behind the existing form first, then build the
> new form against a stable model, then layer jobs (which depend on content that may still
> be pending).

**Phase 0 — Decisions.** The schema-shaping forks are **RESOLVED** (§9.0): legal+preferred
name rename, persisted-but-derived internal/external, manager-on-request-only, hybrid
OnboardingRequest storage. Remaining §9.1 items are content/contract gaps that block
specific *jobs* (Phase 6) and a couple of prefills, not the schema — they can be filled in
parallel. Before Phase 1, the status→internal/external mapping is confirmed (§9.0).

> NOTE: This is a rough ordering to be turned into the real phase plan **with the owner**
> (their sequencing/timeline preferences pending). Job Family is now a *small* in-scope
> piece (column + managed list + selector + prefills) — NOT a foundational refactor.

**Phase 1 — Name model migration (highest risk, do first, alone).**
1. Schema: rename `firstName/lastName` → `legalFirstName/legalLastName`, add
   `preferredFirstName/preferredLastName`. `pnpm prisma db push`.
2. Backfill script (`preferred = legal`).
3. Sweep all read sites (search, selectors, duplicate detection, matchingService, exports,
   profile) to index/display both names. Update `EmployeeAddForm` + `employee-edit-form`.
4. Verify existing flows still work before moving on.

**Phase 2 — Reference data & config (mostly parallelisable, low risk).**
- `JobFamily` model + `Employee.jobFamilyId` + managed-list admin UI/API (Department-style).
- `MedicalStandard` model + admin UI/API; seed KSB Standard / No / Telfer.
- Derived `employmentType` column + `deriveEmploymentType(status)` helper (§6.2).
- Program catalogue + hardware-config + admin-editable config surfaces scaffolding (§6.7):
  email-template editor (blank/placeholder templates), recipient settings, ticket base URL +
  hardware endpoint config, compliance-attachment upload. Seed placeholders.

**Phase 3 — OnboardingRequest model + service + submit API.**
- `prisma` model + `db push`; `onboardingService` (create, list, get, approve, reject);
  `POST /api/onboarding` (auth: any authenticated manager) + `GET`/`GET [id]` +
  approve/reject routes (auth: Admin). History logging on approve/reject.

**Phase 4 — The form UI** (`components/forms/onboarding-form.tsx` + page).
- Build sections §5 with conditional logic and prefills (Job Family + title-fallback).
  Reuse `DateSelector`, `AddDepartmentDialog`, `AddLocationDialog`, employee-selector.
  Internal/external alert. Computed-email confirmation. Pulls Job Family / Medical / catalogue
  options from APIs. Client → `POST /api/onboarding`.

**Phase 5 — Admin review/approve UI.**
- List of pending requests; detail view with editable **core HR fields** (the bit the Admin
  actually gates); approve → transactional create of `Employee` (no `User`), archive JSON
  payload to the employee profile (§6.3), enqueue jobs; reject with reason.

**Phase 6 — Job fan-out.**
- Wire each §7 job. Most are `mailService.send` calls rendering the admin-editable templates;
  scheduled ones use `scheduledAt`. Add new handlers only for the hardware API (and IT
  ticketing later). Email copy/recipients/contracts can land incrementally as the owner fills
  templates in — the wiring shouldn't block on content.

## 9. OPEN QUESTIONS & DECISIONS NEEDED

### 9.0 RESOLVED (2026-06-19)
- **Manager storage** → on `OnboardingRequest` only (no first-class Employee/User field in v1). (§6.3)
- **Name model** → rename `firstName/lastName` → `legalFirstName/legalLastName` **and** add
  `preferredFirstName/preferredLastName`. (§6.1)
- **Internal/external** → derived deterministically from `EmployeeStatus` **but persisted**
  as a column kept in sync via a helper. (§6.2)
- **OnboardingRequest storage** → hybrid (explicit columns for admin-reviewed HR fields,
  JSON for the rest); Admin's approval gates **only the `Employee` creation (no `User`)**,
  and the full JSON is archived to the employee profile. (§6.3)
- **Job Family (this project)** → first-class managed model + `Employee.jobFamilyId` +
  form selector + prefills only. The **requirements refactor is OUT OF SCOPE** — a separate
  later project; requirements stay department-keyed, and when Job Family does come to
  requirements it will be an additional layer, not a replacement. (§6.5)
- **Approval mechanism** → dedicated `OnboardingStatus` field (Pending/Approved/Rejected/
  Cancelled), **Admin-only** (assumed — flag if DeptManagers should approve too). Not the
  multi-stage `ApprovalRequest` engine. Note: the existing Training approval feature is not
  yet in production and may still change, so don't couple onboarding to it.
- **Status → internal/external mapping** → **External:** `LabourContractor`,
  `IndustryExperience`, `Apprentice`. **Internal:** `Permanent`, `PartTimePermanent`. (§6.2)
- **Email address** → computed `firstname.lastname@{companyDetails.domain_extension}` (domain
  from config). (§6.7)
- **Medical levels** → managed `MedicalStandard` table (NOT a Prisma enum), admin-editable,
  pulled via API. Seed: KSB Standard / No / Telfer. (§6.6)
- **Catalogues & config are Admin-editable** → program catalogue (stores ticket number;
  link base `https://itsp.intern.ksb.com/assystnet/#serviceOfferings/{ticketNumber}`),
  hardware endpoint `https://checkout.ksb.com.au/` (placeholder), email templates,
  recipients, compliance attachments — all managed via admin tools. (§6.4, §6.7)

### 9.1 Still open — content the owner will supply later (NON-blocking; build editors + placeholders)
These no longer need a *decision* — the structure is decided (admin-editable, §6.7). They're
just content the owner fills in over time. Build the editors/placeholders now; don't block.
1. **Program catalogue contents** — real ticket numbers + "info required" text per program.
2. **Hardware platform API contract** — auth + exact per-item payload (endpoint placeholdered).
3. **Email copy** — internal & external next-steps branches, plus marketing/medical/licence
   bodies. (Owner: "I'll fill in as I have time.")
4. **Compliance form attachments** — employment + police-check files to upload.
5. **Recipients** — Marketing induction address, medical contacts, licence recipient ("Vicki").
6. **`companyDetails.domain_extension`** — sourced from the `NEXT_PUBLIC_COMPANY_DOMAIN_EXTENSION`
   env var (`lib/data.ts`). **No action needed** — if the env file isn't filled in the whole
   app breaks far beyond email, so this is the deployer's responsibility, not an onboarding gap.

## 10. UNFINISHED parts of the source brief (call-outs)

Lifted directly from `employee-add-form.txt` — these are areas the author left open:
- The **internal branch** of the manager next-steps email is blank (line 52–54).
- The external branch trails off mid-sentence ("…request access for the employee to get
  them an email address by visiting" — line 74, no URL).
- Medical, marketing, and licence email bodies are described but **not written**.
- Program **IT ticket link catalogue** is referenced but not provided ("we will have a list
  of links").
- Hardware **API contract** is referenced but not provided ("bum off the job to an API").
- The author flags the **name migration**, **Job Family**, **reference-user prefill**, and
  **manager-in-DB** as ideas still being weighed, not settled decisions.

## 11. Notes for agents picking this up
- Read this whole doc + `components/forms/employee-add-form.txt` before starting.
- Honour project conventions in `memory/MEMORY.md` (pnpm, `db push`, Prisma client import
  path, service/route/admin-page patterns, responsive dialogs).
- **Do not create git commits** unless the user explicitly asks.
- Phase 1 (name migration) is the highest-risk change and should be done and verified in
  isolation before the form is built on top of it.
- Email fan-out should reuse `mailService`/`SEND_EMAIL`; don't add bespoke SMTP code.
