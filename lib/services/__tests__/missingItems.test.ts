import { describe, it, expect, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    requirementsCacheEntry: { findMany: vi.fn() },
    ticketRecords: { findMany: vi.fn() },
    trainingRecords: { findMany: vi.fn() },
    ticket: { findMany: vi.fn() },
    training: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { findMissingItems } from "@/lib/services/missingItems";

describe("findMissingItems", () => {
  it("ticket with no record → missing; ticket with only an expired record → not missing; External training → missing/retraining; Internal → skipped", async () => {
    mockPrisma.requirementsCacheEntry.findMany.mockResolvedValue([
      { employeeId: 1, itemType: "Ticket", itemId: 10 },
      { employeeId: 1, itemType: "Ticket", itemId: 11 },
      { employeeId: 1, itemType: "Training", itemId: 20 },
      { employeeId: 1, itemType: "Training", itemId: 21 },
      { employeeId: 1, itemType: "Training", itemId: 22 },
    ]);
    mockPrisma.ticketRecords.findMany.mockResolvedValue([{ employeeId: 1, ticketId: 11 }]); // expired one
    mockPrisma.trainingRecords.findMany.mockResolvedValue([{ employeeId: 1, trainingId: 21 }]);
    mockPrisma.ticket.findMany.mockResolvedValue([{ id: 10, ticketName: "White Card" }, { id: 11, ticketName: "Forklift" }]);
    mockPrisma.training.findMany.mockResolvedValue([
      { id: 20, title: "First Aid", category: "External" },
      { id: 21, title: "Confined Space", category: "External" },
      { id: 22, title: "Induction", category: "Internal" },
    ]);

    const items = await findMissingItems({ isActive: true });

    expect(items).toEqual([
      { employeeId: 1, kind: "Ticket", itemId: 10, itemName: "White Card", reason: "NotProvided" },
      { employeeId: 1, kind: "Training", itemId: 20, itemName: "First Aid", reason: "NotProvided" },
      { employeeId: 1, kind: "Training", itemId: 21, itemName: "Confined Space", reason: "RetrainingRequired" },
    ]);
  });
});
