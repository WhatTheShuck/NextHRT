import prisma from "@/lib/prisma";

interface SettingDefault {
  key: string;
  envVar: string;
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
    description: "Enable exact name matching between user.name and employee full name",
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
    description: "Minimum Levenshtein similarity (0–1) to consider a fuzzy match",
  },
  {
    key: "matching.suggestionThreshold",
    envVar: "USER_MATCH_SUGGESTION_THRESHOLD",
    defaultValue: "50",
    description: "Minimum combined score (0–100) for a suggestion to appear",
  },
];

export class AppSettingService {
  async ensureDefaults(): Promise<void> {
    const upserts = SETTING_DEFAULTS.map((s) => {
      const value = process.env[s.envVar] ?? s.defaultValue;
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
