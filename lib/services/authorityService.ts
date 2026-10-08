import prisma from "@/lib/prisma";
import {
  approvableBy,
  approversFor,
  buildOrgGraph,
  effectiveRole,
  expiryRecipientsFor,
  lineScope,
  type Approver,
  type AuthorityMode,
  type Grant,
  type OrgGraph,
} from "@/lib/org/authority";
import { appSettingService } from "./appSettingService";

/**
 * Who has authority over whom (docs/workday-org-import-spec.md §9). In "department" mode
 * (the default until switch-over) callers keep their existing department-manager logic; in
 * "lineManager" mode authority comes from reporting lines plus delegated access.
 */

export const AUTHORITY_MODE_KEY = "authority.mode";
const MODE_TTL_MS = 5_000;
let modeCache: { mode: AuthorityMode; at: number } | null = null;

export async function getAuthorityMode(): Promise<AuthorityMode> {
  if (modeCache && Date.now() - modeCache.at < MODE_TTL_MS) return modeCache.mode;
  const row = await prisma.appSetting.findUnique({ where: { key: AUTHORITY_MODE_KEY } });
  const mode: AuthorityMode = row?.value === "lineManager" ? "lineManager" : "department";
  modeCache = { mode, at: Date.now() };
  return mode;
}

export async function setAuthorityMode(mode: AuthorityMode, userId: string): Promise<void> {
  await appSettingService.updateSetting(AUTHORITY_MODE_KEY, mode, userId);
  modeCache = { mode, at: Date.now() };
}

// Every API call resolves a session, and in line-manager mode that needs the tree; a short
// cache keeps that to one load every few seconds rather than several per page.
const ORG_TTL_MS = 5_000;
let orgCache: { value: { graph: OrgGraph; grants: Grant[] }; at: number } | null = null;

/** The active reporting tree and the grants of active people. */
export async function loadOrg(): Promise<{ graph: OrgGraph; grants: Grant[] }> {
  if (orgCache && Date.now() - orgCache.at < ORG_TTL_MS) return orgCache.value;
  const [employees, grants] = await Promise.all([
    prisma.employee.findMany({
      where: { isActive: true },
      select: { id: true, reportsToId: true, departmentId: true },
    }),
    prisma.delegatedAccess.findMany({
      where: { grantee: { isActive: true }, scopeManager: { isActive: true } },
      select: { granteeEmployeeId: true, scopeManagerEmployeeId: true, departmentId: true },
    }),
  ]);
  const value = { graph: buildOrgGraph(employees), grants };
  orgCache = { value, at: Date.now() };
  return value;
}

async function employeeIdOf(userId: string): Promise<number | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { employeeId: true } });
  return user?.employeeId ?? null;
}

/**
 * The employees a user manages through their reporting line and delegated access (not
 * themselves). Null in department mode, so callers fall back to department scoping.
 */
export async function getLineScopeForUser(
  userId: string,
  options: { includeSelf?: boolean } = {},
): Promise<number[] | null> {
  if ((await getAuthorityMode()) !== "lineManager") return null;
  const employeeId = await employeeIdOf(userId);
  if (employeeId === null) return [];
  const { graph, grants } = await loadOrg();
  const ids = [...lineScope(employeeId, graph, grants)];
  return options.includeSelf ? [employeeId, ...ids] : ids;
}

/** The role a session acts with: the stored role, plus manager permissions for anyone with scope. */
export async function resolveSessionRole(userId: string, baseRole: string | null | undefined): Promise<string> {
  const mode = await getAuthorityMode();
  if (mode !== "lineManager" || baseRole === "Admin") return effectiveRole(baseRole, mode, false);
  const scope = await getLineScopeForUser(userId);
  return effectiveRole(baseRole, mode, (scope?.length ?? 0) > 0);
}

/**
 * Whose stage-1 approvals a user can decide, with the manager they act for (null = their own
 * line). Null in department mode.
 */
export async function getApprovableForUser(userId: string): Promise<Map<number, number | null> | null> {
  if ((await getAuthorityMode()) !== "lineManager") return null;
  const employeeId = await employeeIdOf(userId);
  if (employeeId === null) return new Map();
  const { graph, grants } = await loadOrg();
  return approvableBy(employeeId, graph, grants);
}

export async function getApproversFor(employeeId: number): Promise<Approver[]> {
  const { graph, grants } = await loadOrg();
  return approversFor(employeeId, graph, grants);
}

export async function getExpiryRecipientEmployeeIds(employeeId: number): Promise<number[]> {
  const { graph, grants } = await loadOrg();
  return expiryRecipientsFor(employeeId, graph, grants);
}
