# Workday Org Import & Line-Manager Authority — Specification & Implementation Plan

> **Status:** DESIGN SETTLED (2026-10-07). Derived from the owner's brief and design
> discussion. Decisions the owner has confirmed are marked **DECIDED**. Items marked **OPEN**
> need a decision before that piece is built. Build the wiring around them; don't block on them.
> Revised after the 2026-10-07 review (§15); see §16 for what changed and §14 for the
> open questions it raised.

## 1. Purpose & summary

HRT's org structure is maintained by hand and has drifted from reality. Department-manager
grants point at people who have left Workday (Gary Zeidler, Jackson Willems) or are inactive
in HRT (Cowen Stokes), and titles are stale for roughly 60 of 103 people.

This feature has two parts:

1. **Workday org import (Phase 1).** An admin uploads a fresh Workday org-chart export. HRT
   compares it with its own data and produces a list of **suggested** edits. Nothing is
   changed without approval, and every suggestion can be applied, skipped this time, or
   ignored forever, one line at a time. Ignore-forever rules can be listed and removed later.
2. **Line-manager authority (Phase 2).** HRT gains a person-to-person **Reports to**
   relationship. Authority (seeing and managing people, approvals, notifications) moves from
   department-manager grants to that reporting line, with **delegated access** for people who
   oversee others outside the line. **DECIDED:** line managers get authority (owner: "100%").

Phase 1 adds no new authority. Reporting lines and delegated-access grants are imported and
shown first, so the import is proven on harmless data before Phase 2 makes them drive
authority. **One exception:** until Phase 2, the department still decides who can see and
approve someone and who gets their expiry emails, so applying a §7.4 department line changes
who has authority over that person. The department line shows this (§7.4).

## 2. Scope

**Phase 1: import, reporting lines, suggestions**
- `Employee.reportsToId` (self-relation), editable by hand on the employee form, shown on the
  profile and as a reporting-lines view on `/admin/org-chart`. Every write (form, import
  apply) rejects a change that would make someone their own manager or create a cycle.
- Reporting-line suggestions for **external staff** (§7.10), since Workday never covers them
  and Phase 2 depends on everyone having a line.
- Upload and parse of the Workday `.xlsx` export, with stored import sessions.
- Matching Workday rows to HRT employees, with links that are confirmed once and remembered.
- Suggestions for reports-to, title, preferred name, department, and delegated access, plus
  flags for people not in HRT, matches to inactive employees, and internal staff missing from
  Workday.
- Per-line ✓ / ✗ / ignore-forever review UI. Applying writes `History` rows.
- Ignore-rules management screen (list, filter, remove).
- Delegated-access grants are **stored and shown** in Phase 1 but don't affect permissions
  until Phase 2.

**Phase 2: authority switch-over**
- RBAC, employee scoping, requirement visibility, approvals and expiry notifications driven
  by the reporting line plus delegated access.
- Moving today's department-manager grants across, reviewed in the same suggestion UI.
- Retiring `canManageChildrenDepartments`.

**Out of scope**
- **Location from Workday. DECIDED: never imported.** The export's location column isn't
  reliable, and location is half of the training key (§4), so a wrong value silently changes
  someone's required training.
- Creating employees from Workday. **DECIDED:** new people are flagged with a pointer to the
  onboarding form, so the onboarding fan-out (emails, Snipe setup) isn't bypassed.
- Deactivating employees missing from Workday. **DECIDED:** flag only. Deactivation fires
  `ASSET_CHECKIN`, which checks in all Snipe assets.
- Job family suggestions (§4).

## 3. Current-state facts (verified against the codebase)

- **No person-to-person relationship exists.** The org chart is `Department` (with a
  `parentDepartmentId` hierarchy) plus `User.managedDepartments` (many-to-many
  `_DepartmentManager`). The only line-manager value is `OnboardingRequest.managerEmployeeId`,
  which is stored on the request only.
- **Training key:** `TrainingRequirement` / `TicketRequirement` are keyed on
  `(departmentId, locationId)`, with `-1` meaning "any" on either side
  (`requirementService.getEmployeeRequirements`, `lib/services/requirementService.ts:61`).
  Title plays no part. `JobFamily` only prefills onboarding hardware.
- **Authority is inconsistent today.** Four different rules for child departments:

  | Code | Rule |
  |---|---|
  | `employeeService` scoping (`:127`), `requirementService` visibility (`:40`), `accessCheckService` (`:69`) | Manager of a **level-0** department gets all its children |
  | `apiRBAC.hasAccessToEmployee` (`:58`) | Level 0 → itself + children; level 1 → itself; **level 2+ → nothing** (moot today: the DB only has levels 0 and 1) |
  | `approvalService.getPendingRequestsForUser` (`:144`), `app/api/org-chart/route.ts` | Children only if `canManageChildrenDepartments` |
  | `expiryNotificationRecipients` (`:26`) | Exact department only, no children |

  Department levels matter for delegated-access filters too: `Operations` is a level-0 parent
  of `Stores`, `Purchasing`, `Production`, `Test Bay` and others.
- **Approvals:** `ApprovalStage` = `DepartmentManager → HRManager → Admin`
  (`approvalService.ts:11`). Who *sees* a stage-1 request is computed when listing
  (`getPendingRequestsForUser`, `:143`): anyone who manages the employee's current
  department (no role check). `reevaluatePendingRequests` (`:199`) warns when no
  `role: DepartmentManager` user manages it. **The decision endpoint enforces nothing:**
  `POST /api/training-requests/[id]/decision` → `recordDecision` checked neither stage
  eligibility nor self-approval, so any signed-in user who knew the id could decide any stage.
  **Fixed 2026-10-07, ahead of Phase 1:** `recordDecision` now allows a decision only on what
  `getPendingRequestsForUser` would show that user (one shared `decidableFilter`), and rejects
  anyone deciding a request about themselves, admins included (`NOT_AUTHORISED` /
  `SELF_APPROVAL` → 403).
  An "on behalf of" path already exists (`nominatedApproverEmployeeId`; deciding when you
  aren't the nominee requires a comment).
- **Expiry notifications** go to department managers of the employee's exact department
  (`expiryNotificationRecipients.ts:26`), with opted-in admins on Cc, and admins promoted to
  To when there are no managers.
- **Permissions are role-based.** `auth.api.userHasPermission({ role })` against the roles in
  `lib/permissions.ts` (`DepartmentManager` has `employee.viewDepartment`,
  `trainingRequest.approve`, etc.), plus the client-side role in `lib/auth-client.ts`. A user
  has one role.
- **Generated email addresses.** `buildEmployeeEmail` (preferred names, whitespace dropped) is
  used to find the Snipe user in `ASSET_CHECKIN` (`assetCheckin.ts:41`) and
  `SNIPE_PHONE_SYNC`. No Snipe user found means check-in is **skipped silently**
  (`skipped: true`), not failed. **DECIDED: mailboxes are based on the preferred name.** Where a
  linked `User.email` doesn't match the generated address, the data is wrong, not the rule.
  For example, Hayley-Ann Hargrave's `User.email` reads `hayleyann.hargrave@`, which the owner
  says is likely a typo.
- **Employment type:** `deriveEmploymentType` (`lib/employment.ts`): Permanent /
  PartTimePermanent → Internal, everything else → External. `employmentType` is nullable and
  null on most current rows, so the importer derives it from `status`.
- **Deactivation side effects:** `employeeService.enqueueOffboardingIfDeactivated` and the
  `INACTIVE_EMPLOYEE_CHECK` sweep both enqueue `ASSET_CHECKIN`.
- **Rehire:** `lib/services/employeeRehire.ts` clears `finishDate` and reactivates.
- **Audit:** `History` (`tableName`, `recordId`, `action`, `changedFields`, `oldValues`,
  `newValues`, `userId`).
- **Spreadsheet parsing:** `xlsx` (SheetJS 0.20.3) is already a dependency.

## 4. Guiding principle: what each property is for

Each property's purpose decides whether Workday may suggest it and how much weight a change
carries.

| Property | Purpose | Owner | Importer behaviour |
|---|---|---|---|
| `reportsToId` (new) | Authority: who answers for whom (Phase 2) | Workday for internal staff; HRT for external staff | Suggest |
| `departmentId` | **Training key** (with location). Was also authority; Phase 2 removes that | HRT | Suggest, **showing the training impact** (and, until Phase 2, the manager impact) |
| `locationId` | **Training key** (with department) | HRT | Never touched |
| `title` | Display and reports | Workday | Suggest |
| `preferredFirstName/LastName` | How the person is known | Workday | Suggest |
| `legalFirstName/LastName` | Certificates, USI, compliance records | HRT | **Never touched.** Used for matching only |
| `jobFamily` | The intended finer-grained training key. Not set up yet because it's a lot of work | HRT | Not suggested (could later be clustered from titles) |
| `isActive` / `finishDate` | Employment lifecycle, with Snipe side effects | HRT (onboarding/offboarding flows) | Flag only |
| Delegated access (new) | Authority outside the reporting line | HRT | Suggest (§8) |

Department and location were set up before job family existed and are the coarser,
working training key. Since a department change is really a change to someone's required
training, the suggestion must show what changes.

## 5. The Workday export

Sheet `Org Chart`, one row per **internal** employee (external staff are never present):

| Column | Example | Use |
|---|---|---|
| Unique Identifier | `31_Brandon_Wiedman` | **Not stable.** It's a row index plus the name and is renumbered on every export. Used only to resolve `Reports To` *within* one file |
| Name | `Brandon Wiedman` | The **preferred** display name. Matching key (§6) |
| Reports To | `4_Dorel_Strungaru` | Unique Identifier of the manager row; blank for the root |
| Line Detail 1 | `IT Supervisor` | Job title |
| Line Detail 2 | (blank) | Ignored |
| Line Detail 3 | `Bundamba` | Location. **Ignored** (§2) |
| Organization Name | (blank) | Ignored |

**DECIDED:** the export can't be changed. There's no stable Workday ID, so identity rests on
names plus the remembered links in §6.

Parsing rules:
- Find columns by header text, not position, and fail clearly if `Name` or `Reports To` is
  missing.
- Trim whitespace. Ignore case and whitespace-only differences when comparing (`CRAIG WHELAN`
  must not suggest a name change; `PROJECT ENGINEER` vs `Project Engineer` must not suggest
  a title change).
- Validate the tree: exactly one root, no cycles, every `Reports To` resolves. Problems are
  reported on the import, not thrown.

## 6. Matching Workday rows to HRT employees

Order of precedence for each Workday row:

1. **Remembered link** (`WorkdayLink`, keyed on the normalised Workday name). Once confirmed,
   it wins over steps 2–4, **unless the linked employee is now inactive**: then the row is
   shown as an inactive match (§7.7) instead of being trusted. This catches a new hire who
   shares a name with a linked leaver (the "Maree Toa" case). Choosing **Link anyway** there
   keeps the link for this session (the flag returns on the next import unless ignored
   forever). After a rehire the same record is active again and the link just works.
2. **Exact match** of the normalised name against active employees, using preferred
   first + last (falling back to legal for null parts) and legal first + last.
3. **Exact match against inactive employees.** Flagged as an inactive match (§7.7), never
   auto-linked.
4. **Candidates** for manual linking, ranked by matching surname, then first-name
   similarity (prefix, nickname or shared stem), active before inactive. Examples from the
   real data:

   | Workday | HRT candidate |
   |---|---|
   | Fred Botma | Frederik Botma |
   | Nick Todeschino | Nicholas Todeschino |
   | Hayley Hargrave | Hayley-Ann Hargrave |
   | Tommy Hamim | Muhamad Hamim |
   | Rahul Siddam | Sri Sai Siddam |
   | Maree Toa | Rosemaree Toa (**active**). An older inactive "Maree Toa" also exists, so the active record is preferred |

The link line offers **Link** / **Choose other…** / **Not in HRT**. Confirming writes a
`WorkdayLink` **immediately**, not on Apply: links are identity, not data changes, and saving
them straight away lets lines that were blocked on the link ("Link Brett Lewis first") be
recalculated and ticked in the same pass. "Not in HRT" also writes a link with
`employeeId = null`, so the row is treated as new rather than re-matched each time. A link can
be undone from the person card (deletes the `WorkdayLink`; the row is matched afresh).

Two Workday rows with the same normalised name are both marked ambiguous and need
manual linking.

## 7. Suggestion types

Each suggestion is one **line**: one person, one field, one proposed value. Lines group under
a person card. Lines that can't be applied yet (e.g. the person or their manager isn't linked)
show as blocked, with the reason.

**Line identity.** A line is identified by `(subjectKey, field, value)`, the same triple an
ignore rule stores (§11):
- `subjectKey` = `emp:<employeeId>` for anything about an HRT employee, or
  `wd:<workdayNameKey>` for row-level flags about an unlinked Workday row (`notInHrt`,
  `inactiveMatch`).
- `value` = the normalised proposed value: the manager's employee id, the department id,
  `first|last` for names, lower-cased and whitespace-collapsed title, `<scopeManagerId>:<deptId or blank>`
  for delegated access, and `""` for person-level flags.

The line id is a hash of that triple, so it's stable across recalculations: a tick survives
a recalculation, and a line whose proposed value changes gets a new id and comes back unticked.

### 7.1 Reports to
Workday's `Reports To` resolves to a Workday row → its linked HRT employee. Suggest when it
differs from `reportsToId`. If the manager row isn't linked, the line is blocked: "Link Brett
Lewis first". The file itself is a valid tree (§5), but applying a subset of lines on top of
hand-edited HRT data can still close a loop, so the apply step runs the same cycle check as
the employee form (§10).

### 7.2 Title
Suggest when `Line Detail 1` differs from `title`, ignoring case and whitespace.

### 7.3 Preferred name — DECIDED: preferred only, never legal
Workday's `Name` is the preferred name. Compare it with HRT's effective preferred name
(`preferredFirstName ?? legalFirstName`, `preferredLastName ?? legalLastName`). When it
differs, suggest setting **`preferredFirstName` / `preferredLastName`**:
- Fred Botma: preferred `Frederik` → `Fred`.
- Tommy Hamim: preferred (null, shows legal `Muhamad`) → `Tommy`.

Per name part, if Workday's value equals the **legal** part, the suggestion **clears** the
preferred part (sets it to null) rather than copying the legal value into it. Legal names
are still never written.

Splitting the single Name string: if it ends with the HRT surname (legal or preferred), the
rest is the first name (`Andrew` + `Staunton Smith`, `Dylan` + `De Wit`). Otherwise use the
first token, then the rest. The split can be edited on the line before ticking.

Name changes affect the generated email address (`buildEmployeeEmail` uses preferred names),
which is how `ASSET_CHECKIN` and `SNIPE_PHONE_SYNC` find the Snipe user (§3). **DECIDED:**
mailboxes follow the preferred name, so a name line is never blocked. It shows:

- **Info:** "Generated email changes from `frederik.botma@` to `fred.botma@`", whenever the
  address would change.
- **Warning:** when the linked `User.email` doesn't match the address the *new* name would
  generate. For example: "Login email is `hayleyann.hargrave@`, but this name generates
  `hayley.hargrave@`. Check the account and Snipe for a typo." This is a data-quality pointer;
  the line can still be ticked.

### 7.4 Department (with training impact)
Suggest a department when **at least two thirds** of the person's same-manager peers (minimum
3 peers, counting only linked active employees) share a department that differs from theirs.
- Cameron Yarrow: Service Coordination → **Sales External** (3 of 4 of Tobias Knop's other
  reports).
- Patrick Phillips: Sales Internal → **Sales External** (same team).

Each department line shows the **training impact** at the employee's current location:
trainings and tickets added or removed, and any that would become immediately overdue. This
comes from the same requirement resolution as `requirementService`, run as a dry run.

Until Phase 2 the department also decides authority (§1), so the line also shows the
**department managers gained and lost**: who would start or stop seeing the person,
approving their stage-1 requests and receiving their expiry emails. It uses the existing
rules in §3 (including the level-0 and `canManageChildrenDepartments` differences), so it
shows what will actually happen, not a tidied-up version.

Department suggestions are the weakest signal (a peer majority isn't proof), so they are
never pre-ticked.

### 7.5 Delegated access
See §8.

### 7.6 Not in HRT
A Workday row with no link and no confident match (e.g. Muhammad Hilmy Aziz). Options:
**Link to existing…**, **Ignore forever**, and a link to the onboarding form.

### 7.7 Matches an inactive employee
A Workday row whose only match is inactive (Troy Phillips, Kashif Bashir, Philip Credo, Cowen
Stokes), **or whose remembered link points at an employee who is now inactive** (§6).
Options: **Open rehire** (goes to the existing rehire flow; no one-click reactivation),
**Link anyway**, **Ignore forever**.

### 7.8 Missing from Workday
Active employees whose derived employment type is **Internal** with no Workday row linked to
them (e.g. Gary Zeidler, Jackson Willems, Andrea Ducey). Options: **Start offboarding**
(links to the offboarding form) and **Ignore forever**. External staff are expected to be
missing and are never flagged.

**Grace period:** people whose `startDate` is in the future or within the last **30 days**
are not flagged, since HRT onboarding usually runs ahead of Workday. The number is a named
constant (`MISSING_FROM_WORKDAY_GRACE_DAYS`). **DECIDED: 30 days.**

### 7.9 Manager of an external employee left
An external employee is flagged when their `reportsToId` target, **in this import**, is
either flagged as missing from Workday (§7.8) or is inactive in HRT. The flag asks for the manager to be reassigned by hand. No change is
suggested.

### 7.10 External staff without a reporting line
Workday never lists external staff (apprentices, labour contractors, industry-experience
staff), and §4 makes HRT the owner of their `reportsToId`. Nothing else fills it in, so
without this step Phase 2 would leave nobody with authority over them. For each **active
external** employee with no `reportsToId`, suggest a manager from, in order:
1. the `OnboardingRequest` that created them (`createdEmployeeId` = the employee) →
   `managerEmployeeId`;
2. today's managers of their department (`_DepartmentManager` users that are linked to an
   employee). Several managers give one line with a picker; none gives a blocked line
   ("set by hand on the employee form").

Lines start unticked. They don't depend on the uploaded file, so they also appear on a
session whose file has nothing to say about these people.

## 8. Delegated access

### 8.1 What it is
A grant saying **"this employee acts at the level of manager X"**: they get X's scope over
X's reports (X's sub-tree, excluding X), optionally limited to one department. It covers
people who oversee others without being their line manager.

| Grantee | Acts at the level of | Department filter | Effective scope |
|---|---|---|---|
| Carolyn Molony | Joshua Noakes | none | Craig Whelan, Jarrod Brown, Tommy Hamim |
| Brody Wagner | Scott Hertrick | none | Scott's 5 service technicians |
| Kerrod Ward | Peter Thomas | Operations | the workshop tradespeople on Peter's team |

**DECIDED: a delegate has the same authority as the manager they act for**, within their
scope. That covers viewing and managing records, approvals (§9.2) and expiry notifications
(§9.3). There is no per-grant approval switch.

**DECIDED: the only way to narrow a grant is a department filter** (team ∩ department), as in
Kerrod's row. There's no hand-picking of individuals, so grants stay correct as people join or
leave the team or department. The filter matches the **exact department only**; child
departments are not included. `Operations` is a level-0 parent of `Stores`, `Purchasing` and
`Production`, so including children would widen Kerrod's grant to Zane Mair's (Stores) and
Nathan Dale's (Purchasing) areas, which is not the "workshop tradespeople" in the table.

**The grantee is never in their own scope.** Kerrod is on Peter's team and in Operations, but
his grant doesn't cover himself, so he can't approve his own requests.

In Phase 1 grants are stored and shown on the org chart (in a different colour from line
authority) but have no effect. Creating or removing a grant writes a `History` row
(`tableName: "DelegatedAccess"`), like any other change.

### 8.2 Suggestion signals: structure first, title second

**Signal A: structural (primary).** A person with **no reports** whose **peers include a
manager** is a candidate to act at that peer manager's level. In Workday this is how a
coordinator or supervisor appears: next to the supervisor rather than above the team.
Results on the real export:

| Team of | Peer manager(s) | Candidates (no reports) |
|---|---|---|
| Marcos Tilly | Joshua Noakes (3) | Carolyn Molony (Service Coordinator), Cowen Stokes (KAM / Site Supervisor) |
| Rodrigo Monteiro | Scott Hertrick (5) | Brody Wagner, Sandra Burkhardt (Service Contract Coordinators) |
| Jaco Tromp | Ian Pino, Parag Soni, Peter Thomas | Allan Atkinson, Githa Labuschagne, Michael Smith, Tracey Dawson |
| Dorel Strungaru | Brandon Wiedman | Daniel Fleckhammer, Vicki Jongebloed |
| Brett Lewis | Bret Kendall, Marcos Tilly, Rodrigo Monteiro | 6 sales engineers / BDMs |
| Philippe Olivier | 9 managers | Ashley Fernandez, Christian Flutey, Taylen Walsh |

The signal is clean lower in the tree and noisy higher up, where peers of managers are
senior individual contributors. So candidates are ranked, not just listed:

- **Strengthens it:**
  - the team is small and mostly non-managers (Marcos: 1 manager + 2 others);
  - the candidate's department matches the peer manager's team's main department;
  - the title contains an oversight word (Coordinator, Supervisor, Controller, Planner,
    Scheduler, Administrator, Leading Hand, Foreman, **Forman**). The misspelling is in the
    real data: Kerrod Ward's Workday title is `Workshop Forman`, and without it Signal B
    misses its main example.
- **Suppresses it:**
  - the team belongs to the root or the root's direct reports (Philippe's, Brett Lewis's,
    Jaco Tromp's and Dorel Strungaru's teams);
  - the candidate is an Admin (they already see everyone);
  - the candidate is inactive in HRT (Cowen Stokes, until resolved via §7.7).

**Initial threshold (tune after the first real import).** Suppressed candidates are dropped.
The rest score 1 for the structural signal, plus 1 for each strengthener (small team = at most
5 people, under half of them managers). Show a line at **score ≥ 3**. Checked against the
real export and current HRT departments:

| Candidate | Small team | Oversight word | Dept matches | Score | Shown |
|---|---|---|---|---|---|
| Carolyn Molony → Joshua Noakes | ✓ | ✓ | ✓ (Service) | 4 | Yes |
| Brody Wagner → Scott Hertrick | ✓ | ✓ | ✗ (Service Coordination vs Service) | 3 | Yes |
| Sandra Burkhardt → Scott Hertrick | ✓ | ✓ | ✗ | 3 | Yes |
| Cowen Stokes → Joshua Noakes | | | | | No, inactive |
| Jaco Tromp's, Dorel's, Brett Lewis's, Philippe's teams | | | | | No, root or root's direct report |

That gives exactly the expected strong suggestions: Carolyn → Joshua Noakes, Brody → Scott
Hertrick, Sandra → Scott Hertrick.

**Signal B: flat team plus title (secondary).** Within a team of 5+ people with no
sub-managers, a person whose title contains an oversight word is a candidate to act at their
own manager's level, filtered to **the candidate's own HRT department** (editable on the line
before ticking). There's no score: those three conditions are the threshold. On Peter
Thomas's team (12 people, all individual contributors):

| Candidate | Workday title | Suggested scope |
|---|---|---|
| Kerrod Ward | Workshop Forman | Peter Thomas, Operations |
| Zane Mair | Leading Hand Storeperson | Peter Thomas, Stores |
| Nathan Dale | Purchasing Supervisor | Peter Thomas, Purchasing |
| Hayley Hargrave | Production Planner and Scheduler | Peter Thomas, Sales Internal (her current HRT department; likely should be Production, so edit the filter or fix her department first) |

**Signal C: migration (Phase 2, reviewed before the switch-over).** An existing
department-manager grant that the person's reporting line doesn't already cover. For example, Kerrod holds Service, Stores,
Production and Test Bay today with 0 reports. Suggest turning it into delegated access or
dropping it (§9.4).

Like every other line, delegated-access suggestions are ✓ / ✗ / ignore forever. Saying no
costs nothing; the point is to save clicks.

### 8.3 Grants left behind — DECIDED
Grants are never removed automatically. Employees are deactivated rather than deleted, so
`Cascade` never fires and a grant can outlive the situation it was made for. For example,
Carolyn acts at Joshua's level; Joshua leaves and his team moves to Sam. Carolyn's grant
still points at Joshua, who now has no one under him, so she silently loses the team she
coordinates.

Each import shows a **"Delegated access left behind"** line (field `staleDelegatedAccess`,
value = grant id) when:
- the grantee is inactive or missing from Workday;
- the manager they act for is inactive or missing from Workday; or
- nobody actively reports to that manager any more, so the grant covers no one.

The line is ✓ / ✗ / ignore forever like any other, and starts unticked. ✓ removes the grant
(writing a `DelegatedAccess` `DELETE` History row). Replacing it isn't automatic: when the
grantee fits Signal A or B for the new manager, that normal suggestion appears alongside.

## 9. Line-manager authority (Phase 2)

### 9.1 Scope
`scope(employee) = descendants(employee) ∪ delegated scopes`, where `descendants` follows
`reportsToId` transitively. A linked `User` uses their employee's scope. Admins keep
`viewAll`. This one function replaces the department logic in `apiRBAC.hasAccessToEmployee`,
`apiRBAC.getManagedDepartmentIds` (and its callers), `employeeService` scoping,
`requirementService` visibility and `accessCheckService`. It also removes the current
inconsistency in how child departments are handled.

`descendants()` walks with a visited set, so a cycle that slipped past the write-time checks
(§2) ends the walk and logs a warning instead of looping. A delegated scope is
`descendants(scopeManager)`, intersected with the grant's exact department when it has one,
minus the grantee.

- **DECIDED: viewing covers the whole sub-tree**, at any depth. Rodrigo sees Scott's techs,
  and Philippe sees everyone. Viewing is deliberately broader than approving (§9.2), because
  it's lower risk.
- **DECIDED: manager authority is derived, not assigned.** Anyone with a non-empty scope
  (direct reports or a delegated grant) gets manager permissions. Nobody sets a role by hand,
  so it can't drift.
  - The permission checks that currently ask "is the role `DepartmentManager`?"
    (`employee.viewDepartment` etc.) become "does this user have a non-empty scope?".
  - Authority no longer depends on the role. A Fire Warden with reports gets manager
    authority and keeps their Fire Warden permissions.
  - Phase 2 decides what happens to the `DepartmentManager` enum value: keep it as a
    computed or display value, or migrate those users to `User`.
  - **This is the main cost of Phase 2.** Permissions are role-based today (§3), so "has a
    non-empty scope" needs a database lookup wherever a role check stands now: server
    permission checks, navigation, and client-side gating in `auth-client.ts`. Intended
    shape: one `getEffectivePermissions(userId)` that loads the user's role plus
    `hasScope` once per request and checks the manager permissions (today's
    `DepartmentManager` statements) when `hasScope` is true, in addition to the role's own.
    The client gets `hasScope` alongside the session for UI gating; the server never trusts
    it. Spike this first (§13, step 12).

### 9.2 Approvals — DECIDED
- **Stage 1 eligible approvers:** the requester's **direct manager** and **that manager's
  manager** (one level up, for leave and absence). Never higher.
  - Elijah Dent: Scott Hertrick or Rodrigo Monteiro. Not Brett Lewis, not Philippe Olivier.
  - Scott Hertrick: Rodrigo Monteiro or Brett Lewis. Not Philippe Olivier.
- **Delegates count as the manager they act for** (§8.1). They're eligible wherever that
  manager would be, limited to their scope.
  - Craig Whelan: Joshua Noakes, Carolyn Molony (acts at Joshua's level), or Marcos Tilly
    (one up).
  - Anthony Smith: Peter Thomas, Kerrod Ward (acts at Peter's level ∩ Operations), or Jaco
    Tromp (one up).
  - This applies to the one-up manager too: a delegate acting at the one-up manager's level,
    whose scope covers the requester, is eligible (follows from Decision 1; no such grant
    exists in the expected suggestions). **DECIDED: yes.**
- **A delegate always sees whose behalf they act on.** When a delegate decides, the decision
  dialog says "You're approving on behalf of Joshua Noakes". The `ApprovalAction` records it
  (`onBehalfOf`, plus the manager acted for), and the request history shows "Carolyn Molony,
  on behalf of Joshua Noakes". It's a notice, not a gate: unlike an admin stepping in, no
  comment is required.
- **Eligibility is checked when someone decides**, against the current reporting line and
  grants, as today (the department is read at listing time, not stored on the request). If
  Elijah Dent moves teams while a request is pending, his new manager sees it and the old one
  stops seeing it. Earlier stages already decided stay decided.
- **`recordDecision` enforces eligibility** through the same filter as the pending list, and
  rejects self-approval. This was fixed ahead of Phase 1 (§3). Phase 2 only has to change
  `decidableFilter` to the line-manager rule.
- **Admins can step in at every stage**, using the existing on-behalf-of path, which requires
  a comment. The owner accepts that this may make some managers lazy, in exchange for nothing
  getting stuck.
- Nobody approves their own request.
- `reevaluatePendingRequests` warns when stage 1 has no eligible approver.
- `ApprovalStage.DepartmentManager` becomes `LineManager` (migration renames existing rows).

### 9.3 Expiry notifications
**DECIDED:** go to the **direct manager plus delegates acting at that manager's level** whose
scope includes the employee, instead of department managers. For Craig Whelan that's Joshua
Noakes and Carolyn Molony. Nobody higher up the line receives them. The admin handling stays
as it is: opted-in admins on Cc, and admins promoted to To when nobody else qualifies.

### 9.4 Migration of department-manager grants
Each existing `_DepartmentManager` row is either:
- **covered by the line**: everyone in that department is already in the grantee's
  descendants, so it's dropped; or
- **not covered**: shown as a Signal C delegated-access suggestion.

The admin reviews these in the same UI (§13 step 11), **before** the switch-over, so nobody
loses access in between. "Everyone in that department" uses what the grant covers today
(§3): a level-0 grant counts its child departments too. Because delegated-access filters are
exact (§8.1), a level-0 grant that isn't covered becomes one suggested grant per department
it covers today. `canManageChildrenDepartments` is removed once nothing reads it.

### 9.5 Account linking
Managers with no HRT login can't use their authority. **DECIDED:** this is a company-level
issue (people need to sign in) and needs no technical workaround.

### 9.6 Readiness check before switching
Retiring department authority strands anyone with no line. Before §13 step 13 is
switched on, an admin readiness report must be empty. It lists every **active employee other
than the Workday root with no `reportsToId`**: external staff not yet resolved via §7.10, and
internal staff missing from Workday whose line was never set by hand. It also lists any
existing cycle.

## 10. Review UI

Route: `/admin/org-chart/import` (Admin only), linked from the Org Chart page.

**Upload step:** drag-and-drop `.xlsx`. The file is parsed server-side and the import session
saved (parsed rows only, §11), then the user is taken to the review. A new upload
**supersedes** any older `Open` session (status `Superseded`; still viewable as a record),
so there's only ever one session to apply from.

**Review step:**
- A summary bar with counts per suggestion type, filters by type, and a search box.
- **Person cards** in Workday tree order, each showing name, Workday title and manager, the
  linked HRT employee, and its current department and location (read-only context).
- **Every line has ✓ apply / ✗ not this time / ignore forever. DECIDED.**
  - ✓ and ✗ are toggles on the line. ✗ means not applied this time; the line comes back on
    the next import.
  - Ignore forever opens a small confirm with an optional note, then hides the line.
  - Person-level **Tick all** / **Cross all**, and type-level shortcuts ("tick all title
    lines"), are shortcuts only. Each line keeps the final say.
- **Lines are always computed fresh** from the session's stored rows and current HRT data,
  links and ignore rules: on open, and after every link decision. ✓/✗ state is kept on the
  page, keyed by line id (§7), so it survives a recalculation.
- Default state:
  - Link lines need an explicit choice, and save as soon as it's made (§6).
  - Reports-to, title, name and external-reporting-line (§7.10) lines start **unticked**.
  - Department and delegated-access lines start **unticked**, with their reasoning shown
    ("3 of 4 peers are in Sales External", "peer of Joshua Noakes, Coordinator").
- **Apply selected** sends the ticked (and crossed) line ids and applies them in one
  transaction:
  - each ticked id is checked again against a fresh calculation. A line that no longer
    exists (already satisfied, value changed, now blocked) is skipped and reported as stale,
    never applied from the stored value;
  - order: names and titles, then reports-to, then department, then delegated access;
  - after the reports-to changes, the cycle check runs on the result; a cycle rolls back the
    whole apply with the people involved named;
  - one `History` row per changed record, with `changedFields` naming the import id;
  - requirement cache invalidation for department changes, as the employee edit path does.
- The session stays `Open` after an apply, so remaining lines can be applied in a later pass.
  Each apply run is recorded on the session (who, when, applied / crossed / stale line ids
  with old → new values), and the session page shows those runs as its record.

**Ignore rules screen:** `/admin/org-chart/import/rules` lists every rule (person, field,
ignored value, note, who and when), with filter and **Remove**. Removing one means that line
can appear again on the next import (or on a re-run of the current one).

## 11. Data model

```prisma
model Employee {
  // …existing
  reportsToId   Int?
  reportsTo     Employee?  @relation("ReportsTo", fields: [reportsToId], references: [id], onDelete: SetNull)
  directReports Employee[] @relation("ReportsTo")
  delegatedAccessGrants DelegatedAccess[] @relation("DelegateGrantee")
  delegatedAccessScopes DelegatedAccess[] @relation("DelegateScopeManager")
  workdayLinks       WorkdayLink[]
  workdayIgnoreRules WorkdayIgnoreRule[]
  @@index([reportsToId])
}

model Department {
  // …existing
  delegatedAccessGrants DelegatedAccess[]
}

// Acts at the level of `scopeManager`: their sub-tree (excl. the grantee), optionally ∩ one exact department
model DelegatedAccess {
  id                     Int         @id @default(autoincrement())
  granteeEmployeeId      Int
  grantee                Employee    @relation("DelegateGrantee", fields: [granteeEmployeeId], references: [id], onDelete: Cascade)
  scopeManagerEmployeeId Int
  scopeManager           Employee    @relation("DelegateScopeManager", fields: [scopeManagerEmployeeId], references: [id], onDelete: Cascade)
  departmentId           Int?        // optional filter
  department             Department? @relation(fields: [departmentId], references: [id], onDelete: Cascade) // never SetNull: that would silently widen the grant
  source                 String      // Manual | WorkdayStructural | WorkdayTitle | MigratedDeptGrant
  createdByUserId        String?
  createdAt              DateTime    @default(now())
  @@unique([granteeEmployeeId, scopeManagerEmployeeId, departmentId]) // only effective when departmentId is set (see below)
  @@index([scopeManagerEmployeeId])
}

// Remembered identity: normalised Workday name → HRT employee (null = confirmed "not in HRT")
model WorkdayLink {
  id                Int       @id @default(autoincrement())
  workdayNameKey    String    @unique // lower-case, letters only
  workdayName       String    // as last seen
  employeeId        Int?
  employee          Employee? @relation(fields: [employeeId], references: [id], onDelete: Cascade) // deleting the employee forgets the link, so the row is matched again
  confirmedByUserId String?
  confirmedAt       DateTime  @default(now())
}

model WorkdayImport {
  id               Int       @id @default(autoincrement())
  fileName         String
  uploadedByUserId String
  uploadedAt       DateTime  @default(now())
  rowCount         Int
  rows             String    // JSON: parsed rows (name, nameKey, reportsToName, title). The only stored input; lines are always recomputed
  problems         String?   // JSON: tree-validation problems (§5)
  status           String    // Open | Superseded | Discarded
  runs             String    @default("[]") // JSON: one entry per Apply (userId, at, applied/crossed/stale line ids with old → new values)
}

model WorkdayIgnoreRule {
  id              Int       @id @default(autoincrement())
  subjectKey      String    // "emp:<employeeId>" or "wd:<workdayNameKey>" (§7)
  employeeId      Int?      // set when subjectKey is emp:…
  employee        Employee? @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  workdayName     String?   // display only, as last seen
  field           String    // reportsTo | title | preferredName | department | delegatedAccess | externalReportsTo | notInHrt | inactiveMatch | missingFromWorkday
  value           String    @default("") // normalised suggested value (§7); "" for person-level flags. Never null (see below)
  note            String?
  createdByUserId String
  createdAt       DateTime  @default(now())
  @@unique([subjectKey, field, value])
}
```

**Optional columns in unique indexes.** SQLite (like Postgres) treats NULLs as distinct in a
unique index, so a nullable column in `@@unique` doesn't stop duplicates where it's null:
- `WorkdayIgnoreRule` avoids the problem: `value` is never null (`""` for person-level
  flags), and `subjectKey` is always set.
- `DelegatedAccess.departmentId` must stay nullable, since it's a real foreign key. The
  `@@unique` still blocks duplicate *filtered* grants; for unfiltered grants
  `delegatedAccessService` looks for an existing row inside the write transaction before
  inserting (SQLite serialises writes, so this is safe).

Ignore rules are **value-specific**: `Kerrod Ward · title · "workshop forman"` hides only that
value. If Workday later shows a different title, the line comes back. Rules about an HRT
employee are keyed by **employee id**, not name, so they survive a preferred-name change
applied by the import itself, and a Workday rename (once the row is re-linked). Only the
row-level flags for unlinked Workday rows (`notInHrt`, `inactiveMatch`) are keyed by Workday
name. `missingFromWorkday` is always `emp:<id>`.

Suggestions are **not stored**. Every view of an `Open` session recomputes lines from `rows`
plus current HRT data, links and rules, so lines already satisfied drop out and nothing can
be applied from a stale stored value (§10). A superseded or discarded session shows only its
`runs`.

## 12. Code layout

- `lib/workday/parseOrgChart.ts`: pure parser plus tree validation (unit tested against
  `example_org_chart.xlsx`-shaped fixtures).
- `lib/workday/matching.ts`: pure matching and candidate ranking.
- `lib/workday/suggestions.ts`: pure suggestion engine (inputs: parsed rows, employees,
  links, ignore rules → lines). Signals A and B live here.
- `lib/services/workdayImportService.ts`: sessions, apply transaction, History, cache
  invalidation.
- `lib/services/delegatedAccessService.ts`: grants CRUD (duplicate check for unfiltered
  grants, §11), History rows.
- `lib/org/reportingLine.ts`: pure `descendants()` (visited set), `wouldCreateCycle()`, and
  later `scope()`. Used by the employee form, the apply step, the readiness check (§9.6) and
  Phase 2.
- `app/api/workday-import/…`: upload, get session, apply, rules CRUD, links.
- `app/admin/org-chart/import/…`: upload, review and rules pages.
- Org chart: a "Reporting lines" view (tree) next to the existing department view.

## 13. Build order

**Phase 1**
1. Schema: `reportsToId`, `WorkdayLink`, `WorkdayImport`, `WorkdayIgnoreRule`,
   `DelegatedAccess` (with the `Department` relation), plus migration.
2. Parser and tree validation, with tests.
3. Matching and candidates, with tests (the name-variant cases in §6 and the inactive-link
   case as fixtures).
4. `lib/org/reportingLine.ts` (descendants, cycle check), with tests.
5. Suggestion engine: reports-to, title, name (with the generated-email info and login-email warning), flags
   (§7.1–7.3, 7.6–7.10), line ids, with tests.
6. Upload and review UI with immediate link saving, ✓/✗/ignore, and the apply transaction
   (re-check, cycle check, runs).
7. Ignore-rules screen.
8. Department suggestions with training-impact and manager-impact dry run (§7.4).
9. Delegated-access Signals A and B, and storing grants (§8).
10. Reports-to on the employee form (with the cycle check) and profile; reporting-lines org
    chart view.

**Phase 2** (after at least one real import has been reviewed)
11. Readiness report (§9.6) and department-grant migration review through Signal C (§9.4).
    Grants created here still have no effect.
12. Spike `getEffectivePermissions` / `hasScope` (§9.1) across server checks, navigation and
    client gating.
13. `scope()` and replacing department scoping across RBAC and services. Switched on only
    when the readiness report is empty.
14. Approvals: switch `decidableFilter` to line manager plus one up plus delegates (with the
    "on behalf of X" notice), admin at every stage, stage rename. Enforcement in
    `recordDecision` is already done (§3).
15. Expiry notifications.
16. Retire `canManageChildrenDepartments` and department-manager grants as authority.

## 13a. Phase 1 build notes (2026-10-07)

Phase 1 is built. Where the build differs from or adds to the sections above:

- **Line ids** are the plain `subjectKey~field~value` string rather than a hash. They're
  equally stable, and easier to debug.
- **History:** `changedFields` is the usual JSON array of field names (as everywhere else in
  HRT). The import id goes in `newValues.source` (`"WorkdayImport#<id>"`).
- **Department suggestions** skip moves *up* into an ancestor department (Stores → Operations,
  Operations Management → Operations). On the real export those were all noise. Moves down
  into a child are still suggested.
- **Inactive matches** also offer the other candidates (e.g. the active Rosemaree Toa for
  "Maree Toa"), which is how "the active record is preferred" works in practice. "Link
  anyway" isn't offered: a link to an inactive employee is flagged again anyway (§6), so
  the actions are *Open to rehire*, *Link to someone else* and *Ignore forever*.
- **Missing from Workday** links to the employee profile. The offboarding form doesn't exist
  yet; switch the button to it when it does.
- **External-staff manager suggestions** (§7.10) exclude anyone who is themselves flagged as
  missing from Workday.
- **The apply loop check** only rejects loops that involve someone the apply changes, so an
  existing hand-made loop can't block every import. The employee form and API also reject a
  manager change that would create a loop (`REPORTING_CYCLE`).
- **Signal B** excludes "Document Controller" from the oversight word "controller".
- **Requirement cache:** a department move from the importer queues
  `REQUIREMENTS_CACHE_INVALIDATE`. The ordinary employee edit path doesn't do this for a
  department or location change today, only on deactivation. That's an existing gap,
  separate from this feature.

Built files: `lib/workday/{types,parseOrgChart,matching,suggestions,labels}.ts`,
`lib/org/reportingLine.ts`, `lib/services/workdayImportService.ts`,
`app/api/workday-import/**`, `app/api/org-chart/reporting-lines`,
`app/admin/org-chart/import/**`, `app/admin/org-chart/reporting-lines-view.tsx`, plus
Reports To on the employee edit form, the profile and the employee API.

## 14. Decision log

All design questions from the design discussion are resolved (2026-10-07):

| # | Question | Decision |
|---|---|---|
| 1 | Can a delegate approve at the level they act at? | **Yes, always.** A delegate has the same authority as the manager they act for (§8.1) |
| 2 | How is a flat-team grant like Kerrod's narrowed? | **Team ∩ department.** No hand-picking (§8.1) |
| 3 | How far down can a manager see? | **The whole sub-tree** (§9.1) |
| 4 | How is the manager role assigned? | **Derived automatically** from a non-empty scope (§9.1) |
| 5 | Who gets expiry emails? | **Direct manager plus delegates at that level** (§9.3) |

Earlier decisions:
- Line managers get authority.
- Location is never imported.
- Legal names are never touched; Workday's name is compared with and written to the
  preferred name.
- Every line gets ✓ / ✗ / ignore forever.
- Approvals go to the direct manager plus one level up.
- Admins can step in at every stage.
- New people are flagged, not created.
- Leavers are flagged, not deactivated.
- The no-login problem is a company issue, not a technical one.

### Open questions (from the 2026-10-07 review, §16)

| # | Question | Default until decided |
|---|---|---|
| Q1 | **DECIDED.** Mailboxes follow the preferred name. Name lines are never blocked; a mismatched login email is a data-quality warning (§7.3) | — |
| Q2 | **DECIDED.** Yes, a delegate at the one-up level is eligible. Delegates are shown "approving on behalf of X" (§9.2) | — |
| Q3 | **DECIDED.** 30 days (§7.8) | — |
| Q4 | **DECIDED.** Grants left behind are flagged on each import as an unticked "remove the grant" line, never removed automatically (§8.3) | — |

## 15. Review (2026-10-07)

Codebase claims were checked against the code, and the parser assumptions against
`example_org_chart.xlsx` (one sheet, 103 rows, a single root, Philippe Olivier, and no duplicate
names after normalising). Issues are in order of importance.

### 15.1 Will cause bugs as written

1. **The two unique constraints with an optional column won't stop duplicates on SQLite.**
   SQLite treats NULLs as different from each other inside unique indexes. So
   `DelegatedAccess @@unique([grantee, scopeManager, departmentId])` allows any number of
   identical grants with no department filter. `WorkdayIgnoreRule @@unique([nameKey, field, value])`
   likewise allows any number of `notInHrt` / `missingFromWorkday` rules for the same person.
   Either store a sentinel value (`0` / `""`) instead of null, or check for an existing row in
   the service before inserting.
2. **`WorkdayLink.employee` uses `onDelete: SetNull`.** Deleting an employee would quietly turn
   their link into a confirmed "Not in HRT". It should be `Cascade`, so the row gets matched
   again on the next import.
3. **Ignore rules are keyed by name, and the import itself changes names.** For
   `missingFromWorkday` the key is the HRT employee's own name. If someone applies a
   preferred-name suggestion, the key changes and the rule stops matching. A rule is also lost
   when Workday renames someone. Add a nullable `employeeId` to `WorkdayIgnoreRule` and key on
   it whenever the person is linked.
4. **People can create reporting cycles by hand.** §5 checks the uploaded file for cycles, but
   `reportsToId` can also be edited on the employee form (§2). In Phase 2, `descendants()` would
   loop forever on a cycle. The employee form's save and the apply step both need to reject
   cycles, and `scope()` should keep track of nodes it has already visited.

### 15.2 Gaps in the design

5. **Phase 2 would remove authority over every external employee.** That covers apprentices,
   labour contractors and industry-experience staff. The spec says HRT owns `reportsToId` for
   these people, but nothing ever fills it in. Once department grants are retired, nobody would
   see or approve them. Phase 1 needs a step to fill in their reporting line (for example,
   suggestions taken from today's department managers or `OnboardingRequest.managerEmployeeId`).
   Phase 2 should not start while any active employee other than the root has no `reportsToId`.
6. **Name changes can break asset check-in.** `buildEmployeeEmail` is used to look up the Snipe
   user in `ASSET_CHECKIN` (`lib/jobs/handlers/assetCheckin.ts:41`) and `SNIPE_PHONE_SYNC`.
   Suppose Fred Botma's mailbox is actually `frederik.botma@`. Applying "Fred" would make
   offboarding check-in fail without any error months later. A warning on the line isn't
   enough. Check the generated address against the linked `User.email` where there is one, and
   treat a mismatch as a blocker, not a note.
7. **Phase 1 does change permissions.** Today the department decides who can see and approve
   someone and who gets their expiry emails. So applying a §7.4 department suggestion changes
   who has authority over that person. The impact panel should show the department managers
   gained and lost alongside the training changes. The statement "Phase 1 changes no
   permissions" in §1 should be qualified.
8. **The session model is muddled.**
   - Suggestions are stored when the file is uploaded, but recalculated when the session is
     reopened. Pick one: store the parsed rows and always recalculate.
   - Define the line ID explicitly, e.g. a hash of name key + field + proposed value.
   - When Apply runs, check each ticked line against the current data rather than trusting the
     stored value.
   - Say what happens to an older open session when a new file is uploaded. Suggested: the new
     upload discards it.
9. **Link decisions should save straight away, not on Apply.** A reports-to line stays blocked
   ("Link Brett Lewis first") until the manager is linked. If the link only saves on Apply, the
   line can't be ticked in the same pass. Links are about identity, not data changes, so save
   them immediately and recalculate the affected lines.
10. **A remembered link can attach a new hire to the wrong person.** The link always wins and is
    keyed by name only. A new hire with the same name as someone who left (the "Maree Toa"
    case) would be attached to the old, inactive record without any prompt. If the linked
    employee is inactive, show the line as an inactive match (§7.7) instead of trusting the link.
11. **"Missing from Workday" will flag recent starters.** People onboarded in HRT before they
    appear in Workday would be flagged. Skip anyone whose `startDate` falls within a grace
    period, say 30 days.

### 15.3 Factual corrections to §3

- **`employeeService` scoping doesn't use `canManageChildrenDepartments`.** It uses the level-0
  rule (`employeeService.ts:127`), as `accessCheckService` does. Only `approvalService` (`:144`)
  and `app/api/org-chart/route.ts` read the flag.
- **`apiRBAC.hasAccessToEmployee` ignores managed departments at level 2 or deeper.** It only
  handles levels 0 and 1. This supports the point that today's authority is inconsistent.

### 15.4 Points to make explicit for Phase 2

- **"Derived" manager authority conflicts with how permissions work today.** Permissions are
  role-based through better-auth (`auth.api.userHasPermission({ role })`, plus the client-side
  role in `auth-client.ts`). "Non-empty scope" means every check, and the navigation and UI
  gating, needs a lookup in the database. That is the main cost of Phase 2.
- **Approvals:**
  - Is a delegate of the one-up manager also eligible? For Craig Whelan, would someone acting at
    Marcos's level count?
  - Is eligibility checked when the request is created, or when someone decides on it? This
    matters if `reportsToId` changes while the request is pending.
- **§7.9 says "just become missing", which is vague.** Define it as: the reports-to target is
  flagged as missing from Workday, or is inactive, in this import.
- **§7.3:** if HRT's preferred name differs from Workday but the legal name matches Workday,
  suggest clearing the preferred name rather than copying the legal name into it.
- **`DelegatedAccess` needs more fields.**
  - `departmentId` should be a real relation to Department, so it can't be left pointing at a
    deleted department.
  - Grants should write `History` rows like any other change.
- **"Above a threshold" for Signals A and B** should name an initial number, even if it's tuned
  later.

## 16. Review disposition

Each §15 point was checked against the code (`approvalService.ts`, `apiRBAC.ts`,
`employeeService.ts`, `accessCheckService.ts`, `requirementService.ts`,
`expiryNotificationRecipients.ts`, `assetCheckin.ts`, `snipePhoneSync.ts`,
`permissions.ts`, the decision route), `example_org_chart.xlsx` (confirmed: one sheet `Org
Chart`, 103 rows, single root Philippe Olivier, no duplicate name keys, every `Reports To`
resolves) and the local DB. No §14 decision was changed.

| Point | Disposition | Rationale | Sections changed |
|---|---|---|---|
| 15.1.1 NULLs in unique indexes | Accept | True on SQLite. Ignore rules use `value ""` and an always-set `subjectKey`; unfiltered grants get a service-level check, since `departmentId` must stay a nullable FK | §11 |
| 15.1.2 `WorkdayLink` `SetNull` | Accept | Null means "confirmed not in HRT", so `SetNull` would quietly turn a deleted employee's link into that. Now `Cascade` | §11 |
| 15.1.3 Ignore rules keyed by name | Accept | Applying a name line would orphan the rule. Rules are keyed `emp:<id>`; only unlinked-row flags use `wd:<nameKey>` | §7, §11 |
| 15.1.4 Hand-made cycles | Accept | The form and apply paths both reject cycles; `descendants()` uses a visited set; readiness lists any cycle | §2, §7.1, §9.1, §9.6, §10, §12, §13 |
| 15.2.5 External staff lose all authority in Phase 2 | Accept | Real gap: §4 makes HRT the owner, but nothing fills the field in. Adds §7.10 suggestions (onboarding request, then today's department managers) and a readiness gate | §2, §7.10, §9.6, §10, §13 |
| 15.2.6 Name change breaks Snipe check-in | Partially accept | Confirmed: lookup is by generated address and a miss is a silent skip. Real case: `hayleyann.hargrave@` vs Workday "Hayley". A mismatch against a linked `User.email` now blocks the line. The better fix (look up by `User.email`) is an owner call | §3, §7.3, §14 Q1 |
| 15.2.7 Phase 1 does change permissions | Accept | The department decides authority until Phase 2. §1 qualified; department lines show managers gained and lost | §1, §7.4 |
| 15.2.8 Session model | Accept | Rows stored, lines always recomputed, line id = hash of (subjectKey, field, value), apply re-checks every line, a new upload supersedes older open sessions, and applies can run in several passes | §7, §10, §11 |
| 15.2.9 Save links immediately | Accept | Otherwise blocked reports-to lines can't be ticked in the same pass. Links are removed from the apply order | §6, §10 |
| 15.2.10 Remembered link to an inactive employee | Accept | Treated as an inactive match (§7.7). "Link anyway" keeps it, and rehire reactivates the same record | §6, §7.7 |
| 15.2.11 Recent starters flagged as missing | Accept | 30-day grace period (also covers future start dates) as a named constant | §7.8, §14 Q3 |
| 15.3 `employeeService` uses the level-0 rule | Accept | Verified (`employeeService.ts:127`). Only `approvalService:144` and the org-chart route read the flag | §3 |
| 15.3 `apiRBAC` ignores level 2+ | Accept | Verified (`apiRBAC.ts:58–71`). Moot today, since the DB has only levels 0 and 1 | §3 |
| 15.4 Derived authority vs role-based permissions | Accept | Decision 4 stands. Adds the implementation approach (`getEffectivePermissions` / `hasScope`) and a spike step | §3, §9.1, §13 |
| 15.4 Delegate of the one-up manager | Accept, confirm | Follows from Decision 1 ("eligible wherever that manager would be"). Written down; listed for confirmation | §9.2, §14 Q2 |
| 15.4 Eligibility at creation or decision | Accept | Decision time, which matches how it works today (department read at listing). Also found that `recordDecision` enforces no eligibility at all (see below) | §9.2 |
| 15.4 §7.9 "just become missing" | Accept | Now: target flagged missing from Workday, or inactive, in this import | §7.9 |
| 15.4 §7.3 clear the preferred name | Accept | Consistent with "legal never written": a part equal to the legal part clears the preferred part | §7.3 |
| 15.4 `DelegatedAccess` relation and History | Accept | Real `Department` relation with `Cascade` (not `SetNull`, which would widen the grant). Grants write History | §8.1, §11, §12 |
| 15.4 Threshold for Signals A and B | Accept | Signal A: score ≥ 3, which reproduces exactly the three expected suggestions on the real export. Signal B's three conditions are its threshold | §8.2 |
| *Found during review:* decision endpoint unguarded | Added | `POST /api/training-requests/[id]/decision` checks neither eligibility nor self-approval. Live gap today | §3, §9.2, §13 |
| *Found:* Kerrod's title is `Workshop Forman` | Added | Signal B's word list missed its own main example. Added `Forman` and corrected the table | §8.2 |
| *Found:* Signal B filter rule contradicted its table | Added | The table uses each candidate's own department, not the peers' majority. Rule fixed; Hayley's HRT department (Sales Internal) noted | §8.2 |
| *Found:* department filter and child departments | Added | Operations is a level-0 parent, so the filter is now explicitly exact-department, and level-0 grants migrate one per department | §3, §8.1, §9.4 |
| *Found:* build order switched authority before migrating grants | Added | Signal C review and readiness now come before the scope switch | §8.2, §9.4, §13 |
| *Found:* expiry admin Cc/fallback | Added | Kept unchanged in Phase 2 | §3, §9.3 |
| *Found:* grants outlive their grantee or scope manager | Raised | Employees are deactivated, not deleted, so `Cascade` never fires and a leaver's grant row stays. Flag-only proposal for the owner | §14 Q4 |
