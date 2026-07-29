import prisma from "@/lib/prisma";
import {
  assetCheckoutService,
  AssetCheckoutCategory,
} from "@/lib/services/assetCheckoutService";

export interface GetHardwareItemsOptions {
  activeOnly?: boolean;
}

interface HardwareItemInput {
  name?: string;
  payloadTemplate?: string | null;
  isActive?: boolean;
}

// --- AssetCheckout catalogue sync (suggest → admin confirms → apply) ---

// linked         — an item is already mapped to this category (no action)
// linkSuggested  — an unmapped item's name matches; suggest wiring it up
// createSuggested — nothing matches; suggest a brand-new catalogue item
export type CategorySuggestionStatus =
  | "linked"
  | "linkSuggested"
  | "createSuggested";

export interface HardwareCategorySuggestion {
  category: AssetCheckoutCategory;
  status: CategorySuggestionStatus;
  existingItem: { id: number; name: string } | null;
  suggestedName: string;
  suggestedPayloadTemplate: string;
}

export type ApplyCategoryAction =
  | { type: "create"; categoryId: number; categoryName: string; name: string }
  | { type: "link"; itemId: number; categoryId: number; categoryName: string };

export interface ApplyCategoryResult {
  created: { id: number; name: string }[];
  linked: { id: number; name: string }[];
  errors: { action: ApplyCategoryAction; error: string }[];
}

function buildCategoryTemplate(category: {
  id: number;
  name: string;
}): string {
  return JSON.stringify({
    categoryId: category.id,
    categoryName: category.name,
  });
}

function normaliseName(name: string): string {
  return name.trim().toLowerCase();
}

interface HardwareDefault {
  name: string;
  payloadTemplate: string;
}

// Seed placeholders (spec §5.4). payloadTemplate maps the item onto a
// Snipe-IT asset category for the AssetCheckout integration. categoryId 0
// means "not configured" — the HARDWARE_REQUEST job refuses to run until an
// admin fills in the real Snipe category ID for this deployment.
//
// "Non-standard" is NOT a catalogue item — it's a per-request option
// (requestType STANDARD/NON_STANDARD) captured in the onboarding form and
// carried on each hardware selection. One catalogue item per Snipe category.
const HARDWARE_DEFAULTS: HardwareDefault[] = [
  { name: "Laptop", payloadTemplate: '{"categoryId":0,"categoryName":"Laptop"}' },
  { name: "iPad", payloadTemplate: '{"categoryId":0,"categoryName":"Tablet"}' },
  { name: "Phone", payloadTemplate: '{"categoryId":0,"categoryName":"Phone"}' },
];

// Legacy seed items that modelled "non-standard" as separate catalogue
// entries. Non-standard is now a per-request option, so these are removed on
// ensureDefaults (idempotent — a no-op once gone).
const LEGACY_HARDWARE_NAMES = ["Non-standard laptop", "Non-standard phone"];

export class HardwareService {
  async ensureDefaults(): Promise<void> {
    const upserts = HARDWARE_DEFAULTS.map((h) =>
      prisma.hardwareItem.upsert({
        where: { name: h.name },
        create: { name: h.name, payloadTemplate: h.payloadTemplate },
        update: {}, // never overwrite an admin-edited item
      }),
    );
    await Promise.all(upserts);

    // Drop the legacy "Non-standard X" placeholder items if they still exist.
    await prisma.hardwareItem.deleteMany({
      where: { name: { in: LEGACY_HARDWARE_NAMES } },
    });
  }

  async getHardwareItems(options: GetHardwareItemsOptions = {}) {
    await this.ensureDefaults();
    const { activeOnly } = options;

    return prisma.hardwareItem.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { name: "asc" },
    });
  }

  async getHardwareItemById(id: number) {
    const item = await prisma.hardwareItem.findUnique({ where: { id } });

    if (!item) {
      throw new Error("HARDWARE_ITEM_NOT_FOUND");
    }

    return item;
  }

  async createHardwareItem(data: HardwareItemInput, userId: string) {
    if (!data.name || !data.name.trim()) {
      throw new Error("HARDWARE_ITEM_NAME_REQUIRED");
    }

    const existing = await prisma.hardwareItem.findUnique({
      where: { name: data.name },
    });

    if (existing) {
      throw new Error("DUPLICATE_HARDWARE_ITEM");
    }

    const item = await prisma.hardwareItem.create({
      data: {
        name: data.name,
        payloadTemplate: data.payloadTemplate ?? null,
        isActive: data.isActive ?? true,
      },
    });

    await prisma.history.create({
      data: {
        tableName: "HardwareItem",
        recordId: item.id.toString(),
        action: "CREATE",
        newValues: JSON.stringify(item),
        userId,
      },
    });

    return item;
  }

  async updateHardwareItem(
    id: number,
    data: HardwareItemInput,
    userId: string,
  ) {
    const current = await prisma.hardwareItem.findUnique({ where: { id } });

    if (!current) {
      throw new Error("HARDWARE_ITEM_NOT_FOUND");
    }

    if (data.name && data.name !== current.name) {
      const duplicate = await prisma.hardwareItem.findUnique({
        where: { name: data.name },
      });
      if (duplicate) {
        throw new Error("DUPLICATE_HARDWARE_ITEM");
      }
    }

    const updated = await prisma.hardwareItem.update({
      where: { id },
      data: {
        name: data.name,
        payloadTemplate: data.payloadTemplate ?? null,
        isActive: data.isActive ?? current.isActive,
      },
    });

    await prisma.history.create({
      data: {
        tableName: "HardwareItem",
        recordId: id.toString(),
        action: "UPDATE",
        oldValues: JSON.stringify(current),
        newValues: JSON.stringify(updated),
        userId,
      },
    });

    return updated;
  }

  async deleteHardwareItem(id: number, userId: string) {
    const current = await prisma.hardwareItem.findUnique({ where: { id } });

    if (!current) {
      throw new Error("HARDWARE_ITEM_NOT_FOUND");
    }

    await prisma.$transaction([
      prisma.history.create({
        data: {
          tableName: "HardwareItem",
          recordId: id.toString(),
          action: "DELETE",
          oldValues: JSON.stringify(current),
          userId,
        },
      }),
      prisma.hardwareItem.delete({ where: { id } }),
    ]);

    return { message: "Hardware item deleted successfully" };
  }

  /**
   * Reconcile the AssetCheckout requestable categories against the local
   * hardware catalogue, producing a per-category suggestion for an admin to
   * validate before anything is written. Only requestable categories are
   * considered — unrequestable ones are filtered out by AssetCheckout.
   * Mirrors the user↔employee matcher: we suggest, the admin confirms, then
   * applyAssetCheckoutSuggestions writes.
   */
  async getAssetCheckoutSuggestions(): Promise<HardwareCategorySuggestion[]> {
    const [categories, items] = await Promise.all([
      assetCheckoutService.listCategories(),
      prisma.hardwareItem.findMany(),
    ]);

    // Pull each item's currently-mapped categoryId out of its payloadTemplate.
    const parsed = items.map((item) => {
      let categoryId: number | null = null;
      if (item.payloadTemplate) {
        try {
          const t = JSON.parse(item.payloadTemplate) as { categoryId?: unknown };
          if (typeof t.categoryId === "number" && t.categoryId > 0) {
            categoryId = t.categoryId;
          }
        } catch {
          // Malformed template — treat as unmapped so it can be re-linked.
        }
      }
      return { item, categoryId };
    });

    return categories.map((category): HardwareCategorySuggestion => {
      const template = buildCategoryTemplate(category);

      // 1. Already mapped by categoryId — nothing to do.
      const linked = parsed.find((p) => p.categoryId === category.id);
      if (linked) {
        return {
          category,
          status: "linked",
          existingItem: { id: linked.item.id, name: linked.item.name },
          suggestedName: linked.item.name,
          suggestedPayloadTemplate: template,
        };
      }

      // 2. An unmapped item whose name matches — suggest wiring it up.
      const nameMatch = parsed.find(
        (p) =>
          p.categoryId === null &&
          normaliseName(p.item.name) === normaliseName(category.name),
      );
      if (nameMatch) {
        return {
          category,
          status: "linkSuggested",
          existingItem: { id: nameMatch.item.id, name: nameMatch.item.name },
          suggestedName: nameMatch.item.name,
          suggestedPayloadTemplate: template,
        };
      }

      // 3. Nothing matches — suggest a new catalogue item.
      return {
        category,
        status: "createSuggested",
        existingItem: null,
        suggestedName: category.name,
        suggestedPayloadTemplate: template,
      };
    });
  }

  /**
   * Apply the actions an admin confirmed from getAssetCheckoutSuggestions.
   * Each action is attempted independently; a failure on one (e.g. a
   * duplicate name) is recorded in `errors` rather than aborting the batch.
   */
  async applyAssetCheckoutSuggestions(
    actions: ApplyCategoryAction[],
    userId: string,
  ): Promise<ApplyCategoryResult> {
    const result: ApplyCategoryResult = {
      created: [],
      linked: [],
      errors: [],
    };

    for (const action of actions) {
      try {
        const payloadTemplate = buildCategoryTemplate({
          id: action.categoryId,
          name: action.categoryName,
        });

        if (action.type === "create") {
          const item = await this.createHardwareItem(
            { name: action.name, payloadTemplate, isActive: true },
            userId,
          );
          result.created.push({ id: item.id, name: item.name });
        } else {
          // Link: only re-point the existing item's template; leave its
          // name and active state untouched.
          const item = await this.updateHardwareItem(
            action.itemId,
            { payloadTemplate },
            userId,
          );
          result.linked.push({ id: item.id, name: item.name });
        }
      } catch (err) {
        result.errors.push({
          action,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return result;
  }
}

export const hardwareService = new HardwareService();
