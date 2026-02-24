import prisma from "@/lib/prisma";
import { appSettingService } from "./appSettingService";

export interface UserMatchCandidate {
  employee: {
    id: number;
    firstName: string;
    lastName: string;
    title: string;
    department: string;
    location: string;
  };
  score: number;
  breakdown: {
    email?: { score: number };
    nameExact?: { score: number };
    nameFuzzy?: { score: number; similarity: number };
  };
}

export interface UserMatchSuggestion {
  user: {
    id: string;
    name: string | null;
    email: string | null;
  };
  candidates: UserMatchCandidate[];
}

export interface UserCandidateForEmployee {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    role: string | null;
  };
  score: number;
  breakdown: UserMatchCandidate["breakdown"];
}

// Pure TypeScript Levenshtein distance
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

function levenshteinSimilarity(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

// Build a regex from a template like "{firstName}.{lastName}"
function buildEmailRegex(template: string): RegExp | null {
  try {
    const escaped = template.replace(/[.*+?^${}()|[\]\\]/g, (c) => {
      // Keep our placeholder braces un-escaped; we'll replace them next
      if (c === "{" || c === "}") return c;
      return "\\" + c;
    });
    const pattern = escaped
      .replace(/\{firstName\}/g, "([a-z]+)")
      .replace(/\{lastName\}/g, "([a-z]+)");
    return new RegExp(`^${pattern}$`, "i");
  } catch {
    return null;
  }
}

function getTokenOrder(
  template: string,
): { firstIndex: number; lastIndex: number } | null {
  const firstPos = template.indexOf("{firstName}");
  const lastPos = template.indexOf("{lastName}");
  if (firstPos === -1 || lastPos === -1) return null;
  // group 1 is the first token in the template, group 2 is the second
  if (firstPos < lastPos) {
    return { firstIndex: 1, lastIndex: 2 };
  }
  return { firstIndex: 2, lastIndex: 1 };
}

interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  title: string;
  department: { name: string };
  location: { name: string };
}

function scoreEmail(
  userEmail: string | null,
  employee: Employee,
  template: string,
): { score: number } {
  if (!userEmail) return { score: 0 };

  const localPart = userEmail.split("@")[0];
  if (!localPart) return { score: 0 };

  const regex = buildEmailRegex(template);
  if (!regex) return { score: 0 };

  const order = getTokenOrder(template);
  if (!order) return { score: 0 };

  const match = localPart.match(regex);
  if (!match) return { score: 0 };

  const capturedFirst = match[order.firstIndex]?.toLowerCase();
  const capturedLast = match[order.lastIndex]?.toLowerCase();
  const empFirst = employee.firstName.toLowerCase();
  const empLast = employee.lastName.toLowerCase();

  const firstMatches = capturedFirst === empFirst;
  const lastMatches = capturedLast === empLast;

  if (firstMatches && lastMatches) return { score: 100 };
  if (firstMatches || lastMatches) return { score: 50 };
  return { score: 0 };
}

// Strip punctuation and collapse whitespace for exact name comparison.
// Handles formats like "Wright, Brandon" → "wright brandon".
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, " ") // replace punctuation with spaces
    .replace(/\s+/g, " ")     // collapse multiple spaces
    .trim();
}

function scoreNameExact(
  userName: string | null,
  employee: Employee,
): { score: number } {
  if (!userName) return { score: 0 };
  const normalizedUser = normalizeName(userName);
  const forwardName = normalizeName(
    `${employee.firstName} ${employee.lastName}`,
  );
  const reversedName = normalizeName(
    `${employee.lastName} ${employee.firstName}`,
  );
  return {
    score:
      normalizedUser === forwardName || normalizedUser === reversedName
        ? 100
        : 0,
  };
}

function scoreNameFuzzy(
  userName: string | null,
  employee: Employee,
  threshold: number,
): { score: number; similarity: number } {
  if (!userName) return { score: 0, similarity: 0 };
  const normalizedUser = normalizeName(userName);
  const forwardName = normalizeName(`${employee.firstName} ${employee.lastName}`);
  const reversedName = normalizeName(`${employee.lastName} ${employee.firstName}`);
  const similarity = Math.max(
    levenshteinSimilarity(normalizedUser, forwardName),
    levenshteinSimilarity(normalizedUser, reversedName),
  );
  if (similarity >= threshold) {
    return { score: similarity * 100, similarity };
  }
  return { score: 0, similarity };
}

export class MatchingService {
  async getSuggestions(): Promise<UserMatchSuggestion[]> {
    const settings = await appSettingService.getSettings();

    const emailEnabled = settings["matching.email.enabled"] !== "false";
    const emailTemplate =
      settings["matching.email.template"] ?? "{firstName}.{lastName}";
    const nameExactEnabled =
      settings["matching.nameExact.enabled"] !== "false";
    const nameFuzzyEnabled =
      settings["matching.nameFuzzy.enabled"] !== "false";
    const fuzzyThreshold = parseFloat(
      settings["matching.nameFuzzy.threshold"] ?? "0.7",
    );
    const suggestionThreshold = parseFloat(
      settings["matching.suggestionThreshold"] ?? "50",
    );

    // Fetch unlinked users (no employeeId, not banned)
    const users = await prisma.user.findMany({
      where: { employeeId: null, banned: { not: true } },
      select: { id: true, name: true, email: true },
    });

    // Fetch active employees not yet linked to any user
    const linkedEmployeeIds = await prisma.user
      .findMany({
        where: { employeeId: { not: null } },
        select: { employeeId: true },
      })
      .then((rows) => rows.map((r) => r.employeeId as number));

    const employees = await prisma.employee.findMany({
      where: {
        isActive: true,
        id: { notIn: linkedEmployeeIds.length > 0 ? linkedEmployeeIds : [-1] },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        title: true,
        department: { select: { name: true } },
        location: { select: { name: true } },
      },
    });

    const results: UserMatchSuggestion[] = [];

    for (const user of users) {
      const candidates: UserMatchCandidate[] = [];

      for (const emp of employees) {
        const breakdown: UserMatchCandidate["breakdown"] = {};
        const scores: number[] = [];

        if (emailEnabled) {
          const result = scoreEmail(user.email, emp, emailTemplate);
          breakdown.email = result;
          scores.push(result.score);
        }

        if (nameExactEnabled) {
          const result = scoreNameExact(user.name, emp);
          breakdown.nameExact = result;
          scores.push(result.score);
        }

        if (nameFuzzyEnabled) {
          const result = scoreNameFuzzy(user.name, emp, fuzzyThreshold);
          breakdown.nameFuzzy = result;
          scores.push(result.score);
        }

        if (scores.length === 0) continue;

        const combined = Math.max(...scores);
        if (combined >= suggestionThreshold) {
          candidates.push({
            employee: {
              id: emp.id,
              firstName: emp.firstName,
              lastName: emp.lastName,
              title: emp.title,
              department: emp.department.name,
              location: emp.location.name,
            },
            score: combined,
            breakdown,
          });
        }
      }

      if (candidates.length === 0) continue;

      candidates.sort((a, b) => b.score - a.score);

      results.push({
        user: { id: user.id, name: user.name, email: user.email },
        candidates: candidates.slice(0, 3),
      });
    }

    return results;
  }

  async getSuggestionsForEmployee(
    employeeId: number,
  ): Promise<UserCandidateForEmployee[]> {
    const settings = await appSettingService.getSettings();

    const emailEnabled = settings["matching.email.enabled"] !== "false";
    const emailTemplate =
      settings["matching.email.template"] ?? "{firstName}.{lastName}";
    const nameExactEnabled =
      settings["matching.nameExact.enabled"] !== "false";
    const nameFuzzyEnabled =
      settings["matching.nameFuzzy.enabled"] !== "false";
    const fuzzyThreshold = parseFloat(
      settings["matching.nameFuzzy.threshold"] ?? "0.7",
    );
    const suggestionThreshold = parseFloat(
      settings["matching.suggestionThreshold"] ?? "50",
    );

    const emp = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        title: true,
        department: { select: { name: true } },
        location: { select: { name: true } },
      },
    });

    if (!emp) return [];

    // Fetch unlinked users (no employee, not banned)
    const users = await prisma.user.findMany({
      where: { employeeId: null, banned: { not: true } },
      select: { id: true, name: true, email: true, role: true },
    });

    const candidates: UserCandidateForEmployee[] = [];

    for (const user of users) {
      const breakdown: UserMatchCandidate["breakdown"] = {};
      const scores: number[] = [];

      if (emailEnabled) {
        const result = scoreEmail(user.email, emp, emailTemplate);
        breakdown.email = result;
        scores.push(result.score);
      }

      if (nameExactEnabled) {
        const result = scoreNameExact(user.name, emp);
        breakdown.nameExact = result;
        scores.push(result.score);
      }

      if (nameFuzzyEnabled) {
        const result = scoreNameFuzzy(user.name, emp, fuzzyThreshold);
        breakdown.nameFuzzy = result;
        scores.push(result.score);
      }

      if (scores.length === 0) continue;

      const combined = Math.max(...scores);
      if (combined >= suggestionThreshold) {
        candidates.push({
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          },
          score: combined,
          breakdown,
        });
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, 5);
  }
}

export const matchingService = new MatchingService();
