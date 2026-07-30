import prisma from "@/lib/prisma";
import {
  LAYOUT_KEY,
  LIST_TOKENS,
  SAMPLE_TOKEN_VALUES,
  TEMPLATE_META,
  groupFor,
  isFragment,
  kindFor,
  tokensFor,
  unbalancedConditionals,
  unknownTokens,
  type TemplateGroup,
  type TemplateKind,
} from "@/lib/email-templates/tokens";
import {
  PLACEHOLDER_BODY,
  SAMPLE_LIST_ROWS,
  TEMPLATE_DEFAULTS,
  type EmailTemplateDefault,
} from "@/lib/email-templates/defaults";

export type { EmailTemplateDefault };
export {
  TEMPLATE_META,
  LAYOUT_KEY,
  LIST_TOKENS,
} from "@/lib/email-templates/tokens";

/** Every token any template can use — the flat union, for reference/tests. */
export const EMAIL_TEMPLATE_TOKENS = [
  ...new Set(Object.values(TEMPLATE_META).flatMap((m) => [...m.tokens])),
] as const;

export type TemplateVars = Record<string, string | number | null | undefined>;

/** A template row plus the registry metadata the editor needs. */
export interface TemplateWithMeta {
  key: string;
  name: string;
  subject: string;
  body: string;
  isActive: boolean;
  updatedAt: Date;
  group: TemplateGroup;
  kind: TemplateKind;
  blurb: string;
  tokens: readonly string[];
  /** An admin has edited this template, so ensureDefaults leaves it alone. */
  isEdited: boolean;
  /** Still holds the "copy not written yet" placeholder. */
  isPlaceholder: boolean;
  /** Tokens referenced but not supplied by the send site. */
  unknownTokens: string[];
  /** The row fragment this template's generated list is built from, if any. */
  rowKey?: string;
}

export interface TemplateVersion {
  id: number;
  timestamp: Date;
  action: string;
  userId: string | null;
  userName: string | null;
  subject: string;
  body: string;
  isActive: boolean;
}

export class EmailTemplateService {
  // Idempotent. Seeds the default templates and keeps them in sync with the
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

  // Of `keys`, those whose copy is still whatever was seeded — no edit recorded,
  // or the most recent audit row is a REVERT back to the default. Reverting has
  // to clear "edited" status, otherwise a template an admin has restored would
  // be frozen out of future default updates forever.
  private async uneditedKeys(keys: string[]): Promise<Set<string>> {
    const rows = await prisma.history.findMany({
      where: {
        tableName: "EmailTemplate",
        recordId: { in: keys },
        action: { in: ["UPDATE", "REVERT"] },
      },
      select: { recordId: true, action: true, timestamp: true },
      orderBy: { timestamp: "desc" },
    });

    const latest = new Map<string, string>();
    for (const row of rows) {
      if (!latest.has(row.recordId)) latest.set(row.recordId, row.action);
    }

    // Errs towards "edited": only no audit trail at all, or an explicit REVERT,
    // frees a template to be resynced. Anything else keeps the admin's copy.
    return new Set(
      keys.filter((k) => !latest.has(k) || latest.get(k) === "REVERT"),
    );
  }

  async getTemplates() {
    await this.ensureDefaults();
    return prisma.emailTemplate.findMany({ orderBy: { key: "asc" } });
  }

  /** The editor's list view: every template with its registry metadata. */
  async getTemplatesWithMeta(): Promise<TemplateWithMeta[]> {
    const templates = await this.getTemplates();
    const unedited = await this.uneditedKeys(templates.map((t) => t.key));

    return templates.map((t) => {
      const meta = TEMPLATE_META[t.key];
      return {
        key: t.key,
        name: t.name,
        subject: t.subject,
        body: t.body,
        isActive: t.isActive,
        updatedAt: t.updatedAt,
        group: groupFor(t.key),
        kind: kindFor(t.key),
        blurb: meta?.blurb ?? "",
        tokens: tokensFor(t.key),
        isEdited: !unedited.has(t.key),
        isPlaceholder: t.body.trim() === PLACEHOLDER_BODY.trim(),
        unknownTokens: [
          ...new Set([
            ...unknownTokens(t.key, t.subject),
            ...unknownTokens(t.key, t.body),
          ]),
        ],
        rowKey: LIST_TOKENS[t.key]?.rowKey,
      };
    });
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

    // The layout is the one template whose body has a hard requirement: without
    // {content} every email wrapped in it would go out empty.
    if (
      key === LAYOUT_KEY &&
      data.body !== undefined &&
      !data.body.includes("{content}")
    ) {
      throw new Error("LAYOUT_MISSING_CONTENT");
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

    await this.recordVersion("UPDATE", key, existing, updated, userId);

    return updated;
  }

  /**
   * Put a template back to the copy it shipped with. Recorded as a REVERT so
   * `uneditedKeys` stops protecting it and it tracks future default changes
   * again.
   */
  async revertToDefault(key: string, userId: string) {
    const fallback = TEMPLATE_DEFAULTS.find((t) => t.key === key);
    if (!fallback) {
      throw new Error("TEMPLATE_NOT_FOUND");
    }
    const existing = await prisma.emailTemplate.findUnique({ where: { key } });
    if (!existing) {
      throw new Error("TEMPLATE_NOT_FOUND");
    }

    const updated = await prisma.emailTemplate.update({
      where: { key },
      data: {
        name: fallback.name,
        subject: fallback.subject,
        body: fallback.body,
        isActive: true,
      },
    });

    await this.recordVersion("REVERT", key, existing, updated, userId);

    return updated;
  }

  /** Past versions of a template, newest first, for the editor's history view. */
  async getHistory(key: string): Promise<TemplateVersion[]> {
    const rows = await prisma.history.findMany({
      where: {
        tableName: "EmailTemplate",
        recordId: key,
        action: { in: ["UPDATE", "REVERT"] },
      },
      orderBy: { timestamp: "desc" },
      take: 50,
      include: { user: { select: { name: true, email: true } } },
    });

    // Each row's `oldValues` is the copy as it stood *before* that edit — which
    // is exactly the snapshot "restore this version" puts back.
    return rows.flatMap((row) => {
      const snapshot = this.parseSnapshot(row.oldValues);
      if (!snapshot) return [];
      return [
        {
          id: row.id,
          timestamp: row.timestamp,
          action: row.action,
          userId: row.userId,
          userName: row.user?.name ?? row.user?.email ?? null,
          subject: snapshot.subject,
          body: snapshot.body,
          isActive: snapshot.isActive,
        },
      ];
    });
  }

  /** Restore the copy captured by a History row, itself recorded as an edit. */
  async restoreVersion(key: string, historyId: number, userId: string) {
    const row = await prisma.history.findUnique({ where: { id: historyId } });
    if (
      !row ||
      row.tableName !== "EmailTemplate" ||
      row.recordId !== key
    ) {
      throw new Error("VERSION_NOT_FOUND");
    }

    const snapshot = this.parseSnapshot(row.oldValues);
    if (!snapshot) {
      throw new Error("VERSION_NOT_FOUND");
    }

    return this.updateTemplate(
      key,
      {
        subject: snapshot.subject,
        body: snapshot.body,
        isActive: snapshot.isActive,
      },
      userId,
    );
  }

  private parseSnapshot(
    json: string | null,
  ): { subject: string; body: string; isActive: boolean } | null {
    if (!json) return null;
    try {
      const parsed = JSON.parse(json) as Record<string, unknown>;
      if (
        typeof parsed.subject !== "string" ||
        typeof parsed.body !== "string"
      ) {
        return null;
      }
      return {
        subject: parsed.subject,
        body: parsed.body,
        isActive:
          typeof parsed.isActive === "boolean" ? parsed.isActive : true,
      };
    } catch {
      return null; // a malformed audit row shouldn't break the history view
    }
  }

  private async recordVersion(
    action: "UPDATE" | "REVERT",
    key: string,
    before: { name: string; subject: string; body: string; isActive: boolean },
    after: { name: string; subject: string; body: string; isActive: boolean },
    userId: string,
  ): Promise<void> {
    const fields = (["name", "subject", "body", "isActive"] as const).filter(
      (f) => before[f] !== after[f],
    );

    await prisma.history.create({
      data: {
        tableName: "EmailTemplate",
        recordId: key,
        action,
        changedFields: JSON.stringify(fields),
        oldValues: JSON.stringify({
          name: before.name,
          subject: before.subject,
          body: before.body,
          isActive: before.isActive,
        }),
        newValues: JSON.stringify({
          name: after.name,
          subject: after.subject,
          body: after.body,
          isActive: after.isActive,
        }),
        userId,
      },
    });
  }

  /**
   * Replace {token} occurrences with their values, and resolve
   * {#token}…{/token} conditional blocks.
   *
   * Unknown tokens (and tokens whose value is null/undefined) are left intact so
   * authors can spot typos. Conditional blocks are dropped when their token is
   * missing or empty — that is how an optional line in a generated row
   * disappears cleanly instead of leaving "Ticket:" with nothing after it.
   */
  interpolate(text: string, vars: TemplateVars): string {
    return this.replaceTokens(this.resolveConditionals(text, vars), vars);
  }

  private resolveConditionals(text: string, vars: TemplateVars): string {
    // Innermost-first so nested blocks collapse correctly; loops until no
    // markers are left rather than recursing.
    const block = /\{#(\w+)\}((?:(?!\{[#/]\w+\})[\s\S])*?)\{\/\1\}/;
    let out = text;
    let match = block.exec(out);
    let guard = 0;
    while (match && guard++ < 100) {
      const value = vars[match[1]];
      const present =
        value !== undefined && value !== null && String(value).trim() !== "";
      out = out.slice(0, match.index) + (present ? match[2] : "") +
        out.slice(match.index + match[0].length);
      match = block.exec(out);
    }
    return out;
  }

  private replaceTokens(text: string, vars: TemplateVars): string {
    return text.replace(/\{(\w+)\}/g, (match, token: string) => {
      const value = vars[token];
      return value === undefined || value === null ? match : String(value);
    });
  }

  /**
   * Render one row fragment per item and join them into the parent's list
   * wrapper. Returns "" for an empty list so the parent's {token} collapses.
   */
  async renderList(parentKey: string, rows: TemplateVars[]): Promise<string> {
    const source = LIST_TOKENS[parentKey];
    if (!source) throw new Error("TEMPLATE_NOT_FOUND");
    if (rows.length === 0) return "";

    const rowTemplate = await this.getTemplateByKey(source.rowKey);
    const rendered = rows
      .map((row) => this.interpolate(rowTemplate.body, row))
      .join("\n");

    return source.wrapper.replace("{rows}", rendered);
  }

  /**
   * Fetch a template by key, interpolate subject and body, and wrap the body in
   * the shared layout.
   *
   * Returns `null` when the template is switched off — an inactive template is a
   * deliberate "don't send this", so every call site must decide what to do
   * rather than silently mailing an empty message. TypeScript makes that
   * explicit at each site.
   */
  async render(
    key: string,
    vars: TemplateVars,
  ): Promise<{ subject: string; body: string } | null> {
    const template = await this.getTemplateByKey(key);
    if (!template.isActive) return null;

    const subject = this.interpolate(template.subject, vars);
    const body = this.interpolate(template.body, vars);

    return {
      subject,
      body: isFragment(key) ? body : await this.applyLayout(subject, body),
    };
  }

  /**
   * Wrap a rendered body in the shared layout. Skipped when the layout is
   * switched off or missing its {content} slot, so a broken layout degrades to
   * the bare body rather than sending an empty email.
   */
  private async applyLayout(subject: string, body: string): Promise<string> {
    const layout = await prisma.emailTemplate.findUnique({
      where: { key: LAYOUT_KEY },
    });
    if (!layout?.isActive || !layout.body.includes("{content}")) return body;

    return this.interpolate(layout.body, {
      subject,
      companyName: process.env.NEXT_PUBLIC_COMPANY_NAME ?? "HRT",
      appUrl: process.env.APP_URL ?? "",
      year: new Date().getFullYear(),
      // Substituted last and via a plain replace so tokens the body itself
      // failed to resolve are not re-interpreted as layout tokens.
    }).replace("{content}", () => body);
  }

  /**
   * Render a template against sample data for the editor's preview. Unlike
   * `render` this ignores `isActive` (an admin previewing a switched-off
   * template still wants to see it) and takes the draft copy from the editor
   * rather than what is stored.
   */
  async renderPreview(
    key: string,
    draft: { subject: string; body: string },
  ): Promise<{
    subject: string;
    body: string;
    unknownTokens: string[];
    unbalancedConditionals: string[];
  }> {
    const vars = await this.sampleVars(key);
    const subject = this.interpolate(draft.subject, vars);

    return {
      subject,
      body: isFragment(key)
        ? // Fragments interpolate against their own scaffolding, not the flat
          // samples — a row template needs one pass per sample row.
          await this.previewFragment(key, draft.body)
        : await this.applyLayout(subject, this.interpolate(draft.body, vars)),
      unknownTokens: [
        ...new Set([
          ...unknownTokens(key, draft.subject),
          ...unknownTokens(key, draft.body),
        ]),
      ],
      unbalancedConditionals: [
        ...new Set([
          ...unbalancedConditionals(draft.subject),
          ...unbalancedConditionals(draft.body),
        ]),
      ],
    };
  }

  // A fragment previewed on its own is not a valid document — a bare <li>, or a
  // layout with no content. Give each one enough scaffolding to look right.
  // `draft` is the raw editor text: a row fragment is interpolated once per
  // sample row, so pre-substituted values would leave nothing to vary.
  private async previewFragment(key: string, draft: string): Promise<string> {
    if (key === LAYOUT_KEY) {
      return this.interpolate(draft, {
        companyName: process.env.NEXT_PUBLIC_COMPANY_NAME ?? "HRT",
        appUrl: process.env.APP_URL ?? "https://hrt.example.com",
        year: new Date().getFullYear(),
        subject: "Sample subject line",
      }).replace(
        "{content}",
        () =>
          "<p>This is where each email's own copy appears.</p>" +
          "<p>Edit the individual templates to change this part.</p>",
      );
    }

    const source = Object.values(LIST_TOKENS).find((s) => s.rowKey === key);
    if (!source) return this.interpolate(draft, SAMPLE_TOKEN_VALUES);

    // Render every sample row so the admin sees the whole list — including the
    // row whose optional fields are empty, which is what {#token} blocks exist
    // for.
    const rows = SAMPLE_LIST_ROWS[key] ?? [];
    const rendered = (rows.length > 0 ? rows : [SAMPLE_TOKEN_VALUES]).map(
      (row) => this.interpolate(draft, row),
    );
    return source.wrapper.replace("{rows}", rendered.join("\n"));
  }

  /**
   * Sample values for every token `key` supports. List tokens are built by
   * rendering the current row fragment so a preview reflects row edits too.
   */
  async sampleVars(key: string): Promise<TemplateVars> {
    const vars: TemplateVars = {};
    for (const token of tokensFor(key)) {
      if (token in SAMPLE_TOKEN_VALUES) vars[token] = SAMPLE_TOKEN_VALUES[token];
    }

    const source = LIST_TOKENS[key];
    if (source) {
      vars[source.token] = await this.renderList(
        key,
        SAMPLE_LIST_ROWS[source.rowKey] ?? [],
      );
    }

    return vars;
  }

  /** Unknown-token / malformed-conditional warnings for draft copy. */
  validate(
    key: string,
    draft: { subject: string; body: string },
  ): { unknownTokens: string[]; unbalancedConditionals: string[] } {
    return {
      unknownTokens: [
        ...new Set([
          ...unknownTokens(key, draft.subject),
          ...unknownTokens(key, draft.body),
        ]),
      ],
      unbalancedConditionals: [
        ...new Set([
          ...unbalancedConditionals(draft.subject),
          ...unbalancedConditionals(draft.body),
        ]),
      ],
    };
  }
}

export const emailTemplateService = new EmailTemplateService();
