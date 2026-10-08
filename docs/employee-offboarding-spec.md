# Employee Offboarding Form — Specification & Implementation Plan

> **Status:** DRAFT / planning (2026-10-02). Derived from the owner's brief plus a gap
> analysis against the built onboarding feature (`docs/employee-onboarding-spec.md`).
> Decisions the owner has confirmed are marked **DECIDED**. Items marked **OPEN** need
> content or a decision before that piece is built — build the wiring/editors around them,
> don't block on them.

## 1. Purpose & summary

Today an employee "leaves" HRT when someone edits them to inactive or their `finishDate`
passes (the nightly `INACTIVE_EMPLOYEE_CHECK` sweep). Either path immediately fires
`ASSET_CHECKIN`, which checks **every** Snipe asset back in and deactivates the Snipe user.
Nothing else happens: no mailbox handling, no device-return guidance, no HR/Payroll/IT
notification, no site-security cleanup.

The new **Offboarding Form** is the manager-facing counterpart to the onboarding form. A
manager picks the departing employee, sets the last day, and answers questions about the
mailbox, devices, phone numbers and site access. Submitting creates a pending
**`OffboardingRequest`**; an Admin reviews and approves it (**same gate as onboarding —
DECIDED**). Approval sets the end date and fans out the downstream jobs (emails to the
manager, offboarding handler, mailbox delegate, HR, Payroll, IT, site security; Snipe
"awaiting return" state; scheduled reminders).

**The form is the blessed path.** Deactivating directly in HRT stays possible (sometimes you
need to go in the back door) but shows a notice and keeps today's behaviour (§6.2).

The audience is managers who will not read instructions. **Every conditional section must
be blunt and obvious**: plain-language alerts, prefilled templates, and explicit
"this will / will NOT happen" statements.

## 2. Scope

**In scope (v1):**
- Offboarding form (manager-facing) + `OffboardingRequest` model + Admin review/approve/
  reject/cancel UI.
- End date + inactive in HRT; HRT login ban; Snipe "awaiting return" state.
- Mailbox auto-reply + delegate access flow (with declaration of consent).
- Device handling: Snipe lookup, laptop data access, phone/iPad number handling, unknown
  devices.
- Extended software access (rare case) with scheduled program-removal tickets.
- Site security (managed table, Salto/keys) per location.
- Emails: manager (IAM or Workday instructions), offboarding handler (collection/asset list),
  mailbox delegate (tutorial), laptop-data recipient, HR, Payroll, IT, site security.
- Admin-editable templates, recipients and document attachments for all of the above.
- Offboarding tab on the employee profile, pending count badge, report, "my requests".

**Out of scope / later:**
- Receptionist integration — placeholder only (§7.10).
- Vehicle return — section placeholder; process not yet confirmed with the fleet team (§5.8).
- Accessories (Snipe accessories/consumables) — **DECIDED: ignore**; treated as disposable.
- Landline forwarding — **DECIDED: landlines are not forwarded.**
- Reassigning HRT responsibilities the leaver holds — flag-and-escalate only in v1 (§7.9).

## 3. Current-state facts (verified against the codebase)

- **Onboarding pattern to mirror:** `OnboardingRequest` (hybrid columns + JSON `payload`),
  `onboardingService` (create/list/get/approve/reject), `onboardingFanOutService.enqueueAll`
  (sections run via `Promise.allSettled`, failures logged per section), approve route
  `app/api/onboarding/[id]/approve/route.ts`, admin pages under `app/admin/onboarding/`,
  form at `components/forms/onboarding-form.tsx`, page under `app/forms/`, profile tab
  `app/employees/[id]/components/tabs/onboarding-tab.tsx`, pending badge in
  `app/landing-page-content.tsx`, report `app/reports/employee/onboarding/`.
- **Mail:** `mailService.send` → `SEND_EMAIL` job; deferred sends via
  `enqueue("SEND_EMAIL", payload, scheduledAt)`. Templates via
  `emailTemplateService.render(key, vars)` (returns `null` when a template is switched off),
  keys + tokens registered in `lib/email-templates/tokens.ts` / `defaults.ts`.
- **Config:** scalar config in `AppSetting` via `appSettingService` (see `onboarding.*` keys).
  Attachment slots stored as JSON arrays in AppSetting via `onboardingConfigService`.
- **Snipe / AssetCheckout** (`lib/services/assetCheckoutService.ts`):
  `lookupUserByEmail`, `getUserAssets(userId)` (assets only — no accessories),
  `offboardUser(userId)` (checks in **all** assets + deactivates the Snipe user).
  Snipe users are matched on `buildEmployeeEmail(preferredFirst, preferredLast)` — fragile
  (recent fix for names containing spaces). Category detection: `lib/hardware-category.ts`
  (`isPhoneCategory`, `isTabletCategory`).
- **Phone numbers:** `Employee.mobile` / `Employee.phone` already mirrored from Snipe by
  `SNIPE_PHONE_SYNC` — usable for prefill without a live call.
- **Deactivation side effects today:** `employeeService.enqueueOffboardingIfDeactivated`
  (on edit) and `inactiveEmployeeCheckHandler` (on finishDate) both enqueue `ASSET_CHECKIN`
  and invalidate the requirements cache.
- **Rehire:** `employeeRehire.ts` clears `finishDate` and reactivates; notes that
  `mobile`/`phone` survive offboarding. Onboarding's hardware number option `REUSE` lets a
  new hire inherit a departing employee's number.
- **Users:** every HRT `User` has a linked `Employee` (owner-confirmed). better-auth admin
  plugin fields `banned` / `banReason` / `banExpires` exist on `User`.
- **Location** has no security metadata today (`name`, `state`, `isActive`).

## 4. Personas & flow

1. **Manager (submitter)** — fills the form. Prefilled as the leaver's manager, editable
   (on-behalf-of, as onboarding).
2. **Offboarding handler** — the person who physically deals with the leaver (collects
   devices, keys, swipe cards). Defaults to the manager; set separately when the manager is
   at a different site.
3. **Mailbox delegate / laptop-data recipient / call-forward target** — employees picked on
   the form.
4. **Admin (reviewer)** — reviews, corrects, approves/rejects/cancels.
5. **Local IT** — receives the signed consent form and raises the mailbox ticket with
   **global IT** (local IT has no mailbox access); records the ticket ref and marks access
   granted in HRT (§7.4).
6. **Downstream recipients** — HR, Payroll, site security, (later) reception.

**Happy path:** Manager submits → `OffboardingRequest(Pending)` → Admin notified → Admin
reviews/edits → Approve → transaction: set `Employee.finishDate`, link request, mark
`offboardedViaForm` → post-commit fan-out (immediate + scheduled jobs) → on the last day the
sweep deactivates the employee **without** the blanket Snipe check-in (§6.2) → IT checks
devices in as they arrive.

## 5. Form structure

"Prefill" = default, still editable. Every conditional section must state plainly what will
and won't happen.

### 5.1 Employee & dates
| Field | Type | Notes |
|---|---|---|
| Departing employee | employee selector (active employees only) | Required. On select, load their devices (§5.5) and prefill phone info. Block if an open (Pending/Approved-not-finished) offboarding request already exists for them. |
| Manager | employee selector | Prefill = submitter's linked employee. |
| Offboarding handler | employee selector | Prefill = manager. Helper text: *"The person who will physically collect laptops, phones, keys and swipe cards. Change this if the manager isn't at the same site."* |
| Last working day | date picker | Required. Becomes `Employee.finishDate` on approval. |
| Leaving reason | dropdown | Resignation / Termination / End of contract / Retirement / Other. **OPEN:** confirm list and whether HR/Payroll want it. |
| Extend software access past termination | checkbox (under the date picker) | Default unchecked. See §5.1.1. |

#### 5.1.1 Extended software access (rare) — DECIDED
Normally, software access dies with the Workday/IAM deactivation — **no program tickets are
raised**. Rarely, someone is kept on in Workday after their last day; then their access
must be cancelled explicitly.
- When ticked, show a disclaimer: *"Only tick this if this person is being kept active in
  Workday/IAM after their last working day (e.g. for a handover period). Their software
  access will NOT be removed automatically. IT will be asked to remove it on the date
  below. If you're not sure, leave this unticked."*
- **Intended termination date** (date picker, required when ticked, must be after last day).
- **Programs to remove** (checkbox list from the `Program` catalogue). Prefill from the
  employee's archived onboarding payload where one exists; otherwise all unticked.
- Effect: a scheduled IT email at the intended termination date listing removal ticket links
  (§7.4). The IAM/Workday instructions (§7.1) use the intended termination date instead of
  the last day.

### 5.2 Mailbox
| Field | Type | Notes |
|---|---|---|
| Set an auto-reply? | yes/no | Required answer (no default) so it can't be skipped. |
| Auto-reply message | textarea | Shown when yes. **Prefilled with an editable template** (admin-editable, §6.6) interpolating the leaver's name, last day, and the delegate/manager as contact. A "Reset to template" button. Helper: *"This is exactly what people emailing them will see. Edit the bits in brackets."* |
| Does someone need access to their mailbox? | yes/no | Required answer. |
| Who needs access | employee selector | Shown when yes. Prefill = the submitter. |
| Consent acknowledgement | checkbox (required when yes) | See notice below. |
| Signed declaration of consent | file upload (optional) | Alternative: tick *"I will email the signed form to IT"*. One of the two is required. |

Notices shown when "yes" (all prominent, not small text):
- *"The mailbox will **NOT** be forwarded. Requests to forward a mailbox will not be
  approved."*
- *"The employee **must** sign the Declaration of Consent form [download link]. **Without the
  signed form, IT will not request mailbox access.** Upload it here, or email it to IT."*
  (Behind the scenes local IT forwards it to global IT, §7.4 — the manager doesn't need to
  know that, but should be told access can take a few days after the form is received.)
- *"Access normally lasts about **3 months**, then the mailbox is deleted."* (retention =
  config, default 90 days).

**DECIDED:** the signed form must end up with IT. **OPEN:** if the employee has already gone
and can't sign (walked out, terminated), what's the path? Proposed: the manager ticks
"employee unavailable to sign", which routes the request to HR for a decision instead of IT.

### 5.3 Workday / IAM
No inputs. Show a plain notice derived from the leaver's `employmentType`:
- Internal → *"You'll be emailed instructions to end this person in **Workday**."*
- External → *"You'll be emailed instructions to end this person in **KSB IAM**."*

### 5.4 Site security
No inputs normally. If the leaver's location has a site-security type (§6.4), show what will
happen, e.g. *"Bundamba uses Salto access. Their access will be removed and **their keys
must be handed back** to the offboarding handler."* Optional checkbox *"They also have
access at another site"* + location multi-select, for people who roam.

### 5.5 Devices (from Snipe)
On employee select, call `GET /api/offboarding/devices?employeeId=` (§6.5). Show a loading
state, then the list of assets checked out to them (tag, name, model, serial, category). If
the lookup fails or finds no Snipe user, say so plainly and point them at §5.7 — **the form
must remain submittable**.

**Laptops** (any non-phone, non-tablet computer category):
| Field | Type | Notes |
|---|---|---|
| Does anyone need data from this laptop? | yes/no per laptop | Required answer. |
| Who needs the data | employee selector | When yes. IT grants this person access. |
| Notice | — | Always: *"This laptop must be sent to IT and **will be wiped**. Instructions are in the email."* |

**Phones / iPads** (`isPhoneCategory` / `isTabletCategory`):
| Field | Type | Notes |
|---|---|---|
| Has a mobile number | checkbox | **Auto-ticked when `Employee.mobile` is set**; show the number. |
| What should happen to the number? | radio | Cancel it / Forward calls to someone / Keep it for a replacement. Shown when the box is ticked. |
| Forward calls to | employee selector | When "forward". Prefill = submitter. |
| Notice | — | *"The device must be sent to IT and **will be wiped**."* |

"Keep for a replacement" ties to onboarding's `REUSE` number option — the number is not
cancelled, and IT is told to hold it. **OPEN:** how long IT holds an unclaimed number /
forwarding before cancelling it (config value).

### 5.6 Assets & accessories handback
No inputs. The handler email (§7.3) includes the full Snipe asset list as a checklist.
Accessories are ignored (**DECIDED**).

### 5.7 Devices we don't know about
Repeatable rows: device type (Laptop / Phone / iPad / Other), description, serial/asset tag
(optional), and the same follow-up questions as §5.5 for laptops/phones. Helper: *"Our
records are usually right, but if they have anything not listed above, add it here."* These
go to IT for reconciliation in Snipe.

### 5.8 Vehicle — OPEN (placeholder)
Ask only "Do they have a KSB vehicle or fuel card?" (prefill from the onboarding payload's
`willReceiveVehicle` if available). Wire a configurable recipient + template, content TBD
once the fleet team confirms the process.

### 5.9 Department notes
Three freeform boxes as onboarding: note to **IT**, **HR**, **Payroll**.

## 6. Data model & derivations

### 6.1 OffboardingRequest (new) — hybrid storage, same as onboarding
```prisma
enum OffboardingStatus {
  Pending
  Approved
  Rejected
  Cancelled   // e.g. resignation withdrawn
  Completed   // all tracked actions done (optional; see §9)
}

model OffboardingRequest {
  id                 Int               @id @default(autoincrement())
  status             OffboardingStatus @default(Pending)
  submittedByUserId  String
  submittedByUser    User              @relation("OffboardingSubmissions", fields: [submittedByUserId], references: [id])

  // --- Core fields the ADMIN reviews/edits ---
  employeeId           Int
  employee             Employee        @relation(fields: [employeeId], references: [id])
  managerEmployeeId    Int?
  handlerEmployeeId    Int?
  lastWorkingDay       DateTime        // → Employee.finishDate on approval
  leavingReason        String?
  extendedAccess       Boolean         @default(false)
  intendedTerminationDate DateTime?    // required when extendedAccess

  // --- Mailbox (columns: drive gated jobs + IT follow-up) ---
  autoReplyEnabled     Boolean         @default(false)
  mailboxDelegateEmployeeId Int?
  consentStatus        ConsentStatus   @default(NotRequired) // NotRequired | Uploaded | EmailedToIT | Received | Unavailable
  consentFilePath      String?
  // Local IT can't do mailbox work; they raise a global IT ticket (§7.4)
  mailboxAccessStatus  MailboxAccessStatus @default(NotRequested) // NotRequested | AwaitingConsent | TicketRaised | Granted
  mailboxTicketRef     String?         // global ticket reference, entered by local IT

  // --- Non-core payload (drives jobs; archived to profile) ---
  payload              String          // JSON, see below

  // --- Lifecycle ---
  reviewedByUserId     String?
  reviewedAt           DateTime?
  reviewNotes          String?
  createdAt            DateTime        @default(now())
  updatedAt            DateTime        @updatedAt

  @@index([status])
  @@index([employeeId])
}
```
Payload shape:
```ts
interface OffboardingPayload {
  autoReplyText?: string | null;
  devices: Array<{
    source: "snipe" | "manual";
    snipeAssetId?: number; assetTag?: string; name: string; serial?: string | null;
    kind: "laptop" | "phone" | "tablet" | "other";
    // laptop
    dataAccessEmployeeId?: number | null;
    // phone/tablet
    hasNumber?: boolean; number?: string | null;
    numberAction?: "CANCEL" | "FORWARD" | "KEEP" | null;
    forwardToEmployeeId?: number | null;
  }>;
  programsToRemove: number[];          // only when extendedAccess
  extraSiteLocationIds: number[];
  vehicle?: { hasVehicleOrFuelCard?: boolean };
  notes: { it?: string | null; hr?: string | null; payroll?: string | null };
  snipeSnapshot?: { lookedUpAt: string; snipeUserId?: number; error?: string };
}
```
The Snipe device list is **snapshotted** into the payload at submit time, so the record of
what was expected back survives even if Snipe changes later.

### 6.2 Form vs back-door deactivation — DECIDED
Need to tell the two apart so form-driven offboarding doesn't trigger the blanket Snipe
check-in.
- **Flag:** derive it from the presence of an **Approved `OffboardingRequest`** for the
  employee (no extra Employee column needed). If a column turns out to be simpler for
  reports, add `Employee.offboardingRequestId Int?`.
- **Form path:** `enqueueOffboardingIfDeactivated` and `inactiveEmployeeCheckHandler` skip
  `ASSET_CHECKIN` when an approved request exists, and instead enqueue
  `OFFBOARDING_FINALISE` (§7.7). Requirements-cache invalidation still runs.
- **Back-door path (no request):** unchanged behaviour (blanket check-in), **plus a notice**
  in the employee edit UI when someone sets inactive or a finish date: *"The Offboarding
  form is the proper way to do this — it handles mailbox, devices, IT and HR. Setting this
  here only deactivates them and checks all their Snipe gear back in."* With a link to the
  form prefilled for that employee. Then let them carry on.

### 6.3 Snipe "awaiting return" state
Devices are in transit, not in IT's hands, so they must not be checked in on the last day.
- **New AssetCheckout endpoint** (separate repo): mark assets with a status label
  (e.g. **"Awaiting return"**) while keeping them checked out to the leaver.
  `assetCheckoutService.markAwaitingReturn(userId, assetIds, note)`.
- IT checks each device in as it physically arrives (in Snipe/AssetCheckout as normal).
- The Snipe **user** is deactivated only once nothing is left checked out to them — either
  by AssetCheckout itself or by a periodic HRT job (`OFFBOARDING_RETURN_CHECK`, §7.8).
- **OPEN:** confirm the status label name, and whether AssetCheckout or HRT owns deactivating
  the Snipe user at the end.

### 6.4 Site security — DECIDED: managed table
```prisma
model SiteSecurityType {
  id            Int        @id @default(autoincrement())
  name          String     @unique   // e.g. "Salto", "Keys only", "None"
  recipients    String     @default("") // comma-separated; who removes access
  instructions  String     @default("") // shown on form + used in emails ({tokens})
  requiresKeyReturn Boolean @default(false)
  isActive      Boolean    @default(true)
  locations     Location[]
}
// Location gains: siteSecurityTypeId Int?
```
Admin-editable like `MedicalStandard`. **Seed:** "Salto" (requiresKeyReturn = true,
recipients = `Brandon.wiedman@ksb.com, Peter.Thomas@ksb.com`) assigned to Bundamba. Nothing
about Salto/Bundamba is hard-coded.

### 6.5 Device lookup API
`GET /api/offboarding/devices?employeeId=` (auth: any authenticated user who can submit the
form): build the Snipe email via `buildEmployeeEmail`, `lookupUserByEmail` →
`getUserAssets`, classify with `lib/hardware-category.ts`, return
`{ snipeUserId, assets[], mobile, error? }`. Errors return 200 with `error` set so the form
degrades instead of failing. 10 s timeout (existing `REQUEST_TIMEOUT_MS`).

### 6.6 Admin-editable configuration — DECIDED
All new copy, recipients and documents are admin-editable (no hard-coding):
- **Email templates** (new keys in `lib/email-templates/tokens.ts` + `defaults.ts`):
  `offboarding.manager.workday`, `offboarding.manager.iam`, `offboarding.handler.collection`
  (with `.row` fragment for the asset list), `offboarding.delegate.mailboxTutorial`,
  `offboarding.it.summary`, `offboarding.it.dataAccess`, `offboarding.it.programRemoval`
  (+ `.row`), `offboarding.hr`, `offboarding.payroll`, `offboarding.siteSecurity`,
  `offboarding.deviceReturnReminder`, `offboarding.autoReply` (the form's prefill text),
  `offboarding.vehicle` (placeholder).
- **Recipients** (AppSetting): `offboarding.recipient.it`, `.hr`, `.payroll`,
  `.vehicle`. Default to the onboarding values where they match.
- **Scalars** (AppSetting): `offboarding.mailboxRetentionDays` (default 90), `offboarding.mailboxTicketNumber`,
  `offboarding.mailboxNudgeDays`,
  `offboarding.deviceReturnReminderDays`, `offboarding.numberHoldDays`.
- **Documents — many, not fixed slots (DECIDED: "there will be many forms")**: rather than
  more one-off AppSetting slots, add a managed table:
  ```prisma
  model OffboardingDocument {
    id       Int     @id @default(autoincrement())
    name     String               // "Declaration of Consent", ...
    filePath String
    trigger  String               // ALWAYS | MAILBOX_ACCESS | LAPTOP_DATA | VEHICLE | ...
    audience String               // MANAGER | HANDLER | DELEGATE | IT
    isActive Boolean @default(true)
  }
  ```
  The fan-out attaches every active document whose trigger matches the request to the
  matching audience's email (respecting the `MAX_EMAIL_SIZE` guard already used by
  onboarding). The Declaration of Consent is seeded as `MAILBOX_ACCESS` / `MANAGER` and is
  also linked for download on the form. Consider later migrating onboarding's two slots onto
  the same table.
- **Program catalogue:** add `Program.offboardTicketNumber String?` for removal tickets
  (used only on the extended-access path).

### 6.7 Profile, reporting, navigation
- **Offboarding tab** on the employee profile (read-only view of the request + payload,
  current Snipe "awaiting return" status if available).
- Pending-count badge on the landing page (as onboarding), admin list/detail under
  `app/admin/offboarding/`, report under `app/reports/employee/offboarding/`, and submitted
  requests shown in `app/forms/my-requests`.

## 7. Downstream jobs (fan-out)

Run after Admin approval via `offboardingFanOutService.enqueueAll`, same
`Promise.allSettled` per-section pattern as onboarding. Immediate sends use
`mailService.send`; dated ones use `enqueue("SEND_EMAIL", …, scheduledAt)`.

### 7.1 HRT record (the approval transaction)
Set `Employee.finishDate = lastWorkingDay` (date-only normalisation per `lib/dates.ts`),
link the request, history-log both. **Do not** set `isActive = false` here — the existing
sweep does it on the day, which now branches per §6.2. If the last day is today or past,
deactivate immediately via the same branch.

### 7.2 Manager: Workday or IAM instructions
- Internal → `offboarding.manager.workday`; External → `offboarding.manager.iam`.
  Date used = `intendedTerminationDate` if extended access, else `lastWorkingDay`.
- **DECIDED (column A + B):** managers are supposed to do this but HR ends up doing it about
  half the time. So: the manager gets the instructions, **HR is CC'd** on the internal
  (Workday) one, and HR gets a scheduled check on the termination date: *"Confirm X has been
  ended in Workday."* **OPEN:** whether external/IAM gets the same HR follow-up.
- Includes a summary of everything else that's been set in motion.

### 7.3 Offboarding handler: collection checklist
To the handler (CC manager if different): the Snipe asset list + manual devices as a
checklist, device return/wipe instructions, keys/swipe cards if the site requires key return,
and any `HANDLER`-audience documents. Sent immediately; a reminder on the last day.

### 7.4 IT
- **Summary** (immediate): leaver, last day, mailbox decisions (auto-reply text, delegate,
  consent status/attachment), device list with per-device decisions (data access target,
  number cancel/forward/keep + forward target), manual devices to reconcile, IT note.
- **Mailbox access — two-tier IT (DECIDED 2026-10-02):** *local* IT does **not** have
  mailbox access. Local IT receives the signed consent form, then raises a ticket in the
  **global** ticket system; *global* IT does the actual mailbox work. So the flow is:
  1. Local IT's summary email says plainly: *"Do not raise the global mailbox ticket until
     the signed Declaration of Consent is received."* If the form was uploaded it's attached;
     if the manager chose "will email to IT", the email says so.
  2. Local IT marks **consent received** on the request in HRT (`consentStatus = Received`).
     HRT then shows them a **pre-filled block to paste into the global ticket** (leaver,
     delegate, auto-reply text, retention period, last day, consent form attached) and a
     link to the global service offering (`offboarding.mailboxTicketNumber`, built on the
     existing `onboarding.itTicketBaseUrl` — **OPEN:** confirm it's the same Assyst system and
     get the offering number).
  3. Local IT records the **global ticket reference** (`mailboxTicketRef`) →
     `mailboxAccessStatus = TicketRaised`.
  4. HRT has no visibility into the global system, so when global IT finishes, local IT
     marks **access granted** (`mailboxAccessStatus = Granted`). This is what sends the
     delegate tutorial (§7.5) — never earlier, so the delegate isn't told to open a mailbox
     they can't reach.
  - A scheduled nudge to local IT if the request sits in `Uploaded`/`EmailedToIT` or
    `TicketRaised` for more than N days (`offboarding.mailboxNudgeDays`).
  - **OPEN:** is the auto-reply also a global-IT mail job (same ticket), or can local IT set
    it? Assumed: same global ticket.
- **Program removal** (extended access only): scheduled at `intendedTerminationDate`,
  listing removal ticket links built from `Program.offboardTicketNumber`.

### 7.5 Mailbox delegate: access tutorial
Tutorial-style template `offboarding.delegate.mailboxTutorial` (how to add a shared mailbox
in Outlook desktop/web/mobile, retention period, "this is not forwarded"). Recipient email
= delegate's linked `User.email`, else `buildEmployeeEmail(...)`.

### 7.6 HR & Payroll
HR: leaver details, reason, last day, HR note, plus the Workday follow-up from §7.2.
Payroll: leaver, last day, reason, Payroll note (final pay / leave payout). Sent immediately.

### 7.7 Last day: `OFFBOARDING_FINALISE` (new JobType)
Enqueued by the sweep/edit when an approved request exists (§6.2):
- Mark Snipe assets "Awaiting return" (§6.3).
- **Ban the HRT login** — set `User.banned = true`, `banReason = "Offboarded (request #N)"`,
  revoke sessions (better-auth admin API). **DECIDED.**
- Invalidate requirements cache (already done by the deactivation path).
- Raise the HRT-responsibility flags (§7.9).

### 7.8 Device return follow-up: `OFFBOARDING_RETURN_CHECK` (new JobType, scheduled)
N days after the last day (`offboarding.deviceReturnReminderDays`), check Snipe for items
still checked out to the leaver. If any, email the handler + manager (template
`offboarding.deviceReturnReminder`). Once none remain, deactivate the Snipe user (if HRT owns
that, §6.3) and optionally mark the request `Completed`.

### 7.9 HRT responsibilities held by the leaver — partially OPEN
The leaver may be a department manager (`User.managedDepartments`), a nominated approver
(`ApprovalRequest.nominatedApprover`), an SOP trainer (`SopTrainerAssignment`), or the
`managerEmployeeId` on open onboarding/offboarding requests.
- **v1 (DECIDED direction):** pass it up the chain temporarily and flag it as temporary.
  Show these on the Admin review screen as warnings, and on finalise reassign to the next
  level up with a "temporary — reassign" flag surfaced to Admins.
- **OPEN:** what "up the chain" means. There's no manager field on `Employee`. Candidates:
  the leaver's manager from this request, or the parent department's manager. Also the
  shape of the "temporary" flag (per-relation column vs a separate task list).

### 7.10 Site security
If the leaver's location (or any extra site, §5.4) has a `SiteSecurityType`: email its
recipients with removal instructions (`offboarding.siteSecurity`) at the last day; if
`requiresKeyReturn`, the handler checklist includes keys.

### 7.11 Receptionist — placeholder
Upcoming integration. Reserve a fan-out section that's a no-op with a `TODO` and a note in
the admin UI. No JobType until the integration contract exists.

### 7.12 Vehicle — placeholder
If `vehicle.hasVehicleOrFuelCard`, email `offboarding.recipient.vehicle` with the
`offboarding.vehicle` template once content exists (template switched off by default).

## 8. Review, edit & cancel

- Admin review screen: editable core fields (dates, manager, handler, delegate, extended
  access), payload shown read-only with per-section warnings (no Snipe user found, manual
  devices, leaver holds HRT responsibilities, consent not supplied).
- **Cancel** (resignation withdrawn): allowed while Pending, and while Approved if the last
  day hasn't passed. Cancelling an approved request clears `finishDate`, cancels pending
  scheduled jobs for that request (needs a way to find them — store the request id in each
  job payload and cancel by it), and emails the manager/IT/HR that it's off.
- **Changing the last day** after approval: update `finishDate` and reschedule dated jobs
  (cancel + re-enqueue). Same mechanism as cancel.
- **Rehire** interaction: `employeeRehire` already clears `finishDate`; an old approved
  request must not block a future offboarding (the "open request" check only looks at
  requests whose last day hasn't passed).

## 9. Build order

**Phase 0 — AssetCheckout endpoint** (separate repo, can run in parallel): "mark awaiting
return" + agree who deactivates the Snipe user.

**Phase 1 — Schema landing pass (one agent, then freeze):** `OffboardingRequest`,
`OffboardingStatus`, `ConsentStatus`, `MailboxAccessStatus`, `SiteSecurityType` + `Location.siteSecurityTypeId`,
`OffboardingDocument`, `Program.offboardTicketNumber`, new JobTypes
(`OFFBOARDING_FINALISE`, `OFFBOARDING_RETURN_CHECK`), seeds (Salto/Bundamba, templates,
settings, Declaration of Consent document row). Nav entries in the same pass.

**Phase 2 — Reference data & config (parallel):** SiteSecurityType admin UI + Location
field; OffboardingDocument admin UI (upload); template keys/tokens/defaults; AppSettings;
Program removal ticket field in the program editor.

**Phase 3 — Service + APIs:** `offboardingService` (create/list/get/approve/reject/cancel/
reschedule), device lookup route, consent upload route, and local-IT mailbox routes
(mark consent received → record global ticket ref → mark access granted).

**Phase 4 — Form UI** (`components/forms/offboarding-form.tsx`, page under `app/forms/`).

**Phase 5 — Admin review UI + profile tab + report + badge + my-requests.**

**Phase 6 — Deactivation branch (§6.2)** + back-door notice in the employee edit UI.
Do this **with** Phase 7 or after it — shipping it alone would stop check-ins for
form-offboarded people with nothing replacing them.

**Phase 7 — Fan-out + new job handlers** (§7). Content can land incrementally.

## 10. Open questions

1. Leaving-reason list, and whether HR/Payroll need it. (§5.1)
2. Consent path when the employee is gone and can't sign — route to HR? (§5.2)
3. Global IT mailbox ticket: same Assyst system/base URL as onboarding? Offering number?
   Does the auto-reply go on the same global ticket? (§7.4)
4. Snipe status label name; AssetCheckout vs HRT deactivating the Snipe user. (§6.3)
5. How long IT holds a kept/forwarded number before cancelling. (§5.5)
6. HR follow-up on External/IAM terminations too, or Workday only? (§7.2)
7. "Up the chain" for reassigning the leaver's HRT responsibilities, and how the temporary
   flag is stored. (§7.9)
8. Vehicle/fuel-card process — waiting on the fleet team. (§5.8)
9. Receptionist integration contract. (§7.11)
10. Whether `Completed` status is worth tracking, or Approved is enough. (§6.1)
