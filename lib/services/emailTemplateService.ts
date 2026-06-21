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
    body: PLACEHOLDER_BODY,
  },
  {
    key: "hr.notes",
    name: "HR department note",
    subject: "New hire — note for HR: {preferredFirstName} {preferredLastName}",
    body: PLACEHOLDER_BODY,
  },
  {
    key: "payroll.notes",
    name: "Payroll department note",
    subject:
      "New hire — note for Payroll: {preferredFirstName} {preferredLastName}",
    body: PLACEHOLDER_BODY,
  },
  {
    key: "it.programs",
    name: "IT software-access request",
    subject: "Software access for {preferredFirstName} {preferredLastName}",
    body: PLACEHOLDER_BODY,
  },
  {
    key: "marketing.induction",
    name: "Marketing induction booking",
    subject:
      "Marketing induction for {preferredFirstName} {preferredLastName}",
    body: PLACEHOLDER_BODY,
  },
  {
    key: "medical.manager",
    name: "Pre-employment medical — manager",
    subject:
      "Pre-employment medical for {preferredFirstName} {preferredLastName}",
    body: PLACEHOLDER_BODY,
  },
  {
    key: "medical.employee",
    name: "Pre-employment medical — employee follow-up",
    subject: "Your pre-employment medical",
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
