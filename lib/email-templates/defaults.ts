// Seed copy for every email template, plus the sample data the editor's
// preview and test-send interpolate.
//
// Kept apart from tokens.ts so the editor UI can import token metadata without
// pulling these (much larger) body strings into the client bundle.

export interface EmailTemplateDefault {
  key: string;
  name: string;
  subject: string;
  body: string;
}

// Deliberately free of {token} syntax: a placeholder that mentioned a token by
// name would trip the editor's unknown-token warning on every unwritten
// template, burying the real ones.
export const PLACEHOLDER_BODY =
  "TODO: the email copy for this template has not been written yet. " +
  "Edit it under Admin → Email Templates, using the token chips below the " +
  "editor to insert values such as the new starter's preferred name.";

// The shared shell wrapped around every message-level template at send time.
// Table-based with inline styles because Outlook ignores most of everything
// else; `{content}` is where the template's own body lands.
const LAYOUT_BODY = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:24px 0;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background-color:#ffffff;border:1px solid #e4e6eb;border-radius:6px;">
        <tr>
          <td style="padding:20px 28px;border-bottom:3px solid #0a5c99;">
            <span style="font-size:18px;font-weight:600;color:#0a5c99;">{companyName}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;font-size:15px;line-height:1.55;color:#1f2328;">
            {content}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px;border-top:1px solid #e4e6eb;font-size:12px;line-height:1.5;color:#6b7280;">
            <p style="margin:0 0 6px 0;">Sent automatically by the HR Training system. Please do not reply to this address.</p>
            <p style="margin:0;"><a href="{appUrl}" style="color:#0a5c99;">Open HRT</a> &middot; &copy; {year} {companyName}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;

/**
 * Stable template ids, seeded as defaults and re-synced by
 * `ensureDefaults()` until an admin edits them.
 */
export const TEMPLATE_DEFAULTS: EmailTemplateDefault[] = [
  {
    key: "manager.nextSteps.internal",
    name: "Manager next steps — internal hire",
    subject: "Next steps for {preferredFirstName} {preferredLastName}",
    body: PLACEHOLDER_BODY,
  },
  {
    key: "manager.nextSteps.external",
    name: "Manager next steps — external hire",
    subject: "Next steps for {preferredFirstName} {preferredLastName}",
    body: `<p>Hi {managerName},</p>

<p>{preferredFirstName} {preferredLastName} is starting on {startDate} as an external contractor. Please set up their KSB identity account by completing the IAM contractor request form:</p>

<p><a href="https://iam.ksb.com/workitemdlg.aspx?ACTTEMP=1001819&amp;RURLID=062e87d9-6494-49fa-852b-f9e50fef0e8d">Click here to open the contractor request form</a></p>

<p>If that link doesn't work, go to <a href="https://iam.ksb.com">iam.ksb.com</a>, select <strong>Services</strong> in the left-hand bar, then choose <strong>Request Contractor Identity</strong>.</p>

<p>Fill in the form as follows:</p>

<ul>
  <li><strong>First name:</strong> {preferredFirstName}</li>
  <li><strong>Last name:</strong> {preferredLastName}</li>
  <li><strong>Valid from:</strong> {startDate}</li>
  <li><strong>Valid to:</strong> {iamValidTo} <em>(external employees have a maximum of one year; you will be reminded to extend their access before expiry)</em></li>
  <li><strong>KSB Responsible:</strong> your name</li>
  <li><strong>Ext. Company:</strong> AIGroup (or the actual company they have been hired through)</li>
  <li><strong>Field of activity / Job title:</strong> {title}</li>
  <li><strong>Preferred Language:</strong> English</li>
  <li><strong>KSB Company:</strong> KSB Australia Pty Ltd. [5055]</li>
  <li><strong>Country:</strong> Australia</li>
  <li><strong>Cost center:</strong> the cost center for their department</li>
  <li><strong>Location:</strong> {location}</li>
</ul>

<p>You do not need to fill in external contact information. Select <strong>Submit</strong> when done.</p>

<p>Because you are filling this in as their manager, it will auto-approve.</p>`,
  },
  {
    key: "hr.notes",
    name: "HR department note",
    subject: "New hire — note for HR: {preferredFirstName} {preferredLastName}",
    body: `<p>Hi,</p>

<p>A note has been recorded for HR regarding the onboarding of <strong>{preferredFirstName} {preferredLastName}</strong> ({title}), who is joining {department} at {location} on {startDate}.</p>

<p>{notes}</p>

<p>Please action this as required.</p>`,
  },
  {
    key: "payroll.notes",
    name: "Payroll department note",
    subject:
      "New hire — note for Payroll: {preferredFirstName} {preferredLastName}",
    body: `<p>Hi,</p>

<p>A note has been recorded for Payroll regarding the onboarding of <strong>{preferredFirstName} {preferredLastName}</strong> ({title}), who is joining {department} at {location} on {startDate}.</p>

<p>{notes}</p>

<p>Please action this as required.</p>`,
  },
  {
    key: "it.programs",
    name: "IT software-access request",
    subject: "Software access for {preferredFirstName} {preferredLastName}",
    body: `<p>Hi,</p>

<p>Please arrange software access for <strong>{preferredFirstName} {preferredLastName}</strong> ({title}), who is joining {department} at {location} on {startDate}. Their manager is {managerName}.</p>

<p>The following programs have been requested:</p>

{programs}

<p>If you have any questions, please reach out to their manager directly.</p>`,
  },
  {
    key: "it.programs.row",
    name: "— one program row",
    subject: "",
    body: `<li><strong>{programName}</strong>{#ticketUrl}<br>Ticket: <a href="{ticketUrl}">{ticketUrl}</a>{/ticketUrl}{#infoRequired}<br>Info required: {infoRequired}{/infoRequired}{#referenceUserName}<br>Reference user: {referenceUserName}{/referenceUserName}</li>`,
  },
  {
    key: "it.landline",
    name: "IT landline-number request",
    subject: "Landline number for {preferredFirstName} {preferredLastName}",
    body: `<p>Hi,</p>

<p>Please arrange a landline / desk phone number for <strong>{preferredFirstName} {preferredLastName}</strong> ({title}), who is joining {department} at {location} on {startDate}. Their manager is {managerName}.</p>

<p>If you have any questions, please reach out to their manager directly.</p>`,
  },
  {
    key: "marketing.induction",
    name: "Marketing induction booking",
    subject:
      "Marketing induction for {preferredFirstName} {preferredLastName}",
    body: PLACEHOLDER_BODY,
  },
  {
    key: "licence.request",
    name: "Driver licence request",
    subject:
      "Driver licence copy for {preferredFirstName} {preferredLastName}",
    body: PLACEHOLDER_BODY,
  },
  {
    key: "manager.vehicle",
    name: "Manager vehicle notification",
    subject:
      "Vehicle arrangements for {preferredFirstName} {preferredLastName}",
    body: PLACEHOLDER_BODY,
  },
  {
    key: "forms.offerReminder",
    name: "Letter of offer reminder",
    subject:
      "Letter of offer outstanding for {preferredFirstName} {preferredLastName}",
    body: PLACEHOLDER_BODY,
  },
  {
    key: "forms.attachments",
    name: "Employment forms / police check",
    subject: "Employment forms for {preferredFirstName} {preferredLastName}",
    body: PLACEHOLDER_BODY,
  },
  {
    key: "ticket.expiryWarning",
    name: "Tickets expiring soon",
    subject: "Tickets expiring soon ({count})",
    body: `<p>Hi,</p>
<p>The following tickets/credentials are due to expire soon. Please arrange renewal:</p>
{ticketList}`,
  },
  {
    key: "ticket.expiryWarning.row",
    name: "— one expiring-ticket row",
    subject: "",
    body: `<li>{employeeName} — {ticketName}: expires {expiryDate} ({daysText})</li>`,
  },
  {
    key: "ticket.expired",
    name: "Tickets expired",
    subject: "Tickets expired ({count})",
    body: `<p>Hi,</p>
<p>The following tickets/credentials have expired. Their holders are now non-compliant until renewed:</p>
{ticketList}`,
  },
  {
    key: "ticket.expired.row",
    name: "— one expired-ticket row",
    subject: "",
    body: `<li>{employeeName} — {ticketName}: expired {expiryDate}</li>`,
  },
  {
    key: "sop.submitted",
    name: "SOP assessment submitted — to designated trainers",
    subject: "SOP assessment ready to mark: {sopTitle} — {employeeName}",
    body: `<p>Hi,</p>
<p>{employeeName} has submitted their answers for <strong>{sopTitle}</strong>.</p>
<p>Please review and mark the assessment in HRT (SOP Reviews).</p>`,
  },
  {
    key: "sop.changesRequested",
    name: "SOP assessment — changes requested (to employee)",
    subject: "Changes requested on your {sopTitle} assessment",
    body: `<p>Hi {employeeName},</p>
<p>{trainerName} has reviewed your <strong>{sopTitle}</strong> assessment and marked one or more answers as needing changes.</p>
<p>Open My SOPs in HRT to see the comments and resubmit.</p>`,
  },
  {
    key: "sop.passed",
    name: "SOP assessment passed (to employee)",
    subject: "You passed: {sopTitle}",
    body: `<p>Hi {employeeName},</p>
<p>{trainerName} has marked all your answers sufficient — <strong>{sopTitle}</strong> is complete and recorded in HRT.</p>`,
  },
  {
    key: "it.quizSummary",
    name: "IT induction questionnaire — summary to IT",
    subject: "IT induction completed: {employeeName}",
    body: `<p>Hi,</p>
<p>{employeeName} has completed the IT induction questionnaire. Open their summary in HRT to tailor their introduction before the session:</p>
<p><a href="{summaryUrl}">{summaryUrl}</a></p>
<p>Nothing in the questionnaire is graded — the summary flags where a hand or a tip would help.</p>`,
  },
  {
    key: "email.layout",
    name: "Shared email layout",
    subject: "",
    body: LAYOUT_BODY,
  },
];

/**
 * Sample rows for previewing a list token. Each entry feeds one render of the
 * row fragment, so an admin editing a row template sees their own markup.
 */
export const SAMPLE_LIST_ROWS: Record<string, Record<string, string>[]> = {
  "ticket.expiryWarning.row": [
    {
      employeeName: "Jono Sample",
      ticketName: "Forklift Licence",
      expiryDate: "8 August 2026",
      days: "9",
      daysText: "9 days",
    },
    {
      employeeName: "Priya Example",
      ticketName: "Working at Heights",
      expiryDate: "1 September 2026",
      days: "33",
      daysText: "33 days",
    },
  ],
  "ticket.expired.row": [
    {
      employeeName: "Jono Sample",
      ticketName: "Forklift Licence",
      expiryDate: "12 July 2026",
    },
    {
      employeeName: "Priya Example",
      ticketName: "Confined Spaces",
      expiryDate: "2 July 2026",
    },
  ],
  "it.programs.row": [
    {
      programName: "AutoCAD",
      ticketUrl: "https://itsp.example.com/serviceOfferings/1234",
      infoRequired: "Licence seat type",
      referenceUserName: "Alex Existing",
    },
    // Second row exercises the {#token} conditionals by leaving them empty.
    { programName: "SAP GUI", ticketUrl: "", infoRequired: "", referenceUserName: "" },
  ],
};
