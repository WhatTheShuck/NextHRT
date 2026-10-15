import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    employee: { findUnique: vi.fn(), findMany: vi.fn() },
    department: { findMany: vi.fn() },
    history: { create: vi.fn() },
  };
  return { mockPrisma };
});

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
vi.mock("@/lib/services/mailService", () => ({
  mailService: { send: vi.fn() },
}));
vi.mock("@/lib/services/emailTemplateService", () => ({
  emailTemplateService: {
    render: vi.fn().mockResolvedValue({ subject: "s", body: "b" }),
    renderList: vi.fn().mockResolvedValue(""),
  },
}));
vi.mock("@/lib/services/matchingService", () => ({
  matchingService: { getSuggestions: vi.fn().mockResolvedValue([]) },
}));

import { accountOnboardingService } from "@/lib/services/accountOnboardingService";
import { userService } from "@/lib/services/userService";
import { mailService } from "@/lib/services/mailService";
import { emailTemplateService } from "@/lib/services/emailTemplateService";
import { matchingService } from "@/lib/services/matchingService";

beforeEach(() => {
  vi.clearAllMocks();
});

const employee = {
  id: 7,
  legalFirstName: "Jonathan",
  preferredFirstName: "Jono",
  title: "Service Technician",
  department: { name: "Service" },
};

describe("getStatus", () => {
  it("is unlinked when the user has no employee", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      employeeLinkedAt: null,
      welcomeDismissedAt: null,
      employee: null,
    });
    expect(await accountOnboardingService.getStatus("u1")).toEqual({
      state: "unlinked",
    });
  });

  it("welcomes a freshly linked user who hasn't dismissed it", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      employeeLinkedAt: new Date("2026-10-01"),
      welcomeDismissedAt: null,
      employee,
    });
    expect(await accountOnboardingService.getStatus("u1")).toEqual({
      state: "linked",
      employeeId: 7,
      firstName: "Jono",
      title: "Service Technician",
      department: "Service",
      showWelcome: true,
    });
  });

  it("does not welcome links that predate the timestamp", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      employeeLinkedAt: null,
      welcomeDismissedAt: null,
      employee,
    });
    const status = await accountOnboardingService.getStatus("u1");
    expect(status.state === "linked" && status.showWelcome).toBe(false);
  });

  it("stays dismissed until the account is linked again", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      employeeLinkedAt: new Date("2026-10-01"),
      welcomeDismissedAt: new Date("2026-10-02"),
      employee,
    });
    let status = await accountOnboardingService.getStatus("u1");
    expect(status.state === "linked" && status.showWelcome).toBe(false);

    mockPrisma.user.findUnique.mockResolvedValue({
      employeeLinkedAt: new Date("2026-10-03"),
      welcomeDismissedAt: new Date("2026-10-02"),
      employee,
    });
    status = await accountOnboardingService.getStatus("u1");
    expect(status.state === "linked" && status.showWelcome).toBe(true);
  });
});

describe("sendWaitingDigest", () => {
  const now = new Date("2026-10-12T08:00:00Z");
  const suggestion = (userId: string) => ({
    user: { id: userId, name: null, email: null },
    candidates: [
      {
        employee: {
          id: 7,
          legalFirstName: "Jonathan",
          legalLastName: "Sample",
          title: "Service Technician",
          department: "Service",
          location: "Brisbane",
        },
        score: 90,
        breakdown: {},
      },
    ],
  });

  it("sends nothing when nobody has been waiting more than a day", async () => {
    mockPrisma.user.findMany.mockResolvedValueOnce([]);

    expect(await accountOnboardingService.sendWaitingDigest(now)).toEqual({
      waiting: 0,
    });
    const where = mockPrisma.user.findMany.mock.calls[0][0].where;
    expect(where.createdAt.lte).toEqual(new Date("2026-10-11T08:00:00Z"));
    expect(where.employeeId).toBeNull();
    expect(mailService.send).not.toHaveBeenCalled();
  });

  it("sends one email listing everyone waiting, to every admin", async () => {
    mockPrisma.user.findMany
      .mockResolvedValueOnce([
        {
          id: "u1",
          name: "Jono <Sample>",
          email: "jono@example.com",
          createdAt: new Date("2026-10-09T07:00:00Z"),
        },
        {
          id: "u2",
          name: "Priya Example",
          email: "priya@example.com",
          createdAt: new Date("2026-10-11T07:00:00Z"),
        },
      ])
      .mockResolvedValueOnce([{ email: "a@example.com" }, { email: "b@example.com" }]);
    vi.mocked(matchingService.getSuggestions).mockResolvedValue([suggestion("u1")]);
    vi.mocked(emailTemplateService.renderList).mockResolvedValue("<ul>rows</ul>");

    expect(await accountOnboardingService.sendWaitingDigest(now)).toEqual({
      waiting: 2,
    });

    expect(emailTemplateService.renderList).toHaveBeenCalledWith(
      "account.waitingDigest",
      [
        {
          userName: "Jono &lt;Sample&gt;",
          userEmail: "jono@example.com",
          waitingFor: "3 days",
          suggestedMatch: "Jonathan Sample — Service Technician, Service (Brisbane)",
        },
        {
          userName: "Priya Example",
          userEmail: "priya@example.com",
          waitingFor: "1 day",
          suggestedMatch: "",
        },
      ],
    );
    expect(emailTemplateService.render).toHaveBeenCalledWith(
      "account.waitingDigest",
      expect.objectContaining({ userList: "<ul>rows</ul>", userCount: 2 }),
    );
    expect(mailService.send).toHaveBeenCalledTimes(1);
    expect(mailService.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: ["a@example.com", "b@example.com"] }),
    );
  });

  it("does nothing when the template is switched off", async () => {
    mockPrisma.user.findMany
      .mockResolvedValueOnce([
        { id: "u1", name: "x", email: "x@example.com", createdAt: new Date("2026-10-01") },
      ])
      .mockResolvedValueOnce([{ email: "a@example.com" }]);
    vi.mocked(emailTemplateService.render).mockResolvedValueOnce(null);

    await accountOnboardingService.sendWaitingDigest(now);
    expect(mailService.send).not.toHaveBeenCalled();
  });
});

describe("getTeamAccountStatus", () => {
  const emp = (id: number, first: string, linked: boolean, dept = "Service") => ({
    id,
    legalFirstName: first,
    legalLastName: "Test",
    preferredFirstName: null,
    preferredLastName: null,
    title: "Technician",
    department: { name: dept },
    User: linked ? { id: `user-${id}` } : null,
  });

  it("is null for someone who manages no departments", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      employeeId: 1,
      managedDepartments: [],
    });
    expect(await accountOnboardingService.getTeamAccountStatus("m1")).toBeNull();
  });

  it("scopes to managed departments plus children of top-level ones, excluding the manager", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      employeeId: 1,
      managedDepartments: [
        { id: 10, level: 0 },
        { id: 20, level: 1 },
      ],
    });
    mockPrisma.department.findMany.mockResolvedValue([{ id: 11 }]);
    mockPrisma.employee.findMany.mockResolvedValue([]);

    await accountOnboardingService.getTeamAccountStatus("m1");

    expect(mockPrisma.department.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { parentDepartmentId: { in: [10] } } }),
    );
    expect(mockPrisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isActive: true,
          departmentId: { in: [10, 20, 11] },
          NOT: { id: 1 },
        },
      }),
    );
  });

  it("marks linked, likely-signed-in and not-signed-in people", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      employeeId: null,
      managedDepartments: [{ id: 10, level: 1 }],
    });
    mockPrisma.employee.findMany.mockResolvedValue([
      emp(3, "Cara", false),
      emp(1, "Alex", true),
      emp(2, "Blair", false),
    ]);
    vi.mocked(matchingService.getSuggestions).mockResolvedValue([
      {
        user: { id: "u9", name: null, email: null },
        candidates: [
          {
            employee: {
              id: 2,
              legalFirstName: "Blair",
              legalLastName: "Test",
              title: "",
              department: "",
              location: "",
            },
            score: 90,
            breakdown: {},
          },
        ],
      },
    ]);

    const result = await accountOnboardingService.getTeamAccountStatus("m1");
    expect(result?.map((m) => [m.name, m.state])).toEqual([
      ["Alex Test", "linked"],
      ["Blair Test", "awaitingLink"],
      ["Cara Test", "notSignedIn"],
    ]);
  });
});

describe("userService.linkEmployee", () => {
  function setup(currentEmployeeId: number | null) {
    // A test that doesn't notify leaves its second Once queued.
    mockPrisma.user.findUnique.mockReset();
    mockPrisma.user.findUnique
      // linkEmployee: current user
      .mockResolvedValueOnce({ id: "u1", employeeId: currentEmployeeId })
      // notifyUserLinked: user + employee
      .mockResolvedValueOnce({
        email: "jono@example.com",
        employee: {
          legalFirstName: "Jonathan",
          legalLastName: "Sample",
          preferredFirstName: "Jono",
          preferredLastName: null,
        },
      });
    mockPrisma.employee.findUnique.mockResolvedValue({ id: 7 });
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.user.update.mockResolvedValue({ id: "u1", employeeId: 7 });
  }

  it("stamps the link time and emails the user on a first link", async () => {
    setup(null);
    await userService.linkEmployee("u1", 7, "admin");

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { employeeId: 7, employeeLinkedAt: expect.any(Date) },
      }),
    );
    expect(emailTemplateService.render).toHaveBeenCalledWith(
      "account.linked",
      expect.objectContaining({
        preferredFirstName: "Jono",
        employeeName: "Jono Sample",
      }),
    );
    expect(mailService.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "jono@example.com" }),
    );
  });

  it("re-stamps but doesn't email when re-pointing to another record", async () => {
    setup(3);
    await userService.linkEmployee("u1", 7, "admin");

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { employeeId: 7, employeeLinkedAt: expect.any(Date) },
      }),
    );
    expect(mailService.send).not.toHaveBeenCalled();
  });

  it("leaves the timestamp alone when saving the same link", async () => {
    setup(7);
    await userService.linkEmployee("u1", 7, "admin");

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { employeeId: 7 } }),
    );
    expect(mailService.send).not.toHaveBeenCalled();
  });

  it("still links when the notification fails", async () => {
    setup(null);
    vi.mocked(mailService.send).mockRejectedValueOnce(new Error("smtp down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      userService.linkEmployee("u1", 7, "admin"),
    ).resolves.toEqual({ id: "u1", employeeId: 7 });
  });
});
