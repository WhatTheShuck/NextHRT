import prisma from "@/lib/prisma";

export interface EmailTemplateDefault {
  key: string;
  name: string;
  subject: string;
  body: string;
}

// Tokens available for interpolation in a template's subject/body. Values are
// supplied at job-fan-out time (Wave E) from the onboarding request and the
// created employee. Surfaced in the admin editor so authors know what they can
// reference. Unknown tokens are left untouched so typos are visible.
export const EMAIL_TEMPLATE_TOKENS = [
  "legalFirstName",
  "legalLastName",
  "preferredFirstName",
  "preferredLastName",
  "title",
  "department",
  "location",
  "startDate",
  "managerName",
  "employmentType",
  "email",
  // Fan-out computed tokens (§7): rendered at job time, not from the Employee record.
  "programs", // it.programs: HTML list of selected programs with ticket URLs
  "notes",    // hr.notes / payroll.notes / it.programs: the freeform department note
  // Vehicle tokens (manager.vehicle template only).
  "willReceiveVehicle", // "Yes" or "No"
  "willDriveVehicle",   // "Yes" or "No"
  "iamValidTo",         // startDate + 1 year (external hires only)
  // Ticket-expiry notification tokens (ticket.expiryWarning / ticket.expired).
  // These emails are consolidated: one message per recipient lists every
  // affected employee/ticket, so the copy references the list, not one holder.
  "ticketList",       // HTML <ul> of affected tickets (holder — ticket: expiry)
  "count",            // number of tickets listed in this email
  "employeeName",     // (SOP templates) an individual employee's name
  // SOP assessment tokens (sop.submitted / sop.changesRequested / sop.passed).
  "sopTitle",         // the SOP assessment title
  "trainerName",      // the designated trainer's name
  // IT induction quiz summary token (it.quizSummary).
  "summaryUrl",       // deep link to the response's results detail page
] as const;

const PLACEHOLDER_BODY =
  "TODO: the email copy for this template has not been written yet. " +
  "Edit it in App Settings → Onboarding. Use {tokens} (see the editor) to " +
  "interpolate values such as {preferredFirstName} and {startDate}.";

// Stable template ids the onboarding job fan-out (§7) renders. Seeded as blank
// placeholders; the owner fills the copy in over time via the admin editor.
const TEMPLATE_DEFAULTS: EmailTemplateDefault[] = [
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
    key: "ticket.expired",
    name: "Tickets expired",
    subject: "Tickets expired ({count})",
    body: `<p>Hi,</p>
<p>The following tickets/credentials have expired. Their holders are now non-compliant until renewed:</p>
{ticketList}`,
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
];

export class EmailTemplateService {
  // Idempotent. Seeds the placeholder templates and keeps them in sync with the
  // defaults above, but NEVER overwrites an admin-edited subject/body. "Edited"
  // means updateTemplate has written a History row for that key — templates
  // nobody has touched adopt the current default, so changing the copy (or the
  // tokens a caller supplies) here actually reaches existing databases instead
  // of leaving stale text that renders its placeholders literally.
  // Safe to run repeatedly / concurrently.
  async ensureDefaults(): Promise<void> {
    const existing = await prisma.emailTemplate.findMany({
      where: { key: { in: TEMPLATE_DEFAULTS.map((t) => t.key) } },
      select: { key: true, name: true, subject: true, body: true },
    });
    const byKey = new Map(existing.map((t) => [t.key, t]));

    const missing = TEMPLATE_DEFAULTS.filter((t) => !byKey.has(t.key));
    // Copy drift: the stored text no longer matches the default. Either an admin
    // rewrote it (keep theirs) or the default moved on underneath it (adopt the
    // new one) — the History audit trail tells the two apart.
    const drifted = TEMPLATE_DEFAULTS.filter((t) => {
      const current = byKey.get(t.key);
      return (
        current !== undefined &&
        (current.subject !== t.subject || current.body !== t.body)
      );
    });
    const stale =
      drifted.length > 0
        ? await this.uneditedKeys(drifted.map((t) => t.key))
        : new Set<string>();

    const writes = TEMPLATE_DEFAULTS.flatMap((t) => {
      if (missing.includes(t)) {
        return [
          prisma.emailTemplate.upsert({
            where: { key: t.key },
            create: {
              key: t.key,
              name: t.name,
              subject: t.subject,
              body: t.body,
            },
            update: {}, // lost a create race — the winner already wrote the default
          }),
        ];
      }
      const current = byKey.get(t.key)!;
      const resync = stale.has(t.key);
      if (current.name === t.name && !resync) return []; // already in sync
      return [
        prisma.emailTemplate.update({
          where: { key: t.key },
          data: resync
            ? { name: t.name, subject: t.subject, body: t.body }
            : { name: t.name },
        }),
      ];
    });

    await Promise.all(writes);
  }

  // Of `keys`, those with no UPDATE recorded against them — i.e. never edited
  // through updateTemplate, so their copy is still whatever was seeded.
  private async uneditedKeys(keys: string[]): Promise<Set<string>> {
    const edits = await prisma.history.findMany({
      where: {
        tableName: "EmailTemplate",
        recordId: { in: keys },
        action: "UPDATE",
      },
      select: { recordId: true },
      distinct: ["recordId"],
    });
    const editedKeys = new Set(edits.map((e) => e.recordId));
    return new Set(keys.filter((k) => !editedKeys.has(k)));
  }

  async getTemplates() {
    await this.ensureDefaults();
    return prisma.emailTemplate.findMany({ orderBy: { key: "asc" } });
  }

  async getTemplateByKey(key: string) {
    await this.ensureDefaults();
    const template = await prisma.emailTemplate.findUnique({ where: { key } });
    if (!template) {
      throw new Error("TEMPLATE_NOT_FOUND");
    }
    return template;
  }

  async updateTemplate(
    key: string,
    data: {
      name?: string;
      subject?: string;
      body?: string;
      isActive?: boolean;
    },
    userId: string,
  ) {
    const existing = await prisma.emailTemplate.findUnique({ where: { key } });
    if (!existing) {
      throw new Error("TEMPLATE_NOT_FOUND");
    }

    const updated = await prisma.emailTemplate.update({
      where: { key },
      data: {
        name: data.name ?? existing.name,
        subject: data.subject ?? existing.subject,
        body: data.body ?? existing.body,
        isActive: data.isActive ?? existing.isActive,
      },
    });

    await prisma.history.create({
      data: {
        tableName: "EmailTemplate",
        recordId: key,
        action: "UPDATE",
        oldValues: JSON.stringify({
          name: existing.name,
          subject: existing.subject,
          body: existing.body,
          isActive: existing.isActive,
        }),
        newValues: JSON.stringify({
          name: updated.name,
          subject: updated.subject,
          body: updated.body,
          isActive: updated.isActive,
        }),
        userId,
      },
    });

    return updated;
  }

  // Replace {token} occurrences with their values. Unknown tokens (and tokens
  // whose value is null/undefined) are left intact so authors can spot typos.
  interpolate(
    text: string,
    vars: Record<string, string | number | null | undefined>,
  ): string {
    return text.replace(/\{(\w+)\}/g, (match, token: string) => {
      const value = vars[token];
      return value === undefined || value === null ? match : String(value);
    });
  }

  // Convenience for the job fan-out: fetch a template by key and interpolate
  // both subject and body in one call.
  async render(
    key: string,
    vars: Record<string, string | number | null | undefined>,
  ): Promise<{ subject: string; body: string }> {
    const template = await this.getTemplateByKey(key);
    return {
      subject: this.interpolate(template.subject, vars),
      body: this.interpolate(template.body, vars),
    };
  }
}

export const emailTemplateService = new EmailTemplateService();
