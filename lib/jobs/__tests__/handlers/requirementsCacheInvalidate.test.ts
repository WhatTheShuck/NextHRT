import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    employee: { findUnique: vi.fn() },
    training: { findMany: vi.fn() },
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

import { requirementsCacheInvalidateHandler } from "@/lib/jobs/handlers/requirementsCacheInvalidate";

const EMPLOYEE_ID = 42;
const activeEmployee = {
  id: EMPLOYEE_ID,
  departmentId: 10,
  locationId: 20,
  isActive: true,
};

beforeEach(() => {
  mockPrisma.employee.findUnique.mockResolvedValue(activeEmployee);
  mockPrisma.training.findMany.mockResolvedValue([]);
  mockPrisma.trainingRequirement.findMany.mockResolvedValue([]);
  mockPrisma.ticketRequirement.findMany.mockResolvedValue([]);
  mockPrisma.trainingRecords.findMany.mockResolvedValue([]);
  mockPrisma.ticketRecords.findMany.mockResolvedValue([]);
  mockPrisma.trainingTicketExemption.findMany.mockResolvedValue([]);
  mockPrisma.requirementsCacheEntry.deleteMany.mockResolvedValue({ count: 0 });
  mockPrisma.requirementsCacheEntry.createMany.mockResolvedValue({ count: 0 });
  mockPrisma.$transaction.mockResolvedValue([]);
});

describe("requirementsCacheInvalidateHandler — validation", () => {
  it("throws when employeeId is missing from the payload", async () => {
    await expect(requirementsCacheInvalidateHandler({})).rejects.toThrow(
      "missing employeeId",
    );
  });
});

describe("requirementsCacheInvalidateHandler — inactive / missing employee", () => {
  it("clears cache entries and returns { cleared: true } when employee is not found", async () => {
    mockPrisma.employee.findUnique.mockResolvedValue(null);

    const result = await requirementsCacheInvalidateHandler({ employeeId: EMPLOYEE_ID });

    expect(mockPrisma.requirementsCacheEntry.deleteMany).toHaveBeenCalledWith({
      where: { employeeId: EMPLOYEE_ID },
    });
    expect(result).toEqual({ employeeId: EMPLOYEE_ID, cleared: true });
  });

  it("clears cache entries and returns { cleared: true } when employee is inactive", async () => {
    mockPrisma.employee.findUnique.mockResolvedValue({ ...activeEmployee, isActive: false });

    const result = await requirementsCacheInvalidateHandler({ employeeId: EMPLOYEE_ID });

    expect(mockPrisma.requirementsCacheEntry.deleteMany).toHaveBeenCalledWith({
      where: { employeeId: EMPLOYEE_ID },
    });
    expect(result).toEqual({ employeeId: EMPLOYEE_ID, cleared: true });
  });
});

describe("requirementsCacheInvalidateHandler — training requirements", () => {
  it("creates a Training entry for an unmet training requirement", async () => {
    mockPrisma.trainingRequirement.findMany.mockResolvedValue([
      { trainingId: 101, departmentId: 10, locationId: 20, training: { isActive: true } },
    ]);

    const result = await requirementsCacheInvalidateHandler({ employeeId: EMPLOYEE_ID });

    expect(mockPrisma.requirementsCacheEntry.createMany).toHaveBeenCalledWith({
      data: [{ employeeId: EMPLOYEE_ID, itemType: "Training", itemId: 101 }],
    });
    expect(result).toEqual({ employeeId: EMPLOYEE_ID, entries: 1 });
  });

  it("does not create an entry for training the employee has already completed", async () => {
    mockPrisma.trainingRequirement.findMany.mockResolvedValue([
      { trainingId: 101, departmentId: 10, locationId: 20, training: { isActive: true } },
    ]);
    mockPrisma.trainingRecords.findMany.mockResolvedValue([{ trainingId: 101 }]);

    const result = await requirementsCacheInvalidateHandler({ employeeId: EMPLOYEE_ID });

    expect(result).toEqual({ employeeId: EMPLOYEE_ID, entries: 0 });
  });

  it("does not create an entry for training the employee is exempted from", async () => {
    mockPrisma.trainingRequirement.findMany.mockResolvedValue([
      { trainingId: 101, departmentId: 10, locationId: 20, training: { isActive: true } },
    ]);
    mockPrisma.trainingTicketExemption.findMany.mockResolvedValue([
      { type: "Training", trainingId: 101, ticketId: null },
    ]);

    const result = await requirementsCacheInvalidateHandler({ employeeId: EMPLOYEE_ID });

    expect(result).toEqual({ employeeId: EMPLOYEE_ID, entries: 0 });
  });

  it("does not create an entry for an inactive training", async () => {
    mockPrisma.trainingRequirement.findMany.mockResolvedValue([
      { trainingId: 101, departmentId: 10, locationId: 20, training: { isActive: false } },
    ]);

    const result = await requirementsCacheInvalidateHandler({ employeeId: EMPLOYEE_ID });

    expect(result).toEqual({ employeeId: EMPLOYEE_ID, entries: 0 });
  });
});

describe("requirementsCacheInvalidateHandler — ticket requirements", () => {
  it("creates a Ticket entry for an unmet ticket requirement", async () => {
    mockPrisma.ticketRequirement.findMany.mockResolvedValue([
      { ticketId: 201, departmentId: 10, locationId: 20, ticket: { isActive: true } },
    ]);

    const result = await requirementsCacheInvalidateHandler({ employeeId: EMPLOYEE_ID });

    expect(mockPrisma.requirementsCacheEntry.createMany).toHaveBeenCalledWith({
      data: [{ employeeId: EMPLOYEE_ID, itemType: "Ticket", itemId: 201 }],
    });
    expect(result).toEqual({ employeeId: EMPLOYEE_ID, entries: 1 });
  });

  it("does not create an entry for a ticket the employee already holds", async () => {
    mockPrisma.ticketRequirement.findMany.mockResolvedValue([
      { ticketId: 201, departmentId: 10, locationId: 20, ticket: { isActive: true } },
    ]);
    mockPrisma.ticketRecords.findMany.mockResolvedValue([
      { ticketId: 201, expiryDate: new Date("2099-01-01") },
    ]);

    const result = await requirementsCacheInvalidateHandler({ employeeId: EMPLOYEE_ID });

    expect(result).toEqual({ employeeId: EMPLOYEE_ID, entries: 0 });
  });

  it("creates an entry when the only ticket record is expired (spec §5.2)", async () => {
    mockPrisma.ticketRequirement.findMany.mockResolvedValue([
      { ticketId: 201, departmentId: 10, locationId: 20, ticket: { isActive: true } },
    ]);
    mockPrisma.ticketRecords.findMany.mockResolvedValue([
      { ticketId: 201, expiryDate: new Date("2020-01-01") },
    ]);

    await requirementsCacheInvalidateHandler({ employeeId: EMPLOYEE_ID });

    expect(mockPrisma.requirementsCacheEntry.createMany).toHaveBeenCalledWith({
      data: [{ employeeId: EMPLOYEE_ID, itemType: "Ticket", itemId: 201 }],
    });
  });

  it("does not create an entry for a ticket the employee is exempted from", async () => {
    mockPrisma.ticketRequirement.findMany.mockResolvedValue([
      { ticketId: 201, departmentId: 10, locationId: 20, ticket: { isActive: true } },
    ]);
    mockPrisma.trainingTicketExemption.findMany.mockResolvedValue([
      { type: "Ticket", ticketId: 201, trainingId: null },
    ]);

    const result = await requirementsCacheInvalidateHandler({ employeeId: EMPLOYEE_ID });

    expect(result).toEqual({ employeeId: EMPLOYEE_ID, entries: 0 });
  });

  it("does not create an entry for an inactive ticket", async () => {
    mockPrisma.ticketRequirement.findMany.mockResolvedValue([
      { ticketId: 201, departmentId: 10, locationId: 20, ticket: { isActive: false } },
    ]);

    const result = await requirementsCacheInvalidateHandler({ employeeId: EMPLOYEE_ID });

    expect(result).toEqual({ employeeId: EMPLOYEE_ID, entries: 0 });
  });
});

describe("requirementsCacheInvalidateHandler — transaction", () => {
  it("wraps deleteMany and createMany in a transaction", async () => {
    await requirementsCacheInvalidateHandler({ employeeId: EMPLOYEE_ID });

    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
    expect(mockPrisma.requirementsCacheEntry.deleteMany).toHaveBeenCalledWith({
      where: { employeeId: EMPLOYEE_ID },
    });
  });
});

describe("requirementsCacheInvalidateHandler — training revisions", () => {
  const twoRevisions = [
    {
      id: 1,
      effectiveDate: new Date("2020-01-01"),
      createdAt: new Date("2020-01-01"),
      overrideRequiresRetraining: null,
    },
    {
      id: 2,
      effectiveDate: new Date("2024-01-01"),
      createdAt: new Date("2024-01-01"),
      overrideRequiresRetraining: null,
    },
  ];

  beforeEach(() => {
    mockPrisma.trainingRequirement.findMany.mockResolvedValue([
      { trainingId: 101, departmentId: 10, locationId: 20, training: { isActive: true } },
    ]);
  });

  it("creates an entry when revision requires retraining and record has the wrong revisionId", async () => {
    mockPrisma.trainingRecords.findMany.mockResolvedValue([{ trainingId: 101, revisionId: 1 }]);
    mockPrisma.training.findMany.mockResolvedValue([
      { id: 101, requiresRetrainingOnRevision: true, revisions: twoRevisions },
    ]);

    const result = await requirementsCacheInvalidateHandler({ employeeId: EMPLOYEE_ID });

    expect(result).toEqual({ employeeId: EMPLOYEE_ID, entries: 1 });
  });

  it("does not create an entry when record has the current revisionId", async () => {
    mockPrisma.trainingRecords.findMany.mockResolvedValue([{ trainingId: 101, revisionId: 2 }]);
    mockPrisma.training.findMany.mockResolvedValue([
      { id: 101, requiresRetrainingOnRevision: true, revisions: twoRevisions },
    ]);

    const result = await requirementsCacheInvalidateHandler({ employeeId: EMPLOYEE_ID });

    expect(result).toEqual({ employeeId: EMPLOYEE_ID, entries: 0 });
  });

  it("does not create an entry when revisionId is null (safe default)", async () => {
    mockPrisma.trainingRecords.findMany.mockResolvedValue([{ trainingId: 101, revisionId: null }]);
    mockPrisma.training.findMany.mockResolvedValue([
      { id: 101, requiresRetrainingOnRevision: true, revisions: twoRevisions },
    ]);

    const result = await requirementsCacheInvalidateHandler({ employeeId: EMPLOYEE_ID });

    expect(result).toEqual({ employeeId: EMPLOYEE_ID, entries: 0 });
  });
});
