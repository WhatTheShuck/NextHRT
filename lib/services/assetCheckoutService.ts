import { appSettingService } from "@/lib/services/appSettingService";
import { companyDetails } from "@/lib/data";

/**
 * Client for the AssetCheckout platform's HRT integration API
 * (/api/integrations/hrt/* on the AssetCheckout backend).
 *
 * AssetCheckout fronts Snipe-IT, so this is how HRT mirrors the employee
 * lifecycle into the asset system without holding Snipe credentials:
 *
 *   - onboarding: ensureUser() creates the Snipe identity, then
 *     createDeviceRequest() raises hardware requests for the new hire
 *   - offboarding: getUserAssets() / offboardUser() check their gear back
 *     in and deactivate the Snipe account
 *
 * Base URL comes from the `onboarding.hardwareEndpoint` app setting; the
 * shared secret comes from ASSET_CHECKOUT_API_KEY (must match HRT_API_KEY
 * on the AssetCheckout side).
 */

export interface AssetCheckoutUser {
  id: number;
  name: string;
  email: string | null;
}

export interface EnsureUserInput {
  firstName: string;
  lastName: string;
  email: string;
  jobTitle?: string;
}

export interface DeviceRequestInput {
  userId: number;
  userName: string;
  categoryId: number;
  categoryName: string;
  requestType: "STANDARD" | "NON_STANDARD";
  reason?: string;
  manager?: string;
  managerId: number;
  /** Tablet option: call & text (cellular) capability required. */
  callText?: boolean;
  /** Tablet option: a data SIM is required (site-going employees). */
  needsData?: boolean;
  /**
   * The number decision for a SIM-bearing item: provision a new number,
   * reuse a departing employee's number, or none required.
   */
  numberOption?: "NEW" | "REUSE" | "NONE";
  /** When numberOption is REUSE: the Snipe email whose number is inherited. */
  reuseNumberFromEmail?: string | null;
  /** When numberOption is REUSE: that employee's number (resolved from HRT). */
  reuseNumberPhone?: string | null;
}

export interface AssetCheckoutCategory {
  id: number;
  name: string;
}

export interface AssetCheckoutUserPhone {
  email: string;
  phone: string | null;
  mobile: string | null;
}

export interface AssetCheckoutAsset {
  id: number;
  asset_tag: string;
  name: string;
  serial: string | null;
  model: string | null;
  category: string | null;
}

export interface OffboardResult {
  userId: number;
  checkedIn: AssetCheckoutAsset[];
  failed: { assetId: number; assetTag: string; error: string }[];
  userDeactivated: boolean;
}

const REQUEST_TIMEOUT_MS = 10000;

/**
 * The email address an employee is known by in Snipe-IT. Same construction
 * the onboarding fan-out uses for the manager next-steps email: preferred
 * names over the company domain.
 */
export function buildEmployeeEmail(
  firstName: string,
  lastName: string,
): string {
  const domain = companyDetails.domain_extension;
  return `${firstName.trim().toLowerCase()}.${lastName.trim().toLowerCase()}@${domain}`;
}

export class AssetCheckoutService {
  private async getConfig(): Promise<{ baseUrl: string; apiKey: string }> {
    const apiKey = process.env.ASSET_CHECKOUT_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ASSET_CHECKOUT_API_KEY is not set — cannot call the AssetCheckout integration API",
      );
    }

    const settings = await appSettingService.getSettings();
    const baseUrl = settings["onboarding.hardwareEndpoint"];
    if (!baseUrl) {
      throw new Error(
        "onboarding.hardwareEndpoint app setting is empty — cannot call the AssetCheckout integration API",
      );
    }

    return { baseUrl: baseUrl.replace(/\/$/, ""), apiKey };
  }

  private async request<T>(
    path: string,
    init: { method?: string; body?: unknown } = {},
  ): Promise<T> {
    const { baseUrl, apiKey } = await this.getConfig();
    const url = `${baseUrl}/api/integrations/hrt${path}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(url, {
        method: init.method ?? "GET",
        headers: {
          "X-API-Key": apiKey,
          Accept: "application/json",
          ...(init.body !== undefined
            ? { "Content-Type": "application/json" }
            : {}),
        },
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`AssetCheckout request timed out: ${path}`);
      }
      throw new Error(
        `Failed to reach AssetCheckout at ${baseUrl}: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      clearTimeout(timer);
    }

    const data = (await res.json().catch(() => null)) as
      | (T & { error?: string; message?: string })
      | null;

    if (!res.ok) {
      // AssetCheckout's error middleware responds { success: false, error };
      // its auth middleware responds { success: false, message }.
      throw new Error(
        `AssetCheckout ${init.method ?? "GET"} ${path} failed (${res.status}): ${data?.error ?? data?.message ?? "no error detail"}`,
      );
    }
    if (data === null) {
      throw new Error(`AssetCheckout ${path} returned an unparseable response`);
    }

    return data;
  }

  /**
   * Find-or-create the Snipe user for an employee, keyed on email.
   * Idempotent — safe to call from retryable jobs.
   */
  async ensureUser(input: EnsureUserInput): Promise<AssetCheckoutUser> {
    const data = await this.request<{
      created: boolean;
      user: AssetCheckoutUser;
    }>("/users", { method: "POST", body: input });
    return data.user;
  }

  /** Resolve a Snipe user by email; null if they don't exist. */
  async lookupUserByEmail(email: string): Promise<AssetCheckoutUser | null> {
    try {
      const data = await this.request<{ user: AssetCheckoutUser }>(
        `/users/lookup?email=${encodeURIComponent(email)}`,
      );
      return data.user;
    } catch (err) {
      if (err instanceof Error && err.message.includes("(404)")) {
        return null;
      }
      throw err;
    }
  }

  /**
   * Raise a hardware request in AssetCheckout. It enters the same
   * pending → approved → completed workflow as requests raised in
   * AssetCheckout's own UI.
   */
  async createDeviceRequest(
    input: DeviceRequestInput,
  ): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>("/request", {
      method: "POST",
      body: input,
    });
  }

  /**
   * The asset categories requestable through AssetCheckout — the {id, name}
   * pairs the hardware catalogue maps onto (categoryId). Restricted to the
   * requestable set AssetCheckout admins have whitelisted; categories that
   * aren't requestable are never returned.
   */
  async listCategories(): Promise<AssetCheckoutCategory[]> {
    const data = await this.request<{ categories: AssetCheckoutCategory[] }>(
      "/categories",
    );
    return data.categories;
  }

  /**
   * All Snipe users' phone numbers, keyed by email — the source for HRT's
   * periodic phone sync (SNIPE_PHONE_SYNC). Snipe holds both the landline
   * (`phone`) and mobile (`mobile`) numbers; HRT mirrors them onto Employee
   * records so onboarding can offer "reuse an existing number" (the mobile)
   * without a live lookup. Users may have one, both, or neither.
   */
  async listUserPhones(): Promise<AssetCheckoutUserPhone[]> {
    const data = await this.request<{ users: AssetCheckoutUserPhone[] }>(
      "/users/phones",
    );
    return data.users;
  }

  /** Everything currently checked out to a Snipe user. */
  async getUserAssets(userId: number): Promise<AssetCheckoutAsset[]> {
    const data = await this.request<{ assets: AssetCheckoutAsset[] }>(
      `/users/${userId}/assets`,
    );
    return data.assets;
  }

  /**
   * Exit flow: check in all the user's assets and deactivate their Snipe
   * account. Partial failures are reported in the result's `failed` list,
   * not thrown — callers decide how to surface them.
   */
  async offboardUser(userId: number, note?: string): Promise<OffboardResult> {
    return this.request<OffboardResult>(`/users/${userId}/offboard`, {
      method: "POST",
      body: { note },
    });
  }
}

export const assetCheckoutService = new AssetCheckoutService();
