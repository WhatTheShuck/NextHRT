import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "path";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    appSetting: { findUnique: vi.fn() },
    backgroundJob: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
vi.mock("@/lib/services/logService", () => ({
  logService: { log: vi.fn() },
}));
vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return { ...actual, existsSync: vi.fn() };
});

import { existsSync } from "fs";
import { onboardingConfigService } from "@/lib/services/onboardingConfigService";

const uploads = (rel: string) => path.join(process.cwd(), "uploads", rel);

// Files that currently exist on disk.
let onDisk: Set<string>;
// Current AppSetting values per key.
let settings: Record<string, string>;
// BackgroundJob rows by id.
let jobs: Map<number, Record<string, unknown>>;

function addJob(
  id: number,
  status: string,
  payload: Record<string, unknown>,
) {
  jobs.set(id, {
    id,
    type: "SEND_EMAIL",
    status,
    attempts: status === "Failed" ? 4 : 1,
    payload: JSON.stringify(payload),
    createdAt: new Date("2026-10-01T00:00:00Z"),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  onDisk = new Set();
  settings = {};
  jobs = new Map();

  vi.mocked(existsSync).mockImplementation((p) => onDisk.has(p.toString()));
  mockPrisma.appSetting.findUnique.mockImplementation(
    async ({ where }: { where: { key: string } }) =>
      settings[where.key] !== undefined ? { value: settings[where.key] } : null,
  );
  mockPrisma.backgroundJob.findMany.mockImplementation(async () =>
    [...jobs.values()].filter((j) => ["Pending", "Failed"].includes(j.status as string)),
  );
  mockPrisma.backgroundJob.findUnique.mockImplementation(
    async ({ where }: { where: { id: number } }) => jobs.get(where.id) ?? null,
  );
  mockPrisma.backgroundJob.updateMany.mockResolvedValue({ count: 1 });
});

function uploadCurrent(
  slot: "employmentForms" | "policeCheck",
  files: { path: string; name: string }[],
) {
  settings[`onboarding.attachment.${slot}`] = JSON.stringify(
    files.map((f) => ({ ...f, size: 1000 })),
  );
  for (const f of files) onDisk.add(uploads(f.path));
}

describe("findStaleComplianceEmails", () => {
  it("lists emails whose compliance attachments are missing, ignoring healthy ones", async () => {
    uploadCurrent("employmentForms", [{ path: "compliance/new.pdf", name: "Forms.pdf" }]);
    addJob(1, "Failed", {
      to: "manager@ksb.com",
      subject: "Employment forms for A",
      attachments: [{ filename: "Forms.pdf", path: uploads("compliance/gone.pdf") }],
    });
    addJob(2, "Pending", {
      to: "manager@ksb.com",
      subject: "Employment forms for B",
      attachments: [{ filename: "Forms.pdf", path: uploads("compliance/new.pdf") }],
    });
    // A calendar invite with inline content is never treated as compliance.
    addJob(3, "Failed", {
      to: "it@ksb.com",
      subject: "IT request",
      attachments: [{ filename: "invite.ics", content: "BEGIN:VCALENDAR" }],
    });

    const stale = await onboardingConfigService.findStaleComplianceEmails();

    expect(stale.map((s) => s.jobId)).toEqual([1]);
    expect(stale[0]).toMatchObject({
      to: "manager@ksb.com",
      status: "Failed",
      slots: ["employmentForms"],
      missingFiles: ["Forms.pdf"],
    });
  });

  it("uses recorded complianceSlots over filename matching", async () => {
    uploadCurrent("employmentForms", [{ path: "compliance/new.pdf", name: "Forms.pdf" }]);
    uploadCurrent("policeCheck", [{ path: "compliance/pc.pdf", name: "Police.pdf" }]);
    addJob(1, "Failed", {
      to: "m@ksb.com",
      subject: "s",
      attachments: [{ filename: "Renamed.pdf", path: uploads("compliance/gone.pdf") }],
      complianceSlots: ["policeCheck"],
    });

    const [email] = await onboardingConfigService.findStaleComplianceEmails();
    expect(email.slots).toEqual(["policeCheck"]);
  });

  it("falls back to every uploaded slot when a legacy filename can't be matched", async () => {
    uploadCurrent("employmentForms", [{ path: "compliance/new.pdf", name: "Forms v2.pdf" }]);
    uploadCurrent("policeCheck", [{ path: "compliance/pc.pdf", name: "Police.pdf" }]);
    addJob(1, "Failed", {
      to: "m@ksb.com",
      subject: "s",
      attachments: [{ filename: "Forms v1.pdf", path: uploads("compliance/gone.pdf") }],
    });

    const [email] = await onboardingConfigService.findStaleComplianceEmails();
    expect(email.slots).toEqual(["employmentForms", "policeCheck"]);
  });
});

describe("resendStaleComplianceEmails", () => {
  it("swaps in current files, keeps other attachments, and requeues a failed job", async () => {
    uploadCurrent("employmentForms", [
      { path: "compliance/a.pdf", name: "Forms A.pdf" },
      { path: "compliance/b.pdf", name: "Forms B.pdf" },
    ]);
    addJob(1, "Failed", {
      to: "m@ksb.com",
      subject: "Employment forms",
      html: "<p>hi</p>",
      attachments: [
        { filename: "Forms A.pdf", path: uploads("compliance/old.pdf") },
        { filename: "invite.ics", content: "BEGIN:VCALENDAR" },
      ],
    });

    const result = await onboardingConfigService.resendStaleComplianceEmails("admin-1");

    expect(result).toEqual({ resent: [1], skipped: [] });
    const call = mockPrisma.backgroundJob.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ id: 1, status: "Failed" });
    expect(call.data).toMatchObject({ status: "Pending", attempts: 0, errorMessage: null });
    expect(JSON.parse(call.data.payload)).toEqual({
      to: "m@ksb.com",
      subject: "Employment forms",
      html: "<p>hi</p>",
      attachments: [
        { filename: "invite.ics", content: "BEGIN:VCALENDAR" },
        { filename: "Forms A.pdf", path: uploads("compliance/a.pdf") },
        { filename: "Forms B.pdf", path: uploads("compliance/b.pdf") },
      ],
      complianceSlots: ["employmentForms"],
    });
  });

  it("only rewrites the payload of a pending job, leaving its schedule alone", async () => {
    uploadCurrent("employmentForms", [{ path: "compliance/a.pdf", name: "Forms.pdf" }]);
    addJob(1, "Pending", {
      to: "m@ksb.com",
      subject: "s",
      attachments: [{ filename: "Forms.pdf", path: uploads("compliance/old.pdf") }],
    });

    await onboardingConfigService.resendStaleComplianceEmails("admin-1");

    const { data } = mockPrisma.backgroundJob.updateMany.mock.calls[0][0];
    expect(Object.keys(data)).toEqual(["payload"]);
  });

  it("skips emails whose slot hasn't been re-uploaded yet", async () => {
    // Setting still lists the file, but it's gone from disk.
    settings["onboarding.attachment.employmentForms"] = JSON.stringify([
      { path: "compliance/gone.pdf", name: "Forms.pdf", size: 1000 },
    ]);
    addJob(1, "Failed", {
      to: "m@ksb.com",
      subject: "s",
      attachments: [{ filename: "Forms.pdf", path: uploads("compliance/gone.pdf") }],
    });

    const result = await onboardingConfigService.resendStaleComplianceEmails("admin-1");

    expect(result.resent).toEqual([]);
    expect(result.skipped).toEqual([
      { jobId: 1, reason: "Re-upload employment forms first" },
    ]);
    expect(mockPrisma.backgroundJob.updateMany).not.toHaveBeenCalled();
  });

  it("limits the resend to the given job ids", async () => {
    uploadCurrent("employmentForms", [{ path: "compliance/a.pdf", name: "Forms.pdf" }]);
    for (const id of [1, 2]) {
      addJob(id, "Failed", {
        to: `m${id}@ksb.com`,
        subject: "s",
        attachments: [{ filename: "Forms.pdf", path: uploads("compliance/old.pdf") }],
      });
    }

    const result = await onboardingConfigService.resendStaleComplianceEmails("admin-1", [2]);

    expect(result.resent).toEqual([2]);
    expect(mockPrisma.backgroundJob.updateMany).toHaveBeenCalledTimes(1);
  });

  it("reports a job the runner picked up mid-resend as skipped", async () => {
    uploadCurrent("employmentForms", [{ path: "compliance/a.pdf", name: "Forms.pdf" }]);
    addJob(1, "Pending", {
      to: "m@ksb.com",
      subject: "s",
      attachments: [{ filename: "Forms.pdf", path: uploads("compliance/old.pdf") }],
    });
    mockPrisma.backgroundJob.updateMany.mockResolvedValue({ count: 0 });

    const result = await onboardingConfigService.resendStaleComplianceEmails("admin-1");

    expect(result.resent).toEqual([]);
    expect(result.skipped[0].jobId).toBe(1);
  });
});
