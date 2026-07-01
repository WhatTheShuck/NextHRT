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
  "employeeName",     // the ticket holder's name
  "ticketName",       // the ticket / credential name
  "expiryDate",       // the record's expiry date (YYYY-MM-DD)
  "daysUntilExpiry",  // whole days from now until expiry (0 once expired)
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
    name: "Ticket expiring soon",
    subject: "Ticket expiring soon: {ticketName} for {employeeName}",
    body: "{employeeName}'s {ticketName} expires on {expiryDate} ({daysUntilExpiry} days). Please arrange renewal.",
  },
  {
    key: "ticket.expired",
    name: "Ticket expired",
    subject: "Ticket EXPIRED: {ticketName} for {employeeName}",
    body: "{employeeName}'s {ticketName} expired on {expiryDate}. They are now non-compliant until it is renewed.",
  },
];

export class EmailTemplateService {
  // Idempotent. Seeds the placeholder templates but NEVER overwrites the
  // admin-edited subject/body — only keeps the display name in sync (mirrors
  // appSettingService.ensureDefaults). Safe to run repeatedly / concurrently.
  async ensureDefaults(): Promise<void> {
    const upserts = TEMPLATE_DEFAULTS.map((t) =>
      prisma.emailTemplate.upsert({
        where: { key: t.key },
        create: { key: t.key, name: t.name, subject: t.subject, body: t.body },
        update: { name: t.name },
      }),
    );
    await Promise.all(upserts);
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
