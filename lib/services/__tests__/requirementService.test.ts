import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    appSetting: { findUnique: vi.fn() },
    training: { findMany: vi.fn(), findUnique: vi.fn() },
    ticket: { findUnique: vi.fn() },
    employee: { findMany: vi.fn(), findUnique: vi.fn() },
    trainingRequirement: { findMany: vi.fn() },
    ticketRequirement: { findMany: vi.fn() },
    trainingRecords: { findMany: vi.fn() },
    ticketRecords: { findMany: vi.fn() },
    trainingTicketExemption: { findMany: vi.fn() },
    onboardingRequest: { findMany: vi.fn() },
  };
  return { mockPrisma };
});

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
vi.mock("@/lib/auth", () => ({ auth: { api: { userHasPermission: vi.fn() } } }));
vi.mock("@/lib/apiRBAC", () => ({ getChildDepartmentIds: vi.fn() }));

import { requirementService } from "@/lib/services/requirementService";
import { auth } from "../../auth";

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no revisions — preserves backward-compat behaviour in all existing tests.
  mockPrisma.training.findMany.mockResolvedValue([]);
});

function mockAdminViewAll() {
  vi.mocked(auth.api.userHasPermission).mockResolvedValue({ success: true } as any);
}

function mockCuratedIds(ids: number[]) {
  mockPrisma.appSetting.findUnique.mockResolvedValue(
    ids.length === 0 ? { value: "[]" } : { value: JSON.stringify(ids) },
  );
}

function mockTrainings(trainings: { id: number; title: string }[]) {
  // Once for the curated-courses fetch; the revision fetch falls through to the beforeEach default ([]).
  mockPrisma.training.findMany.mockResolvedValueOnce(trainings);
}

function mockStandardEmptyRelations() {
  mockPrisma.trainingRecords.findMany.mockResolvedValue([]);
  mockPrisma.trainingTicketExemption.findMany.mockResolvedValue([]);
  mockPrisma.onboardingRequest.findMany.mockResolvedValue([]);
}

describe("requirementService.getDeliveredTrainingTracker", () => {
  it("returns empty result when AppSetting is missing", async () => {
    mockPrisma.appSetting.findUnique.mockResolvedValue(null);

    const result = await requirementService.getDeliveredTrainingTracker("u1", "Admin");

    expect(result).toEqual({ courses: [], rows: [] });
    expect(mockPrisma.training.findMany).not.toHaveBeenCalled();
  });

  it("returns empty result when curated list is empty array", async () => {
    mockCuratedIds([]);

    const result = await requirementService.getDeliveredTrainingTracker("u1", "Admin");

    expect(result).toEqual({ courses: [], rows: [] });
    expect(mockPrisma.training.findMany).not.toHaveBeenCalled();
  });

  it("returns empty result when all curated trainings are inactive", async () => {
    mockAdminViewAll();
    mockCuratedIds([10]);
    mockTrainings([]); // DB returns no active training for id 10

    const result = await requirementService.getDeliveredTrainingTracker("u1", "Admin");

    expect(result).toEqual({ courses: [], rows: [] });
  });

  it("classifies outstanding when course is required but not completed", async () => {
    mockAdminViewAll();
    mockCuratedIds([10]);
    mockTrainings([{ id: 10, title: "Fire Safety" }]);
    mockPrisma.employee.findMany.mockResolvedValue([
      { id: 1, legalFirstName: "Jane", legalLastName: "Smith", departmentId: 2, locationId: 3 },
    ]);
    mockPrisma.trainingRequirement.findMany.mockResolvedValue([
      { trainingId: 10, departmentId: -1, locationId: -1 },
    ]);
    mockStandardEmptyRelations();

    const result = await requirementService.getDeliveredTrainingTracker("u1", "Admin");

    expect(result.courses).toEqual([{ id: 10, title: "Fire Safety" }]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].cells[0]).toEqual({ trainingId: 10, status: "outstanding" });
  });

  it("excludes employees whose only curated course is done", async () => {
    mockAdminViewAll();
    mockCuratedIds([10]);
    mockTrainings([{ id: 10, title: "Fire Safety" }]);
    mockPrisma.employee.findMany.mockResolvedValue([
      { id: 1, legalFirstName: "Jane", legalLastName: "Smith", departmentId: 2, locationId: 3 },
    ]);
    mockPrisma.trainingRequirement.findMany.mockResolvedValue([
      { trainingId: 10, departmentId: -1, locationId: -1 },
    ]);
    mockPrisma.trainingRecords.findMany.mockResolvedValue([
      { employeeId: 1, trainingId: 10 },
    ]);
    mockPrisma.trainingTicketExemption.findMany.mockResolvedValue([]);
    mockPrisma.onboardingRequest.findMany.mockResolvedValue([]);

    const result = await requirementService.getDeliveredTrainingTracker("u1", "Admin");

    expect(result.rows).toHaveLength(0);
  });

  it("classifies done even when course is not formally required (completion wins over na)", async () => {
    mockAdminViewAll();
    mockCuratedIds([10]);
    mockTrainings([{ id: 10, title: "Fire Safety" }]);
    mockPrisma.employee.findMany.mockResolvedValue([
      { id: 1, legalFirstName: "Jane", legalLastName: "Smith", departmentId: 2, locationId: 3 },
    ]);
    mockPrisma.trainingRequirement.findMany.mockResolvedValue([]); // no requirement
    mockPrisma.trainingRecords.findMany.mockResolvedValue([
      { employeeId: 1, trainingId: 10 }, // but completed voluntarily
    ]);
    mockPrisma.trainingTicketExemption.findMany.mockResolvedValue([]);
    mockPrisma.onboardingRequest.findMany.mockResolvedValue([]);

    const result = await requirementService.getDeliveredTrainingTracker("u1", "Admin");

    // done cell + no outstanding → excluded from rows
    expect(result.rows).toHaveLength(0);
  });

  it("classifies na when course is not required and not completed", async () => {
    mockAdminViewAll();
    mockCuratedIds([10, 11]);
    mockTrainings([
      { id: 10, title: "Fire Safety" },
      { id: 11, title: "Manual Handling" },
    ]);
    mockPrisma.employee.findMany.mockResolvedValue([
      { id: 1, legalFirstName: "Jane", legalLastName: "Smith", departmentId: 2, locationId: 3 },
    ]);
    mockPrisma.trainingRequirement.findMany.mockResolvedValue([
      { trainingId: 10, departmentId: -1, locationId: -1 }, // only 10 required
    ]);
    mockStandardEmptyRelations();

    const result = await requirementService.getDeliveredTrainingTracker("u1", "Admin");

    expect(result.rows).toHaveLength(1);
    const cell11 = result.rows[0].cells.find((c) => c.trainingId === 11);
    expect(cell11?.status).toBe("na");
  });

  it("classifies na when employee has an active exemption", async () => {
    mockAdminViewAll();
    mockCuratedIds([10, 11]);
    mockTrainings([
      { id: 10, title: "Fire Safety" },
      { id: 11, title: "Manual Handling" },
    ]);
    mockPrisma.employee.findMany.mockResolvedValue([
      { id: 1, legalFirstName: "Jane", legalLastName: "Smith", departmentId: 2, locationId: 3 },
    ]);
    mockPrisma.trainingRequirement.findMany.mockResolvedValue([
      { trainingId: 10, departmentId: -1, locationId: -1 },
      { trainingId: 11, departmentId: -1, locationId: -1 },
    ]);
    mockPrisma.trainingRecords.findMany.mockResolvedValue([]);
    mockPrisma.trainingTicketExemption.findMany.mockResolvedValue([
      { employeeId: 1, trainingId: 11 }, // exempted from 11
    ]);
    mockPrisma.onboardingRequest.findMany.mockResolvedValue([]);

    const result = await requirementService.getDeliveredTrainingTracker("u1", "Admin");

    expect(result.rows).toHaveLength(1);
    const cell11 = result.rows[0].cells.find((c) => c.trainingId === 11);
    expect(cell11?.status).toBe("na");
  });

  it("wildcard (-1) dept and loc requirements match any employee", async () => {
    mockAdminViewAll();
    mockCuratedIds([10]);
    mockTrainings([{ id: 10, title: "Fire Safety" }]);
    mockPrisma.employee.findMany.mockResolvedValue([
      { id: 1, legalFirstName: "Bob", legalLastName: "Jones", departmentId: 99, locationId: 88 },
    ]);
    mockPrisma.trainingRequirement.findMany.mockResolvedValue([
      { trainingId: 10, departmentId: -1, locationId: -1 },
    ]);
    mockStandardEmptyRelations();

    const result = await requirementService.getDeliveredTrainingTracker("u1", "Admin");

    expect(result.rows[0].cells[0].status).toBe("outstanding");
  });

  it("flags isNewStarter for employees from approved OnboardingRequests", async () => {
    mockAdminViewAll();
    mockCuratedIds([10]);
    mockTrainings([{ id: 10, title: "Fire Safety" }]);
    mockPrisma.employee.findMany.mockResolvedValue([
      { id: 1, legalFirstName: "New", legalLastName: "Hire", departmentId: 2, locationId: 3 },
      { id: 2, legalFirstName: "Existing", legalLastName: "Emp", departmentId: 2, locationId: 3 },
    ]);
    mockPrisma.trainingRequirement.findMany.mockResolvedValue([
      { trainingId: 10, departmentId: -1, locationId: -1 },
    ]);
    mockPrisma.trainingRecords.findMany.mockResolvedValue([]);
    mockPrisma.trainingTicketExemption.findMany.mockResolvedValue([]);
    mockPrisma.onboardingRequest.findMany.mockResolvedValue([
      { createdEmployeeId: 1 },
    ]);

    const result = await requirementService.getDeliveredTrainingTracker("u1", "Admin");

    const newHire = result.rows.find((r) => r.employee.id === 1);
    const existing = result.rows.find((r) => r.employee.id === 2);
    expect(newHire?.isNewStarter).toBe(true);
    expect(existing?.isNewStarter).toBe(false);
  });

  it("sorts new starters before non-starters, then alphabetically by last name", async () => {
    mockAdminViewAll();
    mockCuratedIds([10]);
    mockTrainings([{ id: 10, title: "Fire Safety" }]);
    mockPrisma.employee.findMany.mockResolvedValue([
      { id: 3, legalFirstName: "Alice", legalLastName: "Anderson", departmentId: 2, locationId: 3 },
      { id: 1, legalFirstName: "New", legalLastName: "Hire", departmentId: 2, locationId: 3 },
      { id: 2, legalFirstName: "Charlie", legalLastName: "Brown", departmentId: 2, locationId: 3 },
    ]);
    mockPrisma.trainingRequirement.findMany.mockResolvedValue([
      { trainingId: 10, departmentId: -1, locationId: -1 },
    ]);
    mockPrisma.trainingRecords.findMany.mockResolvedValue([]);
    mockPrisma.trainingTicketExemption.findMany.mockResolvedValue([]);
    mockPrisma.onboardingRequest.findMany.mockResolvedValue([
      { createdEmployeeId: 1 },
    ]);

    const result = await requirementService.getDeliveredTrainingTracker("u1", "Admin");

    expect(result.rows[0].employee.id).toBe(1); // new starter first
    expect(result.rows[1].employee.id).toBe(3); // Anderson before Brown
    expect(result.rows[2].employee.id).toBe(2);
  });
});

describe("requirementService.getEmployeeRequirements ticket expiry", () => {
  it("counts an expired ticket record as NOT completed", async () => {
    mockPrisma.employee.findUnique.mockResolvedValue({ id: 1, departmentId: 5, locationId: 7 });
    mockPrisma.trainingRequirement.findMany.mockResolvedValue([]);
    mockPrisma.ticketRequirement.findMany.mockResolvedValue([
      { ticketId: 100, departmentId: 5, locationId: 7, ticket: { ticketName: "WHS" }, department: {}, location: {} },
    ]);
    mockPrisma.trainingTicketExemption.findMany.mockResolvedValue([]);
    mockPrisma.trainingRecords.findMany.mockResolvedValue([]);
    mockPrisma.ticketRecords.findMany.mockResolvedValue([
      { ticketId: 100, expiryDate: new Date("2020-01-01") },
    ]);

    const result = await requirementService.getEmployeeRequirements(1);

    expect(result.ticketRequired.map((r: any) => r.ticketId)).toContain(100);
  });

  it("counts a future-dated ticket record as completed", async () => {
    mockPrisma.employee.findUnique.mockResolvedValue({ id: 1, departmentId: 5, locationId: 7 });
    mockPrisma.trainingRequirement.findMany.mockResolvedValue([]);
    mockPrisma.ticketRequirement.findMany.mockResolvedValue([
      { ticketId: 100, departmentId: 5, locationId: 7, ticket: { ticketName: "WHS" }, department: {}, location: {} },
    ]);
    mockPrisma.trainingTicketExemption.findMany.mockResolvedValue([]);
    mockPrisma.trainingRecords.findMany.mockResolvedValue([]);
    mockPrisma.ticketRecords.findMany.mockResolvedValue([
      { ticketId: 100, expiryDate: new Date("2099-01-01") },
    ]);

    const result = await requirementService.getEmployeeRequirements(1);

    expect(result.ticketRequired.map((r: any) => r.ticketId)).not.toContain(100);
  });
});

describe("requirementService.getTicketRequirements ticket expiry", () => {
  it("marks an employee with only an expired record as Required, not Completed", async () => {
    mockAdminViewAll();
    mockPrisma.ticket.findUnique.mockResolvedValue({ id: 100, ticketName: "WHS" });
    mockPrisma.ticketRequirement.findMany.mockResolvedValue([
      { ticketId: 100, departmentId: -1, locationId: -1, department: {}, location: {} },
    ]);
    mockPrisma.employee.findMany.mockResolvedValue([
      { id: 1, legalFirstName: "A", legalLastName: "B", departmentId: 5, locationId: 7, department: {}, location: {} },
    ]);
    mockPrisma.ticketRecords.findMany.mockResolvedValue([
      { employeeId: 1, ticketId: 100, expiryDate: new Date("2020-01-01") },
    ]);
    mockPrisma.trainingTicketExemption.findMany.mockResolvedValue([]);

    const result = await requirementService.getTicketRequirements(100, "u1", "Admin");

    expect(result.employees[0].requirementStatus).toBe("Required");
  });
});

describe("requirementService.getAllIncompleteTicketRequirements ticket expiry", () => {
  it("lists an employee whose required ticket has only an expired record", async () => {
    mockAdminViewAll();
    mockPrisma.ticketRequirement.findMany.mockResolvedValue([
      { ticketId: 100, departmentId: -1, locationId: -1, ticket: { ticketName: "WHS" }, department: {}, location: {} },
    ]);
    mockPrisma.employee.findMany.mockResolvedValue([
      { id: 1, legalFirstName: "A", legalLastName: "B", departmentId: 5, locationId: 7, department: {}, location: {} },
    ]);
    mockPrisma.ticketRecords.findMany.mockResolvedValue([
      { employeeId: 1, ticketId: 100, expiryDate: new Date("2020-01-01") },
    ]);
    mockPrisma.trainingTicketExemption.findMany.mockResolvedValue([]);

    const result = await requirementService.getAllIncompleteTicketRequirements("u1", "Admin");

    expect(result.uniqueEmployees).toBe(1);
  });
});

// ─── Training revision compliance ─────────────────────────────────────────

const twoRevisions = [
  { id: 1, effectiveDate: new Date("2020-01-01"), createdAt: new Date("2020-01-01"), overrideRequiresRetraining: null },
  { id: 2, effectiveDate: new Date("2024-01-01"), createdAt: new Date("2024-01-01"), overrideRequiresRetraining: null },
];

describe("requirementService.getEmployeeRequirements training revisions", () => {
  it("treats an old-revision record as NOT completed when the current revision requires retraining", async () => {
    mockPrisma.employee.findUnique.mockResolvedValue({ id: 1, departmentId: 5, locationId: 7 });
    mockPrisma.trainingRequirement.findMany.mockResolvedValue([
      { trainingId: 100, departmentId: 5, locationId: 7, training: { title: "Handbook" }, department: {}, location: {} },
    ]);
    mockPrisma.ticketRequirement.findMany.mockResolvedValue([]);
    mockPrisma.trainingTicketExemption.findMany.mockResolvedValue([]);
    mockPrisma.ticketRecords.findMany.mockResolvedValue([]);
    mockPrisma.trainingRecords.findMany.mockResolvedValue([
      { trainingId: 100, revisionId: 1 }, // holds OLD revision
    ]);
    mockPrisma.training.findMany.mockResolvedValue([
      { id: 100, requiresRetrainingOnRevision: true, revisions: twoRevisions },
    ]);

    const result = await requirementService.getEmployeeRequirements(1);
    expect(result.trainingRequired.map((r: any) => r.trainingId)).toContain(100);
  });

  it("treats a null-revisionId record as satisfied even when retraining is required (safe default)", async () => {
    mockPrisma.employee.findUnique.mockResolvedValue({ id: 1, departmentId: 5, locationId: 7 });
    mockPrisma.trainingRequirement.findMany.mockResolvedValue([
      { trainingId: 100, departmentId: 5, locationId: 7, training: { title: "Handbook" }, department: {}, location: {} },
    ]);
    mockPrisma.ticketRequirement.findMany.mockResolvedValue([]);
    mockPrisma.trainingTicketExemption.findMany.mockResolvedValue([]);
    mockPrisma.ticketRecords.findMany.mockResolvedValue([]);
    mockPrisma.trainingRecords.findMany.mockResolvedValue([
      { trainingId: 100, revisionId: null }, // pre-feature record
    ]);
    mockPrisma.training.findMany.mockResolvedValue([
      { id: 100, requiresRetrainingOnRevision: true, revisions: twoRevisions },
    ]);

    const result = await requirementService.getEmployeeRequirements(1);
    expect(result.trainingRequired.map((r: any) => r.trainingId)).not.toContain(100);
  });

  it("training with no revisions: any record satisfies (backward compat)", async () => {
    mockPrisma.employee.findUnique.mockResolvedValue({ id: 1, departmentId: 5, locationId: 7 });
    mockPrisma.trainingRequirement.findMany.mockResolvedValue([
      { trainingId: 100, departmentId: 5, locationId: 7, training: { title: "Handbook" }, department: {}, location: {} },
    ]);
    mockPrisma.ticketRequirement.findMany.mockResolvedValue([]);
    mockPrisma.trainingTicketExemption.findMany.mockResolvedValue([]);
    mockPrisma.ticketRecords.findMany.mockResolvedValue([]);
    mockPrisma.trainingRecords.findMany.mockResolvedValue([
      { trainingId: 100, revisionId: null },
    ]);
    // training.findMany returns [] via beforeEach default — no revisions → any record satisfies

    const result = await requirementService.getEmployeeRequirements(1);
    expect(result.trainingRequired.map((r: any) => r.trainingId)).not.toContain(100);
  });
});

describe("requirementService.getTrainingRequirements training revisions", () => {
  it("marks an employee holding only the old revision as Required when current requires retraining", async () => {
    mockAdminViewAll();
    mockPrisma.training.findUnique.mockResolvedValue({ id: 100, title: "Handbook" });
    mockPrisma.trainingRequirement.findMany.mockResolvedValue([
      { trainingId: 100, departmentId: -1, locationId: -1, department: {}, location: {} },
    ]);
    mockPrisma.employee.findMany.mockResolvedValue([
      { id: 1, legalFirstName: "A", legalLastName: "B", departmentId: 5, locationId: 7, department: {}, location: {} },
    ]);
    mockPrisma.trainingRecords.findMany.mockResolvedValue([
      { employeeId: 1, trainingId: 100, revisionId: 1 }, // old revision
    ]);
    mockPrisma.training.findMany.mockResolvedValue([
      { id: 100, requiresRetrainingOnRevision: true, revisions: twoRevisions },
    ]);
    mockPrisma.trainingTicketExemption.findMany.mockResolvedValue([]);

    const result = await requirementService.getTrainingRequirements(100, "u1", "Admin");
    expect(result.employees[0].requirementStatus).toBe("Required");
  });
});

describe("requirementService.getAllIncompleteTrainingRequirements training revisions", () => {
  it("lists an employee whose only record is an outdated retraining-flagged revision", async () => {
    mockAdminViewAll();
    mockPrisma.trainingRequirement.findMany.mockResolvedValue([
      { trainingId: 100, departmentId: -1, locationId: -1, training: { title: "Handbook" }, department: {}, location: {} },
    ]);
    mockPrisma.employee.findMany.mockResolvedValue([
      { id: 1, legalFirstName: "A", legalLastName: "B", departmentId: 5, locationId: 7, department: {}, location: {} },
    ]);
    mockPrisma.trainingRecords.findMany.mockResolvedValue([
      { employeeId: 1, trainingId: 100, revisionId: 1 },
    ]);
    mockPrisma.training.findMany.mockResolvedValue([
      { id: 100, requiresRetrainingOnRevision: true, revisions: twoRevisions },
    ]);
    mockPrisma.trainingTicketExemption.findMany.mockResolvedValue([]);

    const result = await requirementService.getAllIncompleteTrainingRequirements("u1", "Admin");
    expect(result.uniqueEmployees).toBe(1);
  });
});
