# Email template editor — current state & gaps

Audited 2026-07-30. Groundwork notes for building a fuller email-template editor.

> **Status: built 2026-07-30.** Everything below is the *pre-build* audit, kept
> for the reasoning. What shipped, and what deliberately did not, is recorded at
> the bottom under **Outcome**.

## What exists today

- **Model**: `EmailTemplate` (`prisma/schema.prisma:128`) — `key` (stable id), `name`,
  `subject`, `body`, `isActive`, `updatedAt`.
- **Service**: `lib/services/emailTemplateService.ts`
  - `TEMPLATE_DEFAULTS` — 18 seeded templates.
  - `ensureDefaults()` — idempotent seed + drift resync. Never overwrites an
    admin-edited template; "edited" = a `History` row with
    `tableName: "EmailTemplate"`, `action: "UPDATE"` exists for that key.
  - `interpolate()` — `{token}` replacement; unknown/null tokens left literal so
    typos are visible.
  - `render(key, vars)` — fetch + interpolate subject and body.
  - `updateTemplate()` — writes a `History` audit row.
- **API**: `GET /api/email-templates`, `GET|PUT /api/email-templates/[key]` —
  all Admin-only (`session.user.role !== "Admin"` → 403).
- **UI**: `/admin/settings` → **Onboarding** tab → "Email templates" card
  (`app/admin/settings/onboarding-settings.tsx:244`). Lists every template the API
  returns (not filtered to onboarding keys) with an Edit button; the editor
  (`TemplateForm`, line ~551) is a plain `Input` for subject and a 10-row
  `Textarea` for body, in a responsive Dialog/Drawer.

## Templates and their consumers

| Key | Rendered by |
|---|---|
| `manager.nextSteps.internal` / `.external` | `onboardingFanOutService.ts:207` |
| `hr.notes` | `onboardingFanOutService.ts:402` |
| `payroll.notes` | `onboardingFanOutService.ts:412` |
| `it.programs` | `onboardingFanOutService.ts:366` |
| `it.landline` | `onboardingFanOutService.ts:389` |
| `marketing.induction` | `onboardingFanOutService.ts:288` |
| `licence.request` | `onboardingFanOutService.ts:332` |
| `manager.vehicle` | `onboardingFanOutService.ts:339` |
| `forms.offerReminder` | `onboardingFanOutService.ts:227` |
| `forms.attachments` | `onboardingFanOutService.ts:271` |
| `ticket.expiryWarning` / `ticket.expired` | `lib/jobs/handlers/ticketExpiry.ts:171` |
| `sop.submitted` | `sopAssessmentService.ts:396` |
| `sop.changesRequested` / `sop.passed` | `sopAssessmentService.ts:607` |
| `it.quizSummary` | `quizService.ts:788` |

## Not editable

1. **The ticket list body** — `{ticketList}` is built in code by `renderList()`
   (`lib/jobs/handlers/ticketExpiry.ts:184`). The `<ul>`/`<li>` markup and the
   per-row wording (`"Name — Ticket: expires 2026-08-01 (30 days)"` /
   `"expired 2026-08-01"`) are hardcoded. An admin can change the copy around the
   list and the subject, but not the row format.
2. **Onboarding-request admin notification** — `notifyAdmins()` in
   `app/api/onboarding/route.ts:105` builds its subject and HTML inline. This is
   the only remaining send site that bypasses the template system.
3. **`{programs}` list** (`it.programs`) — same shape of problem as `ticketList`:
   composed in `onboardingFanOutService`, not authorable.
4. **Template set** — `TEMPLATE_DEFAULTS` is a code constant. Admins cannot add,
   rename the key of, or delete a template; no create/delete API exists.

## Rough edges

1. **Tokens are not surfaced.** `EMAIL_TEMPLATE_TOKENS`
   (`emailTemplateService.ts:14`) is exported and referenced **nowhere** — despite
   its own comment claiming it is "Surfaced in the admin editor so authors know
   what they can reference". The editor shows only a generic hint naming
   `{preferredFirstName}`. An admin editing `ticket.expiryWarning` has no way to
   discover `{ticketList}` or `{count}`.
2. **Tokens are one flat global list.** No mapping of key → valid tokens, so even
   once surfaced it would offer vehicle and SOP tokens to a ticket-expiry email.
   The valid set is genuinely per-template (see the grouping comments in
   `EMAIL_TEMPLATE_TOKENS`).
3. **`isActive` is inert.** On the model, accepted by the PUT route, written by
   `updateTemplate` — but no send site checks it and the UI never exposes it.
   Toggling a template off does nothing.
4. **`name` is not editable via the UI.** The PUT route accepts it; the form only
   sends `subject`/`body`. (Arguably correct — `ensureDefaults` resyncs `name`
   from the defaults on every call, so a UI edit would be silently reverted.)
5. **No preview.** Body is raw HTML in a textarea, no rendered preview and no
   sample-data interpolation, so authors cannot see what recipients get.
6. **No validation.** Nothing warns about unknown/misspelled tokens (they render
   literally into the sent email) or malformed HTML.
7. **No test send.** No way to send a template to yourself before it goes out to
   managers/HR on the next job run.
8. **Five templates still hold `PLACEHOLDER_BODY`** — `marketing.induction`,
   `licence.request`, `manager.vehicle`, `forms.offerReminder`,
   `forms.attachments`. They are editable but unwritten, so they currently send
   the literal "TODO: the email copy for this template has not been written yet"
   text. Nothing flags this in the list UI.
9. **Discoverability.** All 18 templates — ticket expiry, SOP, IT quiz — live under
   a tab labelled "Onboarding", and the card description says "sent by onboarding
   jobs". Wrong home for a system-wide template editor; wants its own tab or page.
10. **No plain-text alternative.** `mailService` supports a `text` param, but
    templates only carry `body` (HTML). Template-driven sends are HTML-only.
11. **No per-template history view.** Edits are audited into `History`
    (`recordId` = the key) but the editor doesn't show or allow reverting them,
    and there is no "revert to default".
12. **No `isActive`/edited indicator in the list** — can't tell at a glance which
    templates have been customised vs. still on defaults, though
    `uneditedKeys()` already computes exactly that.

## Suggested scope for a fuller editor

- Dedicated `/admin/email-templates` page (or a "Email" tab in settings), grouped
  by domain (Onboarding / Tickets / SOP / IT).
- Per-key token registry: `Record<templateKey, readonly string[]>` replacing the
  flat `EMAIL_TEMPLATE_TOKENS`, exposed via the API and rendered as
  click-to-insert chips.
- Live preview pane with per-key sample data; unknown-token warnings.
- "Send test to me" action.
- Expose `isActive` **and** enforce it at the render/send sites.
- "Revert to default" per template + edited/default badge in the list.
- Optional: promote `ticketList` / `programs` row formats into their own
  sub-templates (e.g. `ticket.expiryWarning.row`) so the list format is authorable.

## Outcome (built 2026-07-30)

New page **`/admin/email-templates`** (nav entry added; the old card under
Settings → Onboarding is now just a pointer).

| Gap | Resolution |
|---|---|
| 1, 2 — tokens not surfaced / not per-key | `TEMPLATE_META` in `lib/email-templates/tokens.ts` maps key → tokens; rendered as click-to-insert chips with tooltips from `TOKEN_DESCRIPTIONS`. The flat `EMAIL_TEMPLATE_TOKENS` is now derived from it. |
| 3 — `isActive` inert | `render()` returns `null` when inactive; all ~11 send sites handle it (TypeScript enforces this). Exposed as a switch in the editor. |
| 4 — `name` not editable | Left read-only by design; `ensureDefaults` resyncs it. |
| 5 — no preview | Server-rendered preview (`POST .../preview`) with per-key sample data, shown in a `sandbox=""` iframe so it can't execute template content or inherit app CSS. Renders row fragments and the shared layout, so it matches a real send. |
| 6 — no validation | Unknown-token and unbalanced-conditional warnings, surfaced in the preview pane and as a list badge. |
| 7 — no test send | "Send test to me" (`POST .../test`) — hard-wired to the session user's address, uses `sendNow` so failures are reported synchronously. |
| 8 — placeholder bodies | "Not written yet" badge in the list plus an inline warning in the editor. |
| 9 — discoverability | Own page, grouped Onboarding / IT / Tickets / SOP / Advanced. |
| 11 — no history | `GET .../history` + restore, in a responsive Dialog/Drawer. Plus per-template "Revert to default" (`POST .../revert`), audited as action `REVERT` so the template starts tracking default changes again. |
| 12 — no edited indicator | Edited / Default / Off / Not-written / Unknown-token badges. |
| "Not editable" 1 & 3 — list row markup | Now admin-editable fragments: `ticket.expiryWarning.row`, `ticket.expired.row`, `it.programs.row`, wired through `LIST_TOKENS`. Optional row parts use new `{#token}…{/token}` conditional blocks so an absent ticket URL drops its whole line. |

Also added beyond the audit: a shared **`email.layout`** template (branded,
table-based, inline styles) wrapped around every message-level send, itself
admin-editable and switch-off-able; and a WYSIWYG editor (Tiptap v3) where
`{token}` renders as an atomic pill, with an HTML-source toggle. Fragment
templates are source-only — a bare `<li>` has no rich-text form — and
`unsupportedMarkup()` warns before offering rich text on markup Tiptap would
simplify.

**Not done, by decision:** gap 10 (no plain-text alternative), "Not editable" 2
(the inline `notifyAdmins()` email in `app/api/onboarding/route.ts` still bypasses
the template system) and 4 (admins still cannot create or delete templates).

## Follow-up (2026-07-30, same day)

Reported: the test-send button always failed, and the editor "is basically a text
area with no buttons to help tags".

**The test send was not a code fault.** `AppLog` had the cause all along —
`self-signed certificate` from `smtp01.intern.ksb.com:587`, because
`MAIL_ACCEPT_SELFSIGNED=false` maps to `rejectUnauthorized: true`
(`lib/mail.ts:20`) and the internal CA is not in Node's trust store. Reproduced
directly: the handshake fails in 1.8s with verification on and succeeds in 3.0s
with it off. Every email from that machine had been failing since 2026-07-28, not
just test sends — queued sends fail into the job log where nobody looks, so the
test button was simply the first place a failure was visible. Left the
environment alone at the owner's request.

What *was* a code fault is that none of this reached the screen. Both routes
already returned the real cause in `details` and both clients threw it away — the
preview with a bare `catch {}`. So:

| Change | Where |
|---|---|
| One error formatter used by preview, test send, save and revert. Keeps the server's `details`, separates an expired session (401) from a permission problem (403), names an unreachable server, and lets a caller supply its own timeout wording. | `components/email-editor/request-error.ts` (+ tests) |
| Test send gets its own 60s timeout. It is the only request in the app that waits on a full SMTP exchange; the shared 10s axios default would report a false failure for a merely slow relay. | `email-templates-page-content.tsx` |
| Preview pane: real error text, "Try again", desktop/phone width toggle, re-render button. | `components/email-editor/email-preview.tsx` |
| **Insert field** picker — searchable by name *or* description ("start date" finds `startDate`), showing each field's sample value. In the body toolbar in both modes, and next to the subject line. Typing `{` in the rich editor opens it; dismissing it types the literal `{` back. | `components/email-editor/field-picker.tsx` |
| **Optional block** button (source mode): wraps the selection in `{#field}…{/field}`, or inserts `{#field}{field}{/field}` with nothing selected. | `field-picker.tsx` + `wrapSelection` in `insert-at-cursor.ts` (+ tests) |
| Clear-formatting button in the rich toolbar. | `email-body-editor.tsx` |
| Unknown-field and unclosed-block warnings now appear **while typing**, not only in the preview tab — same pure checks the server runs. | `email-templates-page-content.tsx` |
| The editor no longer opens on `email.layout`. It sorted first alphabetically, and being an Advanced source-only fragment it made the whole editor look like a bare textarea; selection now defaults to the first `kind: "email"` template. | `email-templates-page-content.tsx` |
| `SAMPLE_TOKEN_VALUES` moved `defaults.ts` → `tokens.ts` so the picker can show sample values without pulling the template bodies into the client bundle. | `lib/email-templates/` |
