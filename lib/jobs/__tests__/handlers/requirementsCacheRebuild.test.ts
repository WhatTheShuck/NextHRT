import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    employee: { findMany: vi.fn() },
    trainingRequirement: { findMany: vi.fn() },
    ticketRequirement: { findMany: vi.fn() },
    trainingRecords: { findMany: vi.fn() },
    ticketRecords: { findMany: vi.fn() },
    trainingTicketExemption: { findMany: vi.fn() },
    requirementsCacheEntry: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  return { mockPrisma };
});

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { requirementsCacheRebuildHandler } from "@/lib/jobs/handlers/requirementsCacheRebuild";

// Shorthand builders
const emp = (id: number, departmentId: number, locationId: number) => ({
  id,
  departmentId,
  locationId,
});

const trainingReq = (trainingId: number, departmentId: number, locationId: number) => ({
  trainingId,
  departmentId,
  locationId,
  training: { isActive: true },
});

const ticketReq = (ticketId: number, departmentId: number, locationId: number) => ({
  ticketId,
  departmentId,
  locationId,
  ticket: { isActive: true },
});

beforeEach(() => {
  mockPrisma.employee.findMany.mockResolvedValue([]);
  mockPrisma.trainingRequirement.findMany.mockResolvedValue([]);
  mockPrisma.ticketRequirement.findMany.mockResolvedValue([]);
  mockPrisma.trainingRecords.findMany.mockResolvedValue([]);
  mockPrisma.ticketRecords.findMany.mockResolvedValue([]);
  mockPrisma.trainingTicketExemption.findMany.mockResolvedValue([]);
  mockPrisma.requirementsCacheEntry.deleteMany.mockResolvedValue({ count: 0 });
  mockPrisma.requirementsCacheEntry.createMany.mockResolvedValue({ count: 0 });
  mockPrisma.$transaction.mockResolvedValue([]);
});

describe("requirementsCacheRebuildHandler — basics", () => {
  it("returns 0 entries when there are no active employees", async () => {
    const result = await requirementsCacheRebuildHandler({});

    expect(result).toEqual({ totalEntries: 0, employeesProcessed: 0 });
  });

  it("calls $transaction and always passes deleteMany({})", async () => {
    await requirementsCacheRebuildHandler({});

    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
    expect(mockPrisma.requirementsCacheEntry.deleteMany).toHaveBeenCalledWith({});
  });
});

describe("requirementsCacheRebuildHandler — training requirements", () => {
  it("creates a Training cache entry for an employee with an unmet requirement", async () => {
    mockPrisma.employee.findMany.mockResolvedValue([emp(1, 10, 20)]);
    mockPrisma.trainingRequirement.findMany.mockResolvedValue([trainingReq(101, 10, 20)]);

    const result = await requirementsCacheRebuildHandler({});

    expect(mockPrisma.requirementsCacheEntry.createMany).toHaveBeenCalledWith({
      data: [{ employeeId: 1, itemType: "Training", itemId: 101 }],
    });
    expect(result.totalEntries).toBe(1);
  });

  it("does not create an entry for training the employee has already completed", async () => {
    mockPrisma.employee.findMany.mockResolvedValue([emp(1, 10, 20)]);
    mockPrisma.trainingRequirement.findMany.mockResolvedValue([trainingReq(101, 10, 20)]);
    mockPrisma.trainingRecords.findMany.mockResolvedValue([{ employeeId: 1, trainingId: 101 }]);

    const result = await requirementsCacheRebuildHandler({});

    expect(result.totalEntries).toBe(0);
    expect(mockPrisma.requirementsCacheEntry.createMany).toHaveBeenCalledWith({ data: [] });
  });

  it("does not create an entry for training the employee is actively exempted from", async () => {
    mockPrisma.employee.findMany.mockResolvedValue([emp(1, 10, 20)]);
    mockPrisma.trainingRequirement.findMany.mockResolvedValue([trainingReq(101, 10, 20)]);
    mockPrisma.trainingTicketExemption.findMany.mockResolvedValue([
      { employeeId: 1, type: "Training", trainingId: 101, ticketId: null },
    ]);

    const result = await requirementsCacheRebuildHandler({});

    expect(result.totalEntries).toBe(0);
  });

  it("does not create an entry for an inactive training", async () => {
    mockPrisma.employee.findMany.mockResolvedValue([emp(1, 10, 20)]);
    mockPrisma.trainingRequirement.findMany.mockResolvedValue([
      { trainingId: 101, departmentId: 10, locationId: 20, training: { isActive: false } },
    ]);

    const result = await requirementsCacheRebuildHandler({});

    expect(result.totalEntries).toBe(0);
  });

  it("matches a wildcard department (-1) to any employee department", async () => {
    mockPrisma.employee.findMany.mockResolvedValue([emp(1, 99, 20)]);
    mockPrisma.trainingRequirement.findMany.mockResolvedValue([trainingReq(101, -1, 20)]);

    const result = await requirementsCacheRebuildHandler({});

    expect(result.totalEntries).toBe(1);
  });

  it("matches a wildcard location (-1) to any employee location", async () => {
    mockPrisma.employee.findMany.mockResolvedValue([emp(1, 10, 99)]);
    mockPrisma.trainingRequirement.findMany.mockResolvedValue([trainingReq(101, 10, -1)]);

    const result = await requirementsCacheRebuildHandler({});

    expect(result.totalEntries).toBe(1);
  });

  it("does not create an entry when the department does not match", async () => {
    mockPrisma.employee.findMany.mockResolvedValue([emp(1, 10, 20)]);
    mockPrisma.trainingRequirement.findMany.mockResolvedValue([trainingReq(101, 99, 20)]);

    const result = await requirementsCacheRebuildHandler({});

    expect(result.totalEntries).toBe(0);
  });

  it("does not create an entry when the location does not match", async () => {
    mockPrisma.employee.findMany.mockResolvedValue([emp(1, 10, 20)]);
    mockPrisma.trainingRequirement.findMany.mockResolvedValue([trainingReq(101, 10, 99)]);

    const result = await requirementsCacheRebuildHandler({});

    expect(result.totalEntries).toBe(0);
  });
});

describe("requirementsCacheRebuildHandler — ticket requirements", () => {
  it("creates a Ticket cache entry for an employee with an unmet ticket requirement", async () => {
    mockPrisma.employee.findMany.mockResolvedValue([emp(1, 10, 20)]);
    mockPrisma.ticketRequirement.findMany.mockResolvedValue([ticketReq(201, 10, 20)]);

    const result = await requirementsCacheRebuildHandler({});

    expect(mockPrisma.requirementsCacheEntry.createMany).toHaveBeenCalledWith({
      data: [{ employeeId: 1, itemType: "Ticket", itemId: 201 }],
    });
    expect(result.totalEntries).toBe(1);
  });

  it("does not create an entry for a ticket the employee already holds", async () => {
    mockPrisma.employee.findMany.mockResolvedValue([emp(1, 10, 20)]);
    mockPrisma.ticketRequirement.findMany.mockResolvedValue([ticketReq(201, 10, 20)]);
    mockPrisma.ticketRecords.findMany.mockResolvedValue([{ employeeId: 1, ticketId: 201 }]);

    const result = await requirementsCacheRebuildHandler({});

    expect(result.totalEntries).toBe(0);
  });

  it("does not create an entry for a ticket the employee is exempted from", async () => {
    mockPrisma.employee.findMany.mockResolvedValue([emp(1, 10, 20)]);
    mockPrisma.ticketRequirement.findMany.mockResolvedValue([ticketReq(201, 10, 20)]);
    mockPrisma.trainingTicketExemption.findMany.mockResolvedValue([
      { employeeId: 1, type: "Ticket", ticketId: 201, trainingId: null },
    ]);

    const result = await requirementsCacheRebuildHandler({});

    expect(result.totalEntries).toBe(0);
  });

  it("does not create an entry for an inactive ticket", async () => {
    mockPrisma.employee.findMany.mockResolvedValue([emp(1, 10, 20)]);
    mockPrisma.ticketRequirement.findMany.mockResolvedValue([
      { ticketId: 201, departmentId: 10, locationId: 20, ticket: { isActive: false } },
    ]);

    const result = await requirementsCacheRebuildHandler({});

    expect(result.totalEntries).toBe(0);
  });
});

describe("requirementsCacheRebuildHandler — multi-employee", () => {
  it("processes multiple employees independently", async () => {
    mockPrisma.employee.findMany.mockResolvedValue([
      emp(1, 10, 20),
      emp(2, 30, 40),
    ]);
    // Requirement only matches employee 1
    mockPrisma.trainingRequirement.findMany.mockResolvedValue([trainingReq(101, 10, 20)]);

    const result = await requirementsCacheRebuildHandler({});

    expect(result.totalEntries).toBe(1);
    expect(result.employeesProcessed).toBe(2);
    const { data } = mockPrisma.requirementsCacheEntry.createMany.mock.calls[0][0];
    expect(data).toEqual([{ employeeId: 1, itemType: "Training", itemId: 101 }]);
  });
});
