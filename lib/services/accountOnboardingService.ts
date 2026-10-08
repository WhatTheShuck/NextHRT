import prisma from "@/lib/prisma";
import { appLink } from "@/lib/appUrl";
import { emailTemplateService } from "./emailTemplateService";
import { mailService } from "./mailService";
import { matchingService } from "./matchingService";
import { escapeHtml } from "@/lib/email-templates/tokens";

const DAY_MS = 24 * 60 * 60 * 1000;
// New sign-ins get a day on the dashboard badge before they reach an email.
const DIGEST_GRACE_MS = DAY_MS;

function formatWaiting(ms: number): string {
  const days = Math.max(1, Math.floor(ms / DAY_MS));
  return `${days} day${days === 1 ? "" : "s"}`;
}

export interface TeamMember {
  employeeId: number;
  name: string;
  title: string;
  department: string;
  /** awaitingLink: an unlinked account matches them — they've likely signed in. */
  state: "linked" | "awaitingLink" | "notSignedIn";
}

export type AccountStatus =
  | { state: "unlinked" }
  | {
      state: "linked";
      employeeId: number;
      firstName: string;
      title: string;
      department: string;
      /** True until the user dismisses the welcome for their current link. */
      showWelcome: boolean;
    };

/**
 * The first-sign-in journey: a new Microsoft account starts with no employee
 * record and so can't see anything; an admin links it; the person is told
 * they're ready. Everything here is best-effort around that link.
 */
export class AccountOnboardingService {
  async getStatus(userId: string): Promise<AccountStatus> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        employeeLinkedAt: true,
        welcomeDismissedAt: true,
        employee: {
          select: {
            id: true,
            legalFirstName: true,
            preferredFirstName: true,
            title: true,
            department: { select: { name: true } },
          },
        },
      },
    });
    if (!user?.employee) return { state: "unlinked" };

    // Links made before employeeLinkedAt existed have no timestamp — those
    // people have been using HRT already and don't need welcoming.
    const showWelcome =
      user.employeeLinkedAt !== null &&
      (user.welcomeDismissedAt === null ||
        user.welcomeDismissedAt < user.employeeLinkedAt);

    return {
      state: "linked",
      employeeId: user.employee.id,
      firstName: user.employee.preferredFirstName ?? user.employee.legalFirstName,
      title: user.employee.title,
      department: user.employee.department.name,
      showWelcome,
    };
  }

  async dismissWelcome(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: { welcomeDismissedAt: new Date() },
    });
  }

  /** Signed-in accounts still waiting for an admin to link them. */
  async countUnlinkedUsers() {
    return prisma.user.count({
      where: {
        employeeId: null,
        // Admins often run without an employee record on purpose.
        NOT: { role: "Admin" },
        OR: [{ banned: null }, { banned: false }],
      },
    });
  }

  /**
   * Weekly digest to admins of everyone still waiting to be linked. Anyone who
   * signed in within the last day is left to the dashboard badge — a person
   * linked that quickly never appears in an email at all. Sends nothing when
   * nobody is waiting.
   */
  async sendWaitingDigest(now = new Date()): Promise<{ waiting: number }> {
    const waiting = await prisma.user.findMany({
      where: {
        employeeId: null,
        NOT: { role: "Admin" },
        OR: [{ banned: null }, { banned: false }],
        createdAt: { lte: new Date(now.getTime() - DIGEST_GRACE_MS) },
      },
      select: { id: true, name: true, email: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    if (waiting.length === 0) return { waiting: 0 };

    const admins = await prisma.user.findMany({
      where: { role: "Admin", email: { not: null } },
      select: { email: true },
    });
    const to = [...new Set(admins.map((a) => a.email!))];
    if (to.length === 0) return { waiting: waiting.length };

    const bestMatch = new Map(
      (await matchingService.getSuggestions()).map((s) => [
        s.user.id,
        s.candidates[0]?.employee,
      ]),
    );

    // Values are escaped here because the row fragment interpolates into HTML.
    const rows = waiting.map((u) => {
      const match = bestMatch.get(u.id);
      return {
        userName: escapeHtml(u.name ?? u.email ?? "Unknown"),
        userEmail: escapeHtml(u.email ?? "no email on account"),
        waitingFor: formatWaiting(now.getTime() - u.createdAt.getTime()),
        suggestedMatch: match
          ? escapeHtml(
              `${match.legalFirstName} ${match.legalLastName} — ${match.title}, ${match.department} (${match.location})`,
            )
          : "",
      };
    });

    const rendered = await emailTemplateService.render("account.waitingDigest", {
      userList: await emailTemplateService.renderList("account.waitingDigest", rows),
      userCount: waiting.length,
      linkUrl: appLink("/admin/permissions?tab=suggestions"),
    });
    // Template switched off in the admin editor — an explicit "don't send this".
    if (!rendered) return { waiting: waiting.length };

    await mailService.send({ to, subject: rendered.subject, html: rendered.body });
    return { waiting: waiting.length };
  }

  /**
   * Who in the departments `userId` manages has an HRT account, so a manager
   * can chase people who haven't signed in. Mirrors the department scope of
   * the employee directory: managed departments, plus the children of any
   * top-level one. `null` when the user manages no departments.
   */
  async getTeamAccountStatus(userId: string): Promise<TeamMember[] | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        employeeId: true,
        managedDepartments: { select: { id: true, level: true } },
      },
    });
    if (!user || user.managedDepartments.length === 0) return null;

    const topLevelIds = user.managedDepartments
      .filter((d) => d.level === 0)
      .map((d) => d.id);
    const children = topLevelIds.length
      ? await prisma.department.findMany({
          where: { parentDepartmentId: { in: topLevelIds } },
          select: { id: true },
        })
      : [];
    const departmentIds = [
      ...user.managedDepartments.map((d) => d.id),
      ...children.map((d) => d.id),
    ];

    const employees = await prisma.employee.findMany({
      where: {
        isActive: true,
        departmentId: { in: departmentIds },
        ...(user.employeeId !== null && { NOT: { id: user.employeeId } }),
      },
      select: {
        id: true,
        legalFirstName: true,
        legalLastName: true,
        preferredFirstName: true,
        preferredLastName: true,
        title: true,
        department: { select: { name: true } },
        User: { select: { id: true } },
      },
    });

    // An unlinked account whose best match is this employee has most likely
    // signed in already — chasing them would be the wrong nudge.
    const awaiting = new Set<number>();
    if (employees.some((e) => !e.User)) {
      for (const s of await matchingService.getSuggestions()) {
        const top = s.candidates[0];
        if (top) awaiting.add(top.employee.id);
      }
    }

    return employees
      .map((e) => ({
        employeeId: e.id,
        name: `${e.preferredFirstName ?? e.legalFirstName} ${e.preferredLastName ?? e.legalLastName}`,
        title: e.title,
        department: e.department.name,
        state: e.User
          ? ("linked" as const)
          : awaiting.has(e.id)
            ? ("awaitingLink" as const)
            : ("notSignedIn" as const),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Emails the person that their account is linked and ready. */
  async notifyUserLinked(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        employee: {
          select: {
            legalFirstName: true,
            legalLastName: true,
            preferredFirstName: true,
            preferredLastName: true,
          },
        },
      },
    });
    if (!user?.email || !user.employee) return;

    const e = user.employee;
    const firstName = e.preferredFirstName ?? e.legalFirstName;
    const rendered = await emailTemplateService.render("account.linked", {
      preferredFirstName: escapeHtml(firstName),
      employeeName: escapeHtml(
        `${firstName} ${e.preferredLastName ?? e.legalLastName}`,
      ),
      linkUrl: appLink("/"),
    });
    if (!rendered) return;

    await mailService.send({
      to: user.email,
      subject: rendered.subject,
      html: rendered.body,
    });
  }
}

export const accountOnboardingService = new AccountOnboardingService();
