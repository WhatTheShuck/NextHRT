import type { HardwareItem } from "@/generated/prisma_client/client";

/**
 * Hardware request options mirror AssetCheckout's request form, which keys
 * its "asset specific options" off the Snipe *category* (not the display
 * name). A catalogue item shown to managers as "iPad" maps to the Snipe
 * category "Tablet", so option visibility must be decided on the category
 * name carried in the item's payloadTemplate — falling back to the display
 * name when no template is set.
 *
 * Detection rules are kept in lockstep with AssetCheckout's
 * frontend/src/lib/categoryIcon.ts (isPhoneCategory / isTabletCategory).
 */

/** The Snipe category name an item maps to (from payloadTemplate), else its name. */
export function getSnipeCategoryName(
  item: Pick<HardwareItem, "name" | "payloadTemplate">,
): string {
  if (item.payloadTemplate) {
    try {
      const t = JSON.parse(item.payloadTemplate) as { categoryName?: unknown };
      if (typeof t.categoryName === "string" && t.categoryName.trim()) {
        return t.categoryName;
      }
    } catch {
      // Malformed template — fall back to the display name.
    }
  }
  return item.name;
}

export function isPhoneCategory(name: string): boolean {
  const lower = name.toLowerCase();
  if (lower.includes("headphone") || lower.includes("earphone")) return false;
  return ["phone", "mobile", "cell", "iphone"].some((kw) => lower.includes(kw));
}

export function isTabletCategory(name: string): boolean {
  const lower = name.toLowerCase();
  return ["tablet", "ipad"].some((kw) => lower.includes(kw));
}

/**
 * The number decision for a SIM-bearing item. Mirrors AssetCheckout, but
 * "new number" is independent of call/text (a data-only SIM can be a new
 * number). NONE is only valid where a SIM isn't mandatory (phones).
 */
export type HardwareNumberOption = "NEW" | "REUSE" | "NONE";

export interface HardwareItemOptions {
  /** "Call and Text capabilities" — tablets only. */
  showCallText: boolean;
  /** "Needs data" (data SIM) — tablets only; site-going employees. */
  showNeedsData: boolean;
  /** Whether the number choice applies (item has, or can have, a SIM). */
  showNumberOption: boolean;
  /** Whether "No number required" is offered (never when a SIM is mandatory). */
  allowNoNumber: boolean;
}

/**
 * Which asset-specific options an item exposes.
 *
 * - Phones: number choice always, and "no number" is allowed.
 * - Tablets: call/text + needs-data checkboxes; the number choice appears
 *   once the tablet has a SIM (needsData — call/text forces data on, so this
 *   covers both), and "no number" is NOT offered (a SIM needs a number).
 * - Everything else: no options.
 */
export function hardwareItemOptions(
  item: Pick<HardwareItem, "name" | "payloadTemplate">,
  needsDataSelected: boolean,
): HardwareItemOptions {
  const category = getSnipeCategoryName(item);
  const isPhone = isPhoneCategory(category);
  const isTablet = isTabletCategory(category);
  const tabletHasSim = isTablet && needsDataSelected;
  return {
    showCallText: isTablet,
    showNeedsData: isTablet,
    showNumberOption: isPhone || tabletHasSim,
    allowNoNumber: isPhone,
  };
}
