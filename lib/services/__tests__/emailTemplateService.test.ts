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
});
