/**
 * Builds the command palette's search index for one user. Everything returned
 * is already filtered to what they may open: pages by permission, people by
 * the same View scope the employee pages enforce, and the admin catalogue
 * (training, SOPs, tickets, departments, locations) for admins only.
 */
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { UserRole } from "@/generated/prisma_client/client";
import { searchPages } from "@/lib/search/pages";
import type {
  SearchCatalogueItem,
  SearchIndexPayload,
  SearchPerson,
} from "@/lib/search/types";
import { getEmployeeIdsInScope, scopeWhere } from "./employeeScopeService";

async function allowedPermissions(role: string): Promise<Set<string>> {
  const unique = [...new Set(searchPages.map((p) => p.permission))];
  const results = await Promise.all(
    unique.map(async (permission) => {
      const [resource, action] = permission.split(":");
      try {
        const res = await auth.api.userHasPermission({
          body: {
            role: role as UserRole,
            permissions: { [resource]: [action] },
          },
        });
        return res.success ? permission : null;
      } catch {
        return null;
      }
    }),
  );
  return new Set(results.filter((p) => p !== null));
}

async function getPeople(
  userId: string,
  role: string,
): Promise<SearchPerson[]> {
  const scope = await getEmployeeIdsInScope(userId, role, { level: "View" });
  if (scope !== "all" && scope.length === 0) return [];

  const employees = await prisma.employee.findMany({
    where: scopeWhere(scope),
    select: {
      id: true,
      legalFirstName: true,
      legalLastName: true,
      preferredFirstName: true,
      preferredLastName: true,
      title: true,
      isActive: true,
      department: { select: { name: true } },
      location: { select: { name: true } },
    },
    orderBy: [
      { isActive: "desc" },
      { legalLastName: "asc" },
      { legalFirstName: "asc" },
    ],
  });

  return employees.map((e) => {
    const name = `${e.preferredFirstName || e.legalFirstName} ${e.preferredLastName || e.legalLastName}`;
    const legalName = `${e.legalFirstName} ${e.legalLastName}`;
    return {
      id: e.id,
      name,
      legalName: legalName === name ? null : legalName,
      title: e.title,
      department: e.department.name,
      location: e.location.name,
      active: e.isActive,
    };
  });
}

const editorHref = (section: string, query: string) =>
  `/admin/field-editor/${section}?q=${encodeURIComponent(query)}`;

async function getCatalogue(): Promise<SearchCatalogueItem[]> {
  const [trainings, tickets, departments, locations] = await Promise.all([
    prisma.training.findMany({
      select: { id: true, title: true, category: true, isActive: true },
      orderBy: { title: "asc" },
    }),
    prisma.ticket.findMany({
      select: { id: true, ticketCode: true, ticketName: true, isActive: true },
      orderBy: { ticketName: "asc" },
    }),
    prisma.department.findMany({
      select: {
        id: true,
        name: true,
        isActive: true,
        parentDepartment: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.location.findMany({
      select: { id: true, name: true, state: true, isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return [
    ...trainings.map((t): SearchCatalogueItem => {
      const sop = t.category === "SOP";
      return {
        kind: sop ? "sop" : "training",
        id: t.id,
        title: t.title,
        detail: sop ? null : `${t.category} training`,
        href: editorHref(sop ? "sops" : "training", t.title),
        active: t.isActive,
      };
    }),
    ...tickets.map((t): SearchCatalogueItem => ({
      kind: "ticket",
      id: t.id,
      title: t.ticketName,
      detail: t.ticketCode,
      href: editorHref("tickets", t.ticketName),
      active: t.isActive,
    })),
    ...departments.map((d): SearchCatalogueItem => ({
      kind: "department",
      id: d.id,
      title: d.name,
      detail: d.parentDepartment ? `Part of ${d.parentDepartment.name}` : null,
      href: editorHref("departments", d.name),
      active: d.isActive,
    })),
    ...locations.map((l): SearchCatalogueItem => ({
      kind: "location",
      id: l.id,
      title: l.name,
      detail: l.state,
      href: editorHref("locations", l.name),
      active: l.isActive,
    })),
  ];
}

export async function getSearchIndex(
  userId: string,
  role: string,
): Promise<SearchIndexPayload> {
  const [permissions, user] = await Promise.all([
    allowedPermissions(role),
    prisma.user.findUnique({
      where: { id: userId },
      select: { employeeId: true },
    }),
  ]);
  const linked = user?.employeeId != null;
  const allowed = searchPages.filter(
    (p) =>
      permissions.has(p.permission) && (linked || !p.requiresLinkedEmployee),
  );
  const pages = allowed
    .filter(
      (p) =>
        !p.requiresChildPage ||
        allowed.some((c) => c.href.startsWith(`${p.href}/`)),
    )
    .map((p) => p.href);

  // Matches the field editor pages, which gate on the Admin role itself.
  const isAdmin = role === "Admin";
  const [people, catalogue] = await Promise.all([
    getPeople(userId, role),
    isAdmin ? getCatalogue() : Promise.resolve([]),
  ]);

  return { pages, people, catalogue };
}
