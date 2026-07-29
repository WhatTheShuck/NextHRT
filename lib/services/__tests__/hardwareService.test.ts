// lib/services/__tests__/hardwareService.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    hardwareItem: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    history: {
      create: vi.fn(),
    },
  };
  return { mockPrisma };
});

const { mockAssetCheckout } = vi.hoisted(() => ({
  mockAssetCheckout: { listCategories: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
vi.mock("@/lib/services/assetCheckoutService", () => ({
  assetCheckoutService: mockAssetCheckout,
}));

import { hardwareService } from "@/lib/services/hardwareService";

beforeEach(() => {
  vi.clearAllMocks();
});

function item(id: number, name: string, categoryId: number | null) {
  return {
    id,
    name,
    isActive: true,
    payloadTemplate:
      categoryId === null
        ? null
        : JSON.stringify({ categoryId, categoryName: name }),
  };
}

describe("getAssetCheckoutSuggestions", () => {
  it("classifies each category as linked / linkSuggested / createSuggested", async () => {
    mockAssetCheckout.listCategories.mockResolvedValue([
      { id: 10, name: "Laptops" }, // already mapped by id
      { id: 20, name: "iPad" }, // name matches an unmapped item
      { id: 30, name: "Monitor" }, // no match at all
    ]);
    mockPrisma.hardwareItem.findMany.mockResolvedValue([
      item(1, "Laptop", 10), // mapped to category 10
      item(2, "iPad", null), // unmapped, name matches category 20
    ]);

    const result = await hardwareService.getAssetCheckoutSuggestions();

    expect(result.find((r) => r.category.id === 10)?.status).toBe("linked");

    const link = result.find((r) => r.category.id === 20);
    expect(link?.status).toBe("linkSuggested");
    expect(link?.existingItem).toEqual({ id: 2, name: "iPad" });

    const create = result.find((r) => r.category.id === 30);
    expect(create?.status).toBe("createSuggested");
    expect(create?.existingItem).toBeNull();
    expect(create?.suggestedPayloadTemplate).toBe(
      JSON.stringify({ categoryId: 30, categoryName: "Monitor" }),
    );
  });

  it("treats a malformed payloadTemplate as unmapped", async () => {
    mockAssetCheckout.listCategories.mockResolvedValue([
      { id: 40, name: "Phone" },
    ]);
    mockPrisma.hardwareItem.findMany.mockResolvedValue([
      { id: 3, name: "Phone", isActive: true, payloadTemplate: "{not json" },
    ]);

    const result = await hardwareService.getAssetCheckoutSuggestions();

    // Name still matches, so it's a link suggestion rather than a fresh create.
    expect(result[0].status).toBe("linkSuggested");
    expect(result[0].existingItem).toEqual({ id: 3, name: "Phone" });
  });
});

describe("applyAssetCheckoutSuggestions", () => {
  it("creates and links, collecting per-action failures", async () => {
    // create OK
    mockPrisma.hardwareItem.findUnique.mockImplementation(
      async ({ where }: { where: { id?: number; name?: string } }) => {
        if (where.name === "Monitor") return null; // create: no duplicate
        if (where.name === "Dupe") return { id: 99, name: "Dupe" }; // duplicate
        if (where.id === 2) return item(2, "iPad", null); // link target
        return null;
      },
    );
    mockPrisma.hardwareItem.create.mockResolvedValue(item(50, "Monitor", 30));
    mockPrisma.hardwareItem.update.mockResolvedValue(item(2, "iPad", 20));

    const result = await hardwareService.applyAssetCheckoutSuggestions(
      [
        { type: "create", categoryId: 30, categoryName: "Monitor", name: "Monitor" },
        { type: "link", itemId: 2, categoryId: 20, categoryName: "iPad" },
        { type: "create", categoryId: 99, categoryName: "Dupe", name: "Dupe" },
      ],
      "user-1",
    );

    expect(result.created).toEqual([{ id: 50, name: "Monitor" }]);
    expect(result.linked).toEqual([{ id: 2, name: "iPad" }]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toContain("DUPLICATE_HARDWARE_ITEM");
  });
});
