# HRT Improved — Test Plan

## Overview

This document describes the recommended testing strategy, framework choices, and specific test cases for the HRT Improved application. The goal is holistic coverage across all layers: pure logic, services, API routes, and end-to-end user journeys.

---

## Recommended Testing Stack

| Layer | Tool | Rationale |
|---|---|---|
| Unit (pure functions) | **Vitest** | Fast, zero-config with Vite/Next.js, native ESM support |
| Service integration | **Vitest** + **vitest-mock-extended** (for Prisma mocking) | Isolate DB without spinning up SQLite |
| API route integration | **Vitest** + Next.js route handler test utilities | Test route handlers in-process |
| Component | **Vitest** + **@testing-library/react** + **jsdom** | Lightweight, co-located with Vitest |
| End-to-end | **Playwright** | Official Next.js recommendation; supports auth cookies |

### Required packages to install

```bash
pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom vitest-mock-extended @playwright/test
```

### Key configuration notes

- Use `vitest.config.ts` with `environment: 'node'` for unit/service tests and `environment: 'jsdom'` for component tests.
- Create a `__mocks__/prisma.ts` singleton mock (using `vitest-mock-extended`) and a test-db helper for integration tests that use the real SQLite adapter against a separate `prisma/test.db`.
- Playwright should target a locally running dev server (`baseURL: 'http://localhost:3000'`) with a pre-seeded test database.
- Because the project uses `package.json "type": "module"` and the Prisma v7 adapter, ensure vitest is configured to handle `@/generated/prisma_client/client` alias resolution.

---

## 1. Unit Tests — Pure Logic

These functions have no external dependencies and can be fully exercised in isolation.

### 1.1 `lib/expiry-utils.ts`

**`calculateExpiryDate(dateIssued, renewalYears)`**
- Returns `null` when `renewalYears` is `null` (never-expiring ticket)
- Adds the correct number of years to the issue date
- Handles leap-year boundary (e.g. issue date Feb 29 + 1 year → Feb 28)
- Handles `renewalYears` of 0 (same-day expiry)

**`isSameDate(date1, date2)`**
- Returns `true` when both dates are `null`
- Returns `false` when one is `null` and the other is not
- Returns `true` when two `Date` objects share the same calendar day (ignores time component)
- Returns `false` for dates on different days

**`shouldRecalculateExpiry(oldTicket, newTicket, currentExpiryDate, dateIssued)`**
- Returns `{ shouldShow: false }` when either ticket argument is `null`
- Returns `{ shouldShow: false }` when both tickets share the same renewal period
- Returns `{ shouldShow: false }` when the recalculated date matches `currentExpiryDate`
- Returns `{ shouldShow: true, newExpiryDate }` when renewal period changed and dates differ
- Handles changing from an expiring ticket to a never-expiring one (`renewal: null`)

**`formatRenewalPeriod(renewalYears)`**
- Returns `"Never expires"` for `null`
- Returns `"Annual renewal"` for `1`
- Returns `"3-year renewal"` for `3`

---

### 1.2 Matching Service — Pure Scoring Functions (`lib/services/matchingService.ts`)

The scoring helpers are private but can be tested end-to-end via the service with a mocked Prisma client, or extracted and exported for direct unit testing.

**`levenshtein(a, b)`** (if extracted)
- `levenshtein("", "")` → `0`
- `levenshtein("abc", "abc")` → `0`
- `levenshtein("abc", "ab")` → `1`
- `levenshtein("kitten", "sitting")` → `3`

**`levenshteinSimilarity(a, b)`**
- Both empty strings → `1`
- Identical strings → `1`
- Completely different strings → value near `0`
- "brandon wright" vs "brandon wright" → `1`

**`normalizeName(name)`**
- `"Wright, Brandon"` → `"wright brandon"`
- `"  Brandon   Wright  "` → `"brandon wright"`
- `"O'Brien"` → `"o brien"` (punctuation replaced with spaces)

**`scoreEmail` (via service with mocked Prisma)**
- Template `{firstName}.{lastName}`: `brandon.wright@example.com` vs employee Brandon Wright → score 100
- Template `{lastName}.{firstName}`: `wright.brandon@example.com` vs employee Brandon Wright → score 100
- Only first name matches → score 50
- No match → score 0
- `null` email → score 0
- Malformed template (missing `{lastName}`) → score 0

**`scoreNameExact` (via service or extracted)**
- User name `"Brandon Wright"` vs employee Brandon Wright → score 100
- User name `"Wright, Brandon"` (reversed, comma-separated) → score 100
- User name `"Brad Wright"` → score 0
- `null` user name → score 0

**`scoreNameFuzzy` (via service or extracted)**
- High-similarity pair above threshold → positive score with similarity between 0 and 1
- Pair below threshold → score 0
- `null` user name → `{ score: 0, similarity: 0 }`

---

### 1.3 `lib/export-utils.ts`

**`prepareExportData(data, columns)`**
- Extracts headers from `column.header` string or `column.meta.headerText`
- Accesses flat `accessorKey` values correctly
- Traverses nested `accessorKey` paths (e.g. `"personTrained.firstName"`)
- Uses `accessorFn` when defined, ignoring `accessorKey`
- Formats `Date` objects as locale date strings
- Renders `null`/`undefined` as empty string `""`
- Returns `""` when no valid accessor is present on a column

---

## 2. Service Integration Tests

These tests mock the Prisma client (via `vitest-mock-extended`) to isolate business logic from the database.

### 2.1 `AppSettingService`

- **`ensureDefaults`**: Calls `prisma.appSetting.upsert` for all 6 known keys; uses the environment variable value when set; falls back to the hardcoded default when the env var is absent; the `update` payload only sets `description` (never overwrites an admin-set `value`).
- **`getSettings`**: Calls `ensureDefaults` then returns a flat `Record<string, string>` keyed by setting key.
- **`updateSetting`**: Upserts the new value; records a `History` entry with `tableName: "AppSetting"`, `action: "UPDATE"`, correct `oldValues`, and `newValues`; `oldValues` is `null` if the setting did not previously exist.
- **`bulkUpdateSettings`**: Calls `updateSetting` once per entry in the array; all resulting history records are created.

---

### 2.2 `EmployeeService`

**`createEmployee`**
- Creates a new employee and writes a `History` record with `action: "CREATE"`.
- Throws a `DUPLICATE_EMPLOYEE` object (with `matches` and `suggestions`) when a same-name employee exists and `confirmDuplicate` is not set.
- Proceeds with creation when `confirmDuplicate: true` is passed even if duplicates exist.
- `suggestions.rehire` is `true` when at least one matching employee is inactive.

**`getEmployees`**
- Admin role (`viewAll`): returns all employees regardless of department.
- DepartmentManager role (`viewDepartment`): returns only employees in managed departments and their child departments.
- DepartmentManager whose own linked employee is in a **different** department than they manage: their own employee record is still included in the returned list.
- DepartmentManager with no linked employee: list contains only the managed-department employees (no error).
- Regular user role (`viewSelf`): returns only the single employee linked to that user; throws `NO_EMPLOYEE_RECORD` if no link exists.
- FireWarden with `reportType: "evacuation"`: returns a subset-field result; throws `NO_EMPLOYEE_VIEWER_ACCESS` if the role lacks `viewEvacReport`.
- `activeOnly: true` adds `isActive: true` to the where clause.
- Date range filters (`startedFrom`, `startedTo`) are applied to the query.

**`updateEmployeePartial`**
- Only updates the fields explicitly provided (partial PATCH semantics); omitted fields are not touched.
- Throws `EMPLOYEE_NOT_FOUND` for a non-existent ID.
- Writes a `History` record with `action: "PATCH"` and correct `oldValues`/`newValues`.

**`updateEmployeeFull`**
- Updates all provided fields.
- Throws `EMPLOYEE_NOT_FOUND` for a non-existent ID.
- Writes a `History` record with `action: "UPDATE"`.

**`deleteEmployee`**
- Runs in a transaction: deletes training records, deletes ticket records, unlinks associated users (sets `employeeId: null`), writes a history record, then deletes the employee.
- Throws `EMPLOYEE_NOT_FOUND` for an unknown ID.

---

### 2.3 `AccessCheckService`

**`buildAccessors` (tested via public methods)**
- Includes all Admin-role users with `accessReason: "Admin"`.
- Includes a DepartmentManager whose managed department directly matches the employee's `departmentId`.
- Includes a DepartmentManager who manages a parent department (level 0) that has the employee's department as a child.
- Does NOT include a DepartmentManager whose departments do not cover the employee.
- Includes the linked user (self) with `accessReason: "Self"`.
- De-duplicates: a user who is both an Admin and the linked employee appears only once (as Admin).
- Self is omitted when the employee has no linked user.

**`getUsersWithAccessToEmployee`**
- Throws `EMPLOYEE_NOT_FOUND` for an unknown employee ID.
- Returns the correct `EmployeeAccessInfo` shape including `accessorNames` (pipe-separated) and `accessorCount`.

**`getAllEmployeesWithAccessors`**
- `activeOnly: true` (default) filters to active employees only.
- `activeOnly: false` includes inactive employees.
- Each returned entry has an `accessors` array with correct `accessorCount`.

**`getDepartmentEmployeesWithAccessors`**
- Returns only employees in the specified department.
- Self-users are correctly mapped per employee.

**`getLocationEmployeesWithAccessors`**
- Returns only employees in the specified location.

---

### 2.4 `MatchingService`

**`getSuggestions`**
- Returns an empty array when no unlinked users exist.
- Returns an empty array when no unlinked, active employees exist.
- Candidates below `suggestionThreshold` are filtered out.
- Top-3 candidates per user are returned, sorted by descending score.
- `matching.email.enabled: "false"` — email scores not included in `breakdown`.
- `matching.nameExact.enabled: "false"` — name exact scores not included.
- `matching.nameFuzzy.enabled: "false"` — fuzzy scores not included.
- Combined score is `Math.max` of all enabled strategy scores.
- Already-linked employees are excluded from candidates.
- Users with `banned = null` (never explicitly banned) **are** included as candidates — `banned: { not: true }` must not exclude nulls.
- Users with `banned = true` are excluded.
- Users with `banned = false` are included.

**`getSuggestionsForEmployee`**
- Returns empty array when employee ID is not found.
- Returns up to 5 candidate users sorted by score.
- Excludes already-linked users (those with a non-null `employeeId`).
- Excludes users with `banned = true`.
- Users with `banned = null` (never explicitly banned) **are** included — same null-safety requirement as `getSuggestions`.

---

### 2.5 Other Services (primary CRUD coverage)

For each of the following services, verify: create, read-all, read-by-id, update, delete; error handling for non-existent records; history records written where applicable.

- **`departmentService`**: create with name uniqueness enforced; hierarchy parent/child relationship maintained; manager assignment; deactivation.
- **`locationService`**: create with unique `[name, state]` constraint; update; deactivate.
- **`trainingService`**: create with category (Internal/External/SOP); update title/category; deactivate.
- **`ticketService`**: create with optional `renewal`; update renewal period; deactivate.
- **`requirementService`**: add training requirement; add ticket requirement; delete requirement (composite key: `[trainingId/ticketId, departmentId, locationId]`).
- **`trainingRecordService`**: create (unique constraint `[employeeId, trainingId, dateCompleted]`); update; delete; image cascade on delete.
- **`ticketRecordService`**: create; update (including `expiryDate` recalculation when ticket type changes); delete; image cascade.
- **`exemptionService`**: create with Training type; create with Ticket type; update status (Active → Revoked, Active → Expired); delete.
- **`userService`**: link employee to user; unlink; update role; ban with reason; unban.
- **`historyService`**: `getHistoryForEmployee` returns history entries sorted by `timestamp` descending.
- **`statsService`**: `getStats` returns aggregate counts for all five entity types.

---

## 3. API Route Tests

Test route handlers directly by constructing mock `NextRequest` objects with appropriate session headers and body. Verify both the HTTP status code and the response shape.

### Auth guard (applies to every route)
- No session → `401 { message: "Not authenticated" }`

### RBAC guard (applies to mutation routes)
- Valid session, insufficient role → `403 { message: "Not authorised" }`

### `GET /api/employees`
- Admin session → `200` with all employees
- DepartmentManager session → `200` filtered to managed departments
- DepartmentManager whose own linked employee is in an unmanaged department → `200` list includes their own employee record
- Regular user with linked employee → `200` with single employee
- Regular user without linked employee → `403`
- FireWarden with `?reportType=evacuation` → `200` with evac-subset fields
- FireWarden without evac permission → `403`
- `?activeOnly=true` — only active employees returned

### `POST /api/employees`
- Admin, valid body → `200` created employee
- Admin, duplicate name (no `confirmDuplicate`) → `409 { code: "DUPLICATE_EMPLOYEE", matches, suggestions }`
- Admin, duplicate name with `confirmDuplicate: true` → `200`
- Non-admin → `403`

### `GET /api/employees/[id]`
- DepartmentManager requesting an employee in their managed department → `200`
- DepartmentManager requesting their **own** linked employee (in a different department) → `200`
- DepartmentManager requesting an employee in an unmanaged, unrelated department → `403`

### `PATCH /api/employees/[id]`
- Admin, valid partial body → `200` updated employee
- Admin, non-existent ID → `404`
- Non-admin → `403`

### `DELETE /api/employees/[id]`
- Admin → `200` success
- Admin, non-existent ID → `404`
- Non-admin → `403`

### `GET /api/settings`
- Admin session → `200` settings map
- Non-admin → `403`

### `PUT /api/settings`
- Admin, valid `updates` array → `200`, settings persisted and history written
- Admin, missing `updates` field → `400`
- Non-admin → `403`

### `GET /api/suggestions/user-employee`
- Admin session → `200` array of `UserMatchSuggestion`
- Non-admin → `403`

### `GET /api/access-check`
- Non-admin, no `employeeId` param → `200 { linked: false }` (no linked employee) or `200 { linked: true, ...accessInfo }`
- Non-admin, `?employeeId=<own>` → `200`
- Non-admin, `?employeeId=<other>` → `403`
- Admin, no `employeeId` param → `400`
- Admin, `?employeeId=<valid>` → `200`
- Admin, `?employeeId=9999` (not found) → `404`
- Admin, `?employeeId=abc` (non-numeric) → `400`

### `GET /api/access-check/report`
- Admin, `?scope=all` → `200` array of `EmployeeAccessInfo`
- Admin, `?scope=department&id=<deptId>` → `200` filtered array
- Admin, `?scope=location&id=<locId>` → `200` filtered array
- Admin, `?scope=department` without `id` → `400`
- Non-admin → `403`

### Departments (`/api/departments`, `/api/departments/[id]`)
- `GET /api/departments` — authenticated → `200` list
- `POST /api/departments` — admin → `200` created; non-admin → `403`
- `PATCH /api/departments/[id]` — admin → `200`; non-existent → `404`; non-admin → `403`
- `DELETE /api/departments/[id]` — admin → `200`; non-existent → `404`

### Locations, Training, Tickets
- Same CRUD/RBAC pattern as departments above.

### Training Records (`/api/training-records`, `/api/training-records/[id]`)
- `POST` with duplicate `[employeeId, trainingId, dateCompleted]` → `409` or `500` with descriptive error
- `DELETE` — cascades images

### Ticket Records (`/api/ticket-records`, `/api/ticket-records/[id]`)
- `POST` — creates record; `PATCH` — updates expiry date
- `DELETE` — cascades images

### Exemptions (`/api/exemptions`, `/api/exemptions/[id]`)
- Standard CRUD/RBAC coverage

### `GET /api/stats`
- Any authenticated session → `200 { totalEmployees, totalDepartments, totalLocations, totalTraining, totalTickets }`
- No session → `401`

### `GET /api/history` and `GET /api/history/employee/[id]`
- Admin → `200` history entries
- Non-admin → `403`

### `PATCH /api/users/[id]` (role change)
- Admin changes a user's role → `200`; target user's sessions are revoked so the new role takes effect immediately on their next request
- Admin changes other fields (e.g. managed departments) without a `role` field → sessions are **not** revoked
- Non-admin → `403`

### `GET /api/users/[id]/employee` and `POST /api/users/[id]/employee`
- Admin: link user to employee → `200`; unlink → `200`
- Non-admin → `403`

### `GET /api/users/[id]/departments`
- Admin → `200` managed department list
- Non-admin → `403`

---

## 4. Component Tests

Use Vitest + @testing-library/react with jsdom. Mock API calls via `vi.mock` on the axios instance (`lib/axios.ts`) or via MSW (Mock Service Worker).

### `app/admin/settings/matching-settings.tsx`
- Renders current setting values from the API response.
- Toggle switches update local state and enable the Save button.
- Save button calls `PUT /api/settings` with the correct payload.
- Shows a loading skeleton while fetching.
- Displays an error toast on save failure.

### `app/admin/permissions/suggestion-panel.tsx`
- Renders a list of user→employee suggestions with user name, email, and top candidate.
- "Accept" button triggers the link API call and removes the entry from the list optimistically.
- "Dismiss" button removes the suggestion locally without an API call.
- Shows an empty state message when no suggestions exist.

### `app/admin/permissions/user-role-management.tsx`
- Displays the user list with current roles shown in dropdowns.
- Changing a role dropdown fires an API call.
- Shows a confirmation dialog before banning/unbanning.

### `app/access-check/access-check-user-content.tsx`
- `linked: false` → renders a "no linked employee" message.
- `linked: true` → renders an accessor list; each accessor shows name and reason badge.
- Reason badges render the correct label ("Admin", "DepartmentManager", "Self").

### `app/access-check/access-check-admin-content.tsx`
- Search input triggers `GET /api/access-check?employeeId=X` on submit.
- Displays accessor table for a successful response.
- Shows a 404 error message for an unknown employee.
- Shows a 400 error message for an invalid (non-numeric) ID.

### Export functionality (`lib/export-utils.ts` + ExportButtons component)
- Clicking "Export Excel" calls `exportToExcel` with the current data and columns.
- Clicking "Export PDF" calls `exportToPDF`.
- Both buttons are disabled or hidden when `data` is empty.

### Data tables (shared pattern across report pages)
- Clicking a column header sorts rows ascending, clicking again reverses order.
- Typing in the search/filter input hides non-matching rows.
- Pagination controls advance through pages correctly.

### Employee add/edit forms
- Required field validation shows inline errors before submitting.
- A `409 DUPLICATE_EMPLOYEE` response triggers the duplicate detection dialog with the `matches` list.
- Selecting "Proceed anyway" resubmits with `confirmDuplicate: true`.
- Selecting "Cancel" closes the dialog without resubmitting.

### Skeleton loaders
- Rendered while data is loading (`isLoading: true`).
- Replaced by actual content once the API response arrives.
- Not rendered after an error (error state shown instead).

---

## 5. End-to-End Tests (Playwright)

Seed the test database with a consistent fixture set before each run (a minimal subset of `prisma/seed.ts` is sufficient). Use Playwright's `storageState` to persist authentication cookies between tests in the same role group.

### Authentication

- Unauthenticated visit to `/employees` → redirected to `/auth`.
- Visit to `/auth` when already authenticated → redirected to `/`.
- Sign in with valid credentials → land on `/`.
- Sign in with invalid credentials → error message visible on the auth page.

### Employee Management (Admin role)

- Navigate to `/employees`; directory table renders with employee rows.
- Search by employee name filters the table.
- Click "Add Employee", fill all required fields, submit → new row appears in the table.
- Add employee with an existing name → duplicate dialog appears; dismiss → no new record.
- Add employee with an existing name → choose "Proceed anyway" → employee created.
- Click an employee row to open profile; edit a field (e.g. title); save → updated value visible after reload.
- Delete an employee from the profile → confirmation prompt; confirm → employee removed from directory.

### Employee Profile Tabs (Admin role)

- **Training tab**: existing records displayed; "Add Training" opens form; submit creates a new record visible in the list.
- **Tickets tab**: existing records displayed with expiry dates; add, edit, and delete a ticket record.
- **Exemptions tab**: add an exemption with reason; exemption appears in list; revoke exemption → status changes.
- **History tab**: changes made in other tabs appear as history entries in chronological order.
- **User Link tab**: unlinked employee shows suggestion candidates (if any); click "Accept" on a suggestion → user linked.

### Bulk Training

- Navigate to `/bulk-training`; select multiple employees from the selector.
- Choose a training type and date; submit → training records created; success message displayed.
- Navigate to each selected employee's profile → new training record visible in Training tab.

### Reports (Admin role)

- `/reports/employee/list` — table loads; export to Excel and PDF without error.
- `/reports/employee/needs-analysis` — table shows employees missing required training; column for each requirement.
- `/reports/employee/onboarding` — employees started within date range filter are shown.
- `/reports/tickets/expiring` — upcoming expiry dates shown; date range filter narrows results.
- `/reports/tickets/all` — all ticket records; searchable.
- `/reports/training/completed` — completed training records; searchable.
- `/reports/access/all` — all-employee access report renders; export works.
- `/reports/access/department` — department selector dropdown; selecting a department renders filtered report.
- `/reports/access/location` — location selector dropdown; filtered report renders.

### Access Check Page

- **Non-admin user (linked)**: visit `/access-check` → sees their own accessor list with reason labels.
- **Non-admin user (unlinked)**: visit `/access-check` → sees "no linked employee" message.
- **Admin**: visit `/access-check` → admin search tool visible; enter an employee ID → accessor table rendered.

### Admin — Field Editor

- Create a new department → appears in the department list.
- Deactivate a department → removed from the active department list.
- Create a training requirement (training + department + location) → requirement listed under the training's requirements.
- Delete a training requirement → removed from the list.

### Admin — Permissions

- Change a user's role from User to DepartmentManager → role reflected in the user list.
- Assign a managed department to the DepartmentManager → department appears in the user's department list.
- Accept a user-employee suggestion → user's profile tab shows linked employee.
- Ban a user → user marked as banned; unban → status cleared.

### Admin — Settings

- Visit `/admin/settings`; disable email matching (toggle off); save → page reloads with the toggle in the off position.
- Change fuzzy threshold to `0.5`; save → reloads with value `0.5`.
- Settings history visible in `/api/history` as `AppSetting` `UPDATE` entries.

### Department Manager role

- Navigate to `/employees` → only employees in managed department(s) are visible.
- Navigate to `/employees` as a DepartmentManager whose own employee record is in a **different** department → their own record is still visible in the directory.
- Navigate to their own employee profile (`/employees/[ownId]`) → accessible (not 403).
- Navigate to an employee profile outside their managed department → access denied (403 or redirect).
- Navigate to `/reports` → Reports tile is visible and accessible.
- Can navigate to department-scoped reports (e.g. training completion); cannot navigate to admin-only reports.
- Attempt to navigate to `/admin/settings` → redirected or access denied.
- Admin changes this user's role → user's session is invalidated; on next page load the UI reflects the new role without requiring manual cookie clearing.

### Regular User role

- Navigate to `/employees` → only their own employee record visible.
- Navigate to `/access-check` → sees their own accessor list (or unlinked message).
- Cannot access `/admin/*` routes → redirected.

---

## 6. Test Data & Fixtures

### Minimum fixture set

| Entity | Count | Notes |
|---|---|---|
| Location | 2 | "Site A (NSW)", "Site B (VIC)" |
| Department (level 0) | 1 | "Engineering" (parent) |
| Department (level 1) | 2 | "Mechanical", "Electrical" (children of Engineering) |
| Training | 3 | 1 Internal, 1 External, 1 SOP |
| Ticket | 2 | 1 annual renewal (`renewal: 1`), 1 never-expiring (`renewal: null`) |
| Employee | 5 | 2 active in child depts, 1 inactive, 1 in parent dept, 1 active in "Electrical" linked to the DepartmentManager who manages "Mechanical" |
| User | 5 | 1 Admin, 1 DepartmentManager (manages "Mechanical", linked to employee in "Electrical" — cross-dept edge case), 1 regular User (linked to active employee), 1 unlinked User, 1 User with `banned = null` (never explicitly set) for suggestion null-safety tests |
| TrainingRequirement | 2 | training × Mechanical × Site A; training × Electrical × Site A |
| TicketRequirement | 1 | ticket × Mechanical × Site A |
| AppSetting | 6 | All matching settings at their default values |

---

## 7. Coverage Targets

| Layer | Target |
|---|---|
| Pure utility functions | 100% statement coverage |
| Service methods | >= 90% branch coverage |
| API routes | All expected status codes (200/201/400/401/403/404/409/500) covered |
| Components | All interactive states (loading, empty, error, populated data) covered |
| E2E | All primary user journeys for Admin, DepartmentManager, and regular User roles |
