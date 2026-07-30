// Token registry for the admin email-template editor.
//
// Deliberately free of server-only imports (no prisma, no "server-only") so the
// editor UI can import this directly and render token chips without a round
// trip. Anything that needs the database lives in emailTemplateService.

/** Which editor surface a template belongs to. */
export type TemplateGroup =
  | "Onboarding"
  | "Tickets"
  | "SOP"
  | "IT"
  | "Advanced";

/**
 * `email` — a whole message an admin writes prose into; edited in the WYSIWYG
 * and wrapped in the shared layout when sent.
 * `fragment` — a snippet composed into another template (the shared layout, or
 * one row of a generated list). These are raw HTML by nature — a bare `<li>`
 * has nowhere to live in a rich-text document — so the editor forces source
 * mode and never wraps them in the layout.
 */
export type TemplateKind = "email" | "fragment";

export interface TemplateMeta {
  group: TemplateGroup;
  kind: TemplateKind;
  /** Shown under the template name in the list, and above the editor. */
  blurb: string;
  /** Tokens this template's subject/body may reference. Order is display order. */
  tokens: readonly string[];
}

/** One-line explanations rendered on the token chips as tooltips. */
export const TOKEN_DESCRIPTIONS: Record<string, string> = {
  // --- Employee / request fields ---
  legalFirstName: "First name as it appears on legal documents",
  legalLastName: "Last name as it appears on legal documents",
  preferredFirstName: "The name they go by day to day",
  preferredLastName: "Preferred last name",
  title: "Job title",
  department: "Department they are joining",
  location: "Site or office",
  startDate: "First day, e.g. 4 August 2026",
  managerName: "Their manager's name",
  employmentType: "Internal or External",
  email: "Their work email address",
  // --- Fan-out computed ---
  programs: "The list of requested software, built from the row template below",
  notes: "The freeform note recorded for this department",
  // --- Vehicle ---
  willReceiveVehicle: '"Yes" or "No" — allocated a company vehicle',
  willDriveVehicle: '"Yes" or "No" — will drive a company vehicle',
  iamValidTo: "Start date plus one year (external hires)",
  // --- Ticket expiry ---
  ticketList: "The list of affected tickets, built from the row template below",
  count: "How many tickets this email lists",
  employeeName: "The employee's display name",
  ticketName: "Name of the ticket or credential",
  expiryDate: "The ticket's expiry date",
  days: "Whole days until expiry, e.g. 30",
  daysText: 'Days until expiry with its unit, e.g. "30 days" or "1 day"',
  // --- SOP ---
  sopTitle: "Title of the SOP assessment",
  trainerName: "The designated trainer's name",
  // --- IT quiz ---
  summaryUrl: "Deep link to the questionnaire results",
  // --- Programs row ---
  programName: "Name of the requested program",
  ticketUrl: "Link to the IT service-catalogue request, if the program has one",
  infoRequired: "Extra detail IT needs for this program, if any",
  referenceUserName: "Existing employee to mirror access from, if given",
  // --- Layout ---
  content: "The body of the email being sent — required in the layout",
  subject: "The email's subject line",
  companyName: "Company name from NEXT_PUBLIC_COMPANY_NAME",
  appUrl: "This app's base URL from APP_URL",
  year: "The current year",
};

/**
 * Stand-in values for the editor's preview, test-send and field picker. Chosen
 * to be obviously fake so a preview is never mistaken for a real message.
 *
 * Lives here rather than with the template bodies because the editor shows each
 * token's sample value in the picker, and this registry is the half of the
 * email-template metadata the client is allowed to import.
 */
export const SAMPLE_TOKEN_VALUES: Record<string, string> = {
  legalFirstName: "Jonathan",
  legalLastName: "Sample",
  preferredFirstName: "Jono",
  preferredLastName: "Sample",
  title: "Service Technician",
  department: "Service",
  location: "Brisbane",
  startDate: "4 August 2026",
  managerName: "Dana Example",
  employmentType: "Internal",
  email: "jono.sample@example.com",
  notes: "Sample note — this is where the submitter's note appears.",
  willReceiveVehicle: "Yes",
  willDriveVehicle: "Yes",
  iamValidTo: "4 August 2027",
  count: "3",
  employeeName: "Jono Sample",
  ticketName: "Forklift Licence",
  expiryDate: "1 September 2026",
  days: "30",
  daysText: "30 days",
  sopTitle: "Pump Teardown & Inspection",
  trainerName: "Dana Example",
  summaryUrl: "https://hrt.example.com/it-induction/responses/123",
  programName: "AutoCAD",
  ticketUrl: "https://itsp.example.com/serviceOfferings/1234",
  infoRequired: "Licence seat type",
  referenceUserName: "Alex Existing",
};

/**
 * What `token` renders as in a preview, or undefined for the composed tokens
 * ({ticketList}, {programs}, {content}) whose value is built at send time and so
 * has no single sample string.
 */
export function sampleFor(token: string): string | undefined {
  return SAMPLE_TOKEN_VALUES[token];
}

// Tokens every message-level template can use: the employee/request fields
// supplied on essentially every onboarding-driven send.
const PERSON_TOKENS = [
  "preferredFirstName",
  "preferredLastName",
  "legalFirstName",
  "legalLastName",
  "title",
  "department",
  "location",
  "startDate",
  "managerName",
  "employmentType",
  "email",
] as const;

/**
 * Per-key token registry. The valid set is genuinely per-template — a
 * ticket-expiry email has no `sopTitle` and an SOP email has no `ticketList` —
 * so the editor offers only what the send site actually supplies and warns
 * about everything else.
 */
export const TEMPLATE_META: Record<string, TemplateMeta> = {
  "manager.nextSteps.internal": {
    group: "Onboarding",
    kind: "email",
    blurb: "Sent to the manager when an internal hire is approved.",
    tokens: [...PERSON_TOKENS],
  },
  "manager.nextSteps.external": {
    group: "Onboarding",
    kind: "email",
    blurb:
      "Sent to the manager when an external hire is approved. Walks them through the IAM contractor request.",
    tokens: [...PERSON_TOKENS, "iamValidTo"],
  },
  "hr.notes": {
    group: "Onboarding",
    kind: "email",
    blurb: "Sent to HR when the submitter leaves a note for HR.",
    tokens: [...PERSON_TOKENS, "notes"],
  },
  "payroll.notes": {
    group: "Onboarding",
    kind: "email",
    blurb: "Sent to Payroll when the submitter leaves a note for Payroll.",
    tokens: [...PERSON_TOKENS, "notes"],
  },
  "it.programs": {
    group: "IT",
    kind: "email",
    blurb: "Software-access request sent to IT, listing every program selected.",
    tokens: [...PERSON_TOKENS, "programs", "notes"],
  },
  "it.programs.row": {
    group: "Advanced",
    kind: "fragment",
    blurb:
      "One row of the {programs} list in the IT software-access email. Wrap optional parts in {#token}…{/token} so they disappear when empty.",
    tokens: ["programName", "ticketUrl", "infoRequired", "referenceUserName"],
  },
  "it.landline": {
    group: "IT",
    kind: "email",
    blurb: "Desk-phone request sent to IT when a landline is required.",
    tokens: [...PERSON_TOKENS],
  },
  "marketing.induction": {
    group: "Onboarding",
    kind: "email",
    blurb: "Booking request sent to Marketing for the induction session.",
    tokens: [...PERSON_TOKENS],
  },
  "licence.request": {
    group: "Onboarding",
    kind: "email",
    blurb: "Asks for a copy of the new starter's driver licence.",
    tokens: [...PERSON_TOKENS],
  },
  "manager.vehicle": {
    group: "Onboarding",
    kind: "email",
    blurb: "Tells the manager what to arrange for a company vehicle.",
    tokens: [
      ...PERSON_TOKENS,
      "willReceiveVehicle",
      "willDriveVehicle",
    ],
  },
  "forms.offerReminder": {
    group: "Onboarding",
    kind: "email",
    blurb: "Chases an outstanding letter of offer.",
    tokens: [...PERSON_TOKENS],
  },
  "forms.attachments": {
    group: "Onboarding",
    kind: "email",
    blurb: "Sends the employment-forms pack and police-check form.",
    tokens: [...PERSON_TOKENS],
  },
  "ticket.expiryWarning": {
    group: "Tickets",
    kind: "email",
    blurb:
      "Consolidated warning about tickets due to expire. One email per recipient covering every affected employee.",
    tokens: ["ticketList", "count"],
  },
  "ticket.expiryWarning.row": {
    group: "Advanced",
    kind: "fragment",
    blurb: "One row of the {ticketList} in the expiring-soon email.",
    tokens: ["employeeName", "ticketName", "expiryDate", "days", "daysText"],
  },
  "ticket.expired": {
    group: "Tickets",
    kind: "email",
    blurb: "Consolidated notice that tickets have already expired.",
    tokens: ["ticketList", "count"],
  },
  "ticket.expired.row": {
    group: "Advanced",
    kind: "fragment",
    blurb: "One row of the {ticketList} in the already-expired email.",
    tokens: ["employeeName", "ticketName", "expiryDate"],
  },
  "sop.submitted": {
    group: "SOP",
    kind: "email",
    blurb: "Tells the designated trainers an assessment is ready to mark.",
    tokens: ["employeeName", "sopTitle"],
  },
  "sop.changesRequested": {
    group: "SOP",
    kind: "email",
    blurb: "Tells the employee a trainer wants changes to their answers.",
    tokens: ["employeeName", "sopTitle", "trainerName"],
  },
  "sop.passed": {
    group: "SOP",
    kind: "email",
    blurb: "Tells the employee their assessment is complete.",
    tokens: ["employeeName", "sopTitle", "trainerName"],
  },
  "it.quizSummary": {
    group: "IT",
    kind: "email",
    blurb:
      "Sends IT the summary of a completed induction questionnaire before the session.",
    tokens: ["employeeName", "summaryUrl"],
  },
  "email.layout": {
    group: "Advanced",
    kind: "fragment",
    blurb:
      "The shared shell wrapped around every email above — header, footer and base styles. Must contain {content}. Switch it off to send bare message bodies instead.",
    tokens: ["content", "subject", "companyName", "appUrl", "year"],
  },
};

/** The key of the shared layout fragment. */
export const LAYOUT_KEY = "email.layout";

export interface ListTokenSource {
  /** The token in the parent template this list fills, e.g. "ticketList". */
  token: string;
  /** The fragment rendered once per item. */
  rowKey: string;
  /** Markup the rendered rows are joined into. `{rows}` is where they land. */
  wrapper: string;
}

/**
 * Generated lists: the parent template owns the copy around the list, a
 * fragment owns each row. Keyed by the parent so a send site and the preview
 * both know which fragment to render rows through.
 */
export const LIST_TOKENS: Record<string, ListTokenSource> = {
  "ticket.expiryWarning": {
    token: "ticketList",
    rowKey: "ticket.expiryWarning.row",
    wrapper: "<ul>{rows}</ul>",
  },
  "ticket.expired": {
    token: "ticketList",
    rowKey: "ticket.expired.row",
    wrapper: "<ul>{rows}</ul>",
  },
  "it.programs": {
    token: "programs",
    rowKey: "it.programs.row",
    wrapper: "<ul>\n{rows}\n</ul>",
  },
};

/** The parent template a row fragment belongs to, if it is one. */
export function parentOfRow(rowKey: string): string | undefined {
  return Object.keys(LIST_TOKENS).find((k) => LIST_TOKENS[k].rowKey === rowKey);
}

/** Display order of the groups in the editor. */
export const GROUP_ORDER: readonly TemplateGroup[] = [
  "Onboarding",
  "IT",
  "Tickets",
  "SOP",
  "Advanced",
];

/** Tokens `key` may reference. Unknown keys get an empty list, not a throw. */
export function tokensFor(key: string): readonly string[] {
  return TEMPLATE_META[key]?.tokens ?? [];
}

export function groupFor(key: string): TemplateGroup {
  return TEMPLATE_META[key]?.group ?? "Advanced";
}

export function kindFor(key: string): TemplateKind {
  return TEMPLATE_META[key]?.kind ?? "email";
}

/** True when this template is composed into another rather than sent on its own. */
export function isFragment(key: string): boolean {
  return kindFor(key) === "fragment";
}

/**
 * Escape a value before handing it to `interpolate`. Templates are HTML, so any
 * database-sourced token value (a person's name, a program name) has to be
 * escaped by the send site — interpolate itself can't know which values are
 * meant to be markup, since tokens like {ticketList} deliberately are.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// A {token} or a {#token} / {/token} conditional marker.
const TOKEN_PATTERN = /\{[#/]?(\w+)\}/g;

/** Every distinct token referenced by `text`, in first-appearance order. */
export function referencedTokens(text: string): string[] {
  const found = new Set<string>();
  for (const [, token] of text.matchAll(TOKEN_PATTERN)) found.add(token);
  return [...found];
}

/**
 * Tokens in `text` that `key`'s send site does not supply. These are not
 * errors — interpolate leaves them untouched on purpose — but they would reach
 * the recipient as literal `{text}`, so the editor flags them.
 */
export function unknownTokens(key: string, text: string): string[] {
  const valid = new Set(tokensFor(key));
  return referencedTokens(text).filter((t) => !valid.has(t));
}

/** Conditional blocks whose opening and closing markers don't line up. */
export function unbalancedConditionals(text: string): string[] {
  const open: string[] = [];
  const broken = new Set<string>();
  for (const [match, token] of text.matchAll(TOKEN_PATTERN)) {
    if (match.startsWith("{#")) {
      open.push(token);
    } else if (match.startsWith("{/")) {
      if (open[open.length - 1] === token) open.pop();
      else broken.add(token);
    }
  }
  for (const token of open) broken.add(token);
  return [...broken];
}
