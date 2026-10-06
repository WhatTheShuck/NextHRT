import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    backgroundJob: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return { ...actual, existsSync: vi.fn() };
});

import { existsSync } from "fs";
import { emailLogService } from "@/lib/services/emailLogService";

const HOUR = 60 * 60 * 1000;

function job(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    type: "SEND_EMAIL",
    status: "Completed",
    payload: JSON.stringify({ to: "a@ksb.com", subject: "Hello" }),
    resultSummary: null,
    errorMessage: null,
    attempts: 0,
    createdAt: new Date(),
    scheduledAt: new Date(),
    completedAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.backgroundJob.count.mockResolvedValue(0);
});

describe("emailLogService.list", () => {
  it("maps job states to email statuses", async () => {
    mockPrisma.backgroundJob.findMany.mockResolvedValue([
      job({ id: 1, status: "Completed" }),
      job({ id: 2, status: "Pending", scheduledAt: new Date(Date.now() - HOUR) }),
      job({ id: 3, status: "Pending", scheduledAt: new Date(Date.now() + HOUR) }),
      job({ id: 4, status: "Pending", attempts: 2 }),
      job({ id: 5, status: "Running" }),
      job({ id: 6, status: "Failed", errorMessage: "ENOENT" }),
      job({ id: 7, status: "Cancelled" }),
    ]);

    const { emails } = await emailLogService.list({ page: 1, pageSize: 25 });

    expect(emails.map((e) => e.status)).toEqual([
      "Sent",
      "Queued",
      "Scheduled",
      "Retrying",
      "Sending",
      "Failed",
      "Cancelled",
    ]);
  });

  it("summarises recipients, subject and attachments from the payload", async () => {
    mockPrisma.backgroundJob.findMany.mockResolvedValue([
      job({
        payload: JSON.stringify({
          to: ["a@ksb.com", "b@ksb.com"],
          cc: "c@ksb.com",
          subject: "Forms",
          html: "<p>big body</p>",
          attachments: [{ filename: "x.pdf", path: "/x.pdf" }, { filename: "i.ics", content: "" }],
        }),
      }),
      job({ id: 2, payload: "not json" }),
    ]);

    const { emails } = await emailLogService.list({ page: 1, pageSize: 25 });

    expect(emails[0]).toMatchObject({
      to: "a@ksb.com, b@ksb.com",
      cc: "c@ksb.com",
      subject: "Forms",
      attachmentCount: 2,
    });
    expect(emails[0]).not.toHaveProperty("html");
    expect(emails[1]).toMatchObject({ to: "", subject: "", attachmentCount: 0 });
  });

  it("applies the status filter, search and paging to the query", async () => {
    mockPrisma.backgroundJob.findMany.mockResolvedValue([]);

    await emailLogService.list({ filter: "queued", search: " smith ", page: 3, pageSize: 10 });

    const args = mockPrisma.backgroundJob.findMany.mock.calls[0][0];
    expect(args.where).toEqual({
      type: "SEND_EMAIL",
      status: { in: ["Pending", "Running"] },
      payload: { contains: "smith" },
    });
    expect(args.skip).toBe(20);
    expect(args.take).toBe(10);
  });
});

describe("emailLogService.get", () => {
  it("returns body, message id and whether stored attachments still exist", async () => {
    vi.mocked(existsSync).mockImplementation((p) => p.toString() === "/uploads/here.pdf");
    mockPrisma.backgroundJob.findFirst.mockResolvedValue(
      job({
        resultSummary: JSON.stringify({ messageId: "<abc@ksb>" }),
        payload: JSON.stringify({
          to: "a@ksb.com",
          subject: "s",
          html: "<p>hi</p>",
          attachments: [
            { filename: "Here.pdf", path: "/uploads/here.pdf" },
            { filename: "Gone.pdf", path: "/uploads/gone.pdf" },
            { filename: "invite.ics", content: "BEGIN:VCALENDAR" },
          ],
        }),
      }),
    );

    const email = await emailLogService.get(1);

    expect(email).toMatchObject({ html: "<p>hi</p>", messageId: "<abc@ksb>" });
    expect(email!.attachments).toEqual([
      { filename: "Here.pdf", isFile: true, exists: true },
      { filename: "Gone.pdf", isFile: true, exists: false },
      { filename: "invite.ics", isFile: false, exists: true },
    ]);
    expect(mockPrisma.backgroundJob.findFirst).toHaveBeenCalledWith({
      where: { id: 1, type: "SEND_EMAIL" },
    });
  });

  it("returns null for a job that isn't an email", async () => {
    mockPrisma.backgroundJob.findFirst.mockResolvedValue(null);
    expect(await emailLogService.get(99)).toBeNull();
  });
});
