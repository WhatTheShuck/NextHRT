// lib/services/__tests__/emailTemplateService.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    emailTemplate: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    history: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  };
  return { mockPrisma };
});

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { emailTemplateService } from "@/lib/services/emailTemplateService";

// A template whose stored copy matches the current default exactly.
const inSync = {
  key: "ticket.expiryWarning",
  name: "Tickets expiring soon",
  subject: "Tickets expiring soon ({count})",
  body: `<p>Hi,</p>
<p>The following tickets/credentials are due to expire soon. Please arrange renewal:</p>
{ticketList}`,
};

// The pre-consolidation copy that shipped before the ticket-expiry job switched
// to {ticketList}/{count} — its tokens are no longer supplied, so it renders
// them literally until it is re-synced.
const legacy = {
  key: "ticket.expiryWarning",
  name: "Ticket expiring soon",
  subject: "Ticket expiring soon: {ticketName} for {employeeName}",
  body: "{employeeName}'s {ticketName} expires on {expiryDate} ({daysUntilExpiry} days). Please arrange renewal.",
};

// Only the rows ensureDefaults actually wrote for `key`.
const updatesFor = (key: string) =>
  mockPrisma.emailTemplate.update.mock.calls
    .map(([arg]) => arg)
    .filter((arg) => arg.where.key === key);

beforeEach(() => {
  mockPrisma.emailTemplate.findMany.mockResolvedValue([]);
  mockPrisma.history.findMany.mockResolvedValue([]);
  mockPrisma.emailTemplate.upsert.mockResolvedValue({});
  mockPrisma.emailTemplate.update.mockResolvedValue({});
});

describe("ensureDefaults", () => {
  it("creates templates that do not exist yet", async () => {
    await emailTemplateService.ensureDefaults();

    const created = mockPrisma.emailTemplate.upsert.mock.calls.map(
      ([arg]) => arg.create,
    );
    expect(created).toContainEqual(expect.objectContaining(inSync));
    expect(mockPrisma.emailTemplate.update).not.toHaveBeenCalled();
  });

  it("re-syncs a stale template nobody has edited", async () => {
    mockPrisma.emailTemplate.findMany.mockResolvedValue([legacy]);

    await emailTemplateService.ensureDefaults();

    expect(updatesFor("ticket.expiryWarning")).toEqual([
      {
        where: { key: "ticket.expiryWarning" },
        data: { name: inSync.name, subject: inSync.subject, body: inSync.body },
      },
    ]);
  });

  it("keeps an admin's edit — a History UPDATE row protects the copy", async () => {
    mockPrisma.emailTemplate.findMany.mockResolvedValue([legacy]);
    mockPrisma.history.findMany.mockResolvedValue([
      { recordId: "ticket.expiryWarning" },
    ]);

    await emailTemplateService.ensureDefaults();

    // Name still tracks the default; the edited subject/body are left alone.
    expect(updatesFor("ticket.expiryWarning")).toEqual([
      {
        where: { key: "ticket.expiryWarning" },
        data: { name: inSync.name },
      },
    ]);
  });

  it("writes nothing for a template already matching the default", async () => {
    mockPrisma.emailTemplate.findMany.mockResolvedValue([inSync]);

    await emailTemplateService.ensureDefaults();

    expect(updatesFor("ticket.expiryWarning")).toEqual([]);
    // No drift means no need to consult the audit trail at all.
    expect(mockPrisma.history.findMany).not.toHaveBeenCalled();
  });
});

describe("interpolate", () => {
  it("substitutes known tokens", () => {
    expect(
      emailTemplateService.interpolate("Hi {name}, {count} due", {
        name: "Sam",
        count: 3,
      }),
    ).toBe("Hi Sam, 3 due");
  });

  it("leaves unknown tokens intact so typos are visible", () => {
    expect(emailTemplateService.interpolate("Hi {nmae}", { name: "Sam" })).toBe(
      "Hi {nmae}",
    );
  });

  describe("conditional blocks", () => {
    const row = "A{#url}, at {url}{/url}.";

    it("keeps a block whose token has a value", () => {
      expect(emailTemplateService.interpolate(row, { url: "x.com" })).toBe(
        "A, at x.com.",
      );
    });

    it("drops a block whose token is empty", () => {
      // The whole optional clause goes, not just the token — otherwise a missing
      // ticket URL would leave a dangling "at ." in the sent email.
      expect(emailTemplateService.interpolate(row, { url: "" })).toBe("A.");
    });

    it("drops a block whose token is absent entirely", () => {
      expect(emailTemplateService.interpolate(row, {})).toBe("A.");
    });

    it("drops a block whose token is only whitespace", () => {
      expect(emailTemplateService.interpolate(row, { url: "   " })).toBe("A.");
    });

    it("resolves nested blocks from the inside out", () => {
      const nested = "{#a}outer {#b}inner{/b}{/a}";
      expect(emailTemplateService.interpolate(nested, { a: "1", b: "1" })).toBe(
        "outer inner",
      );
      expect(emailTemplateService.interpolate(nested, { a: "1", b: "" })).toBe(
        "outer ",
      );
      expect(emailTemplateService.interpolate(nested, { a: "", b: "1" })).toBe("");
    });

    it("leaves an unclosed block alone rather than eating the rest of the body", () => {
      expect(emailTemplateService.interpolate("A{#url}B", { url: "x" })).toBe(
        "A{#url}B",
      );
    });
  });
});

describe("render", () => {
  const active = {
    key: "sop.passed",
    name: "SOP assessment passed (to employee)",
    subject: "You passed: {sopTitle}",
    body: "<p>Hi {employeeName},</p>",
    isActive: true,
  };

  const layout = {
    key: "email.layout",
    name: "Shared email layout",
    subject: "",
    body: "<header>{companyName}</header>{content}<footer>{year}</footer>",
    isActive: true,
  };

  // getTemplateByKey and applyLayout both go through findUnique; resolve each
  // call by the key it asks for.
  const stubTemplates = (...rows: Record<string, unknown>[]) => {
    const byKey = new Map(rows.map((r) => [r.key, r]));
    mockPrisma.emailTemplate.findUnique.mockImplementation(
      ({ where }: { where: { key: string } }) => byKey.get(where.key) ?? null,
    );
  };

  it("interpolates subject and body and wraps them in the layout", async () => {
    stubTemplates(active, layout);

    const result = await emailTemplateService.render("sop.passed", {
      sopTitle: "Teardown",
      employeeName: "Sam",
    });

    expect(result?.subject).toBe("You passed: Teardown");
    expect(result?.body).toContain("<p>Hi Sam,</p>");
    expect(result?.body).toContain("<header>");
    expect(result?.body).toContain("<footer>");
  });

  it("returns null for a switched-off template so send sites skip it", async () => {
    stubTemplates({ ...active, isActive: false }, layout);

    expect(
      await emailTemplateService.render("sop.passed", { employeeName: "Sam" }),
    ).toBeNull();
  });

  it("sends the bare body when the layout is switched off", async () => {
    stubTemplates(active, { ...layout, isActive: false });

    const result = await emailTemplateService.render("sop.passed", {
      employeeName: "Sam",
    });

    expect(result?.body).toBe("<p>Hi Sam,</p>");
  });

  it("sends the bare body rather than an empty one if the layout loses {content}", async () => {
    stubTemplates(active, { ...layout, body: "<header>broken</header>" });

    const result = await emailTemplateService.render("sop.passed", {
      employeeName: "Sam",
    });

    expect(result?.body).toBe("<p>Hi Sam,</p>");
  });

  it("does not wrap a fragment in the layout", async () => {
    const row = {
      key: "ticket.expired.row",
      name: "— one expired-ticket row",
      subject: "",
      body: "<li>{employeeName}</li>",
      isActive: true,
    };
    stubTemplates(row, layout);

    const result = await emailTemplateService.render("ticket.expired.row", {
      employeeName: "Sam",
    });

    expect(result?.body).toBe("<li>Sam</li>");
  });

  it("leaves a token the layout also uses alone — the body is substituted last", async () => {
    // A body that failed to resolve {year} must not have it filled in by the
    // layout pass; the literal token is the author's signal that it is wrong.
    stubTemplates({ ...active, body: "<p>{year}</p>" }, layout);

    const result = await emailTemplateService.render("sop.passed", {});

    expect(result?.body).toContain("<p>{year}</p>");
  });
});

describe("renderList", () => {
  it("renders one row per item through the row fragment and wraps them", async () => {
    mockPrisma.emailTemplate.findUnique.mockResolvedValue({
      key: "ticket.expired.row",
      body: "<li>{employeeName} — {ticketName}</li>",
      isActive: true,
    });

    const html = await emailTemplateService.renderList("ticket.expired", [
      { employeeName: "Sam", ticketName: "Forklift" },
      { employeeName: "Pri", ticketName: "Heights" },
    ]);

    expect(html).toBe(
      "<ul><li>Sam — Forklift</li>\n<li>Pri — Heights</li></ul>",
    );
  });

  it("returns an empty string for no items so the parent's token collapses", async () => {
    expect(await emailTemplateService.renderList("ticket.expired", [])).toBe("");
    expect(mockPrisma.emailTemplate.findUnique).not.toHaveBeenCalled();
  });
});

describe("revertToDefault", () => {
  it("restores the shipped copy and audits it as a REVERT", async () => {
    mockPrisma.emailTemplate.findUnique.mockResolvedValue({
      key: "ticket.expiryWarning",
      name: "Renamed",
      subject: "edited subject",
      body: "edited body",
      isActive: false,
    });
    mockPrisma.emailTemplate.update.mockResolvedValue(inSync);

    await emailTemplateService.revertToDefault("ticket.expiryWarning", "u1");

    expect(mockPrisma.emailTemplate.update).toHaveBeenCalledWith({
      where: { key: "ticket.expiryWarning" },
      data: {
        name: inSync.name,
        subject: inSync.subject,
        body: inSync.body,
        isActive: true,
      },
    });
    // REVERT, not UPDATE: ensureDefaults treats a reverted template as unedited
    // again, so it keeps tracking future changes to the default copy.
    expect(mockPrisma.history.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "REVERT",
          recordId: "ticket.expiryWarning",
          userId: "u1",
        }),
      }),
    );
  });
});

describe("ensureDefaults after a revert", () => {
  it("re-syncs a template whose latest audit row is a REVERT", async () => {
    mockPrisma.emailTemplate.findMany.mockResolvedValue([legacy]);
    mockPrisma.history.findMany.mockResolvedValue([
      { recordId: "ticket.expiryWarning", action: "REVERT", timestamp: new Date(2) },
      { recordId: "ticket.expiryWarning", action: "UPDATE", timestamp: new Date(1) },
    ]);

    await emailTemplateService.ensureDefaults();

    expect(updatesFor("ticket.expiryWarning")).toEqual([
      {
        where: { key: "ticket.expiryWarning" },
        data: { name: inSync.name, subject: inSync.subject, body: inSync.body },
      },
    ]);
  });

  it("still protects a template edited after its last revert", async () => {
    mockPrisma.emailTemplate.findMany.mockResolvedValue([legacy]);
    mockPrisma.history.findMany.mockResolvedValue([
      { recordId: "ticket.expiryWarning", action: "UPDATE", timestamp: new Date(2) },
      { recordId: "ticket.expiryWarning", action: "REVERT", timestamp: new Date(1) },
    ]);

    await emailTemplateService.ensureDefaults();

    expect(updatesFor("ticket.expiryWarning")).toEqual([
      { where: { key: "ticket.expiryWarning" }, data: { name: inSync.name } },
    ]);
  });
});
