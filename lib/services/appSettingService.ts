import prisma from "@/lib/prisma";

interface SettingDefault {
  key: string;
  // Optional: when present, the env var seeds the initial value. Some settings
  // (e.g. uploaded-attachment paths) are only ever set at runtime, no env var.
  envVar?: string;
  defaultValue: string;
  description: string;
}

const SETTING_DEFAULTS: SettingDefault[] = [
  {
    key: "matching.email.enabled",
    envVar: "USER_MATCH_EMAIL_ENABLED",
    defaultValue: "true",
    description: "Enable email-based user-employee matching",
  },
  {
    key: "matching.email.template",
    envVar: "USER_MATCH_EMAIL_TEMPLATE",
    defaultValue: "{firstName}.{lastName}",
    description:
      "Email local-part template. Use {firstName} and {lastName} tokens.",
  },
  {
    key: "matching.nameExact.enabled",
    envVar: "USER_MATCH_NAME_EXACT_ENABLED",
    defaultValue: "true",
    description:
      "Enable exact name matching between user.name and employee full name",
  },
  {
    key: "matching.nameFuzzy.enabled",
    envVar: "USER_MATCH_NAME_FUZZY_ENABLED",
    defaultValue: "true",
    description: "Enable fuzzy name matching using Levenshtein similarity",
  },
  {
    key: "matching.nameFuzzy.threshold",
    envVar: "USER_MATCH_NAME_FUZZY_THRESHOLD",
    defaultValue: "0.7",
    description:
      "Minimum Levenshtein similarity (0–1) to consider a fuzzy match",
  },
  {
    key: "matching.suggestionThreshold",
    envVar: "USER_MATCH_SUGGESTION_THRESHOLD",
    defaultValue: "50",
    description: "Minimum combined score (0–100) for a suggestion to appear",
  },
  {
    key: "jobs.historyRetentionYears",
    envVar: "JOBS_HISTORY_RETENTION_YEARS",
    defaultValue: "7",
    description:
      "History records older than this many years are eligible for pruning",
  },
  {
    key: "jobs.pollIntervalMs",
    envVar: "JOBS_POLL_INTERVAL_MS",
    defaultValue: "5000",
    description:
      "How often the job runner polls for pending work (milliseconds)",
  },
  {
    key: "jobs.maxRetries",
    envVar: "JOBS_MAX_RETRIES",
    defaultValue: "3",
    description:
      "How many times a failed job is retried before being marked Failed",
  },
  {
    key: "jobs.retryBackoffMs",
    envVar: "JOBS_RETRY_BACKOFF_MS",
    defaultValue: "30000",
    description:
      "Base delay before retrying a failed job; grows exponentially per attempt (milliseconds)",
  },
  {
    key: "theme.default",
    envVar: "DEFAULT_THEME",
    defaultValue: "default",
    description: "Slug of the organisation-wide default theme",
  },
  {
    key: "theme.lock",
    envVar: "LOCK_THEME",
    defaultValue: "false",
    description: "When true, prevents users from overriding the org theme",
  },
  // --- Onboarding config (§6.7). The email domain is intentionally NOT here —
  // it is sourced from companyDetails.domain_extension (NEXT_PUBLIC_COMPANY_DOMAIN_EXTENSION). ---
  {
    key: "onboarding.itTicketBaseUrl",
    envVar: "ONBOARDING_IT_TICKET_BASE_URL",
    defaultValue: "https://itsp.intern.ksb.com/assystnet/#serviceOfferings/",
    description:
      "Base URL for IT service-offering tickets; a program's ticket number is appended to it.",
  },
  {
    key: "onboarding.hardwareEndpoint",
    envVar: "ONBOARDING_HARDWARE_ENDPOINT",
    defaultValue: "https://checkout.ksb.com.au/",
    description: "Endpoint for the hardware-request platform (placeholder).",
  },
  {
    key: "onboarding.recipient.it",
    envVar: "ONBOARDING_RECIPIENT_IT",
    defaultValue: "",
    description: "Email address that receives consolidated IT software-access requests.",
  },
  {
    key: "onboarding.recipient.hr",
    envVar: "ONBOARDING_RECIPIENT_HR",
    defaultValue: "",
    description: "Email address that receives HR department notes.",
  },
  {
    key: "onboarding.recipient.payroll",
    envVar: "ONBOARDING_RECIPIENT_PAYROLL",
    defaultValue: "",
    description: "Email address that receives Payroll department notes.",
  },
  {
    key: "onboarding.recipient.marketing",
    envVar: "ONBOARDING_RECIPIENT_MARKETING",
    defaultValue: "",
    description:
      "Email address that receives marketing-induction booking requests.",
  },
  {
    key: "onboarding.recipient.licence",
    envVar: "ONBOARDING_RECIPIENT_LICENCE",
    defaultValue: "",
    description:
      "Recipient for driver-licence copies (currently 'Vicki'); configurable.",
  },
  {
    key: "onboarding.attachment.employmentForms",
    defaultValue: "",
    description:
      "JSON array of employment-forms compliance attachments (set via upload); supports multiple files.",
  },
  {
    key: "onboarding.attachment.policeCheck",
    defaultValue: "",
    description:
      "JSON array (single file) of the police-check compliance attachment (set via upload).",
  },
  // Job Family prefill rules (spec §6.5). Store the Job Family ID as a string.
  // When the matching job family is selected in the onboarding form, the
  // corresponding hardware/software/compliance fields are pre-filled.
  {
    key: "onboarding.jobFamily.serviceTechnician",
    envVar: "ONBOARDING_JOB_FAMILY_SERVICE_TECHNICIAN",
    defaultValue: "",
    description:
      "Comma-separated Job Family IDs that trigger Service Technician prefills: laptop unchecked, iPad checked, E3 licence unchecked.",
  },
  {
    key: "onboarding.jobFamily.engineering",
    envVar: "ONBOARDING_JOB_FAMILY_ENGINEERING",
    defaultValue: "",
    description:
      "Comma-separated Job Family IDs that trigger Engineering prefills: non-standard laptop checked.",
  },
  {
    key: "onboarding.jobFamily.salesMarketing",
    envVar: "ONBOARDING_JOB_FAMILY_SALES_MARKETING",
    defaultValue: "",
    description:
      "Comma-separated Job Family IDs that trigger Sales/Marketing prefills: marketing induction checked.",
  },
];

export class AppSettingService {
  async ensureDefaults(): Promise<void> {
    const upserts = SETTING_DEFAULTS.map((s) => {
      const value = (s.envVar ? process.env[s.envVar] : undefined) ?? s.defaultValue;
      return prisma.appSetting.upsert({
        where: { key: s.key },
        create: { key: s.key, value, description: s.description },
        update: { description: s.description }, // never overwrite an admin-set value
      });
    });
    await Promise.all(upserts);
  }

  async getSettings(): Promise<Record<string, string>> {
    await this.ensureDefaults();
    const rows = await prisma.appSetting.findMany();
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  async updateSetting(
    key: string,
    value: string,
    userId: string,
  ): Promise<void> {
    const existing = await prisma.appSetting.findUnique({ where: { key } });

    if (existing?.value === value) return;

    await prisma.appSetting.upsert({
      where: { key },
      create: { key, value, updatedBy: userId },
      update: { value, updatedBy: userId },
    });

    await prisma.history.create({
      data: {
        tableName: "AppSetting",
        recordId: key,
        action: "UPDATE",
        changedFields: JSON.stringify(["value"]),
        oldValues: existing ? JSON.stringify({ value: existing.value }) : null,
        newValues: JSON.stringify({ value }),
        userId,
      },
    });
  }

  async bulkUpdateSettings(
    updates: { key: string; value: string }[],
    userId: string,
  ): Promise<void> {
    await Promise.all(
      updates.map((u) => this.updateSetting(u.key, u.value, userId)),
    );
  }
}

export const appSettingService = new AppSettingService();
