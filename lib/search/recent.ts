// Recently opened palette results, kept per user in localStorage so a shared
// PC doesn't show the last person's lookups.
export interface RecentEntry {
  /** Same key the palette uses for the result: "page:/reports", "person:12", "ticket:4". */
  key: string;
  title: string;
  subtitle?: string;
  href: string;
}

const MAX = 8;
const storageKey = (userId: string) => `hrt.search.recent.v1:${userId}`;

export function loadRecent(userId: string): RecentEntry[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((e) => e && typeof e.key === "string")
      : [];
  } catch {
    return [];
  }
}

export function pushRecent(userId: string, entry: RecentEntry): RecentEntry[] {
  const next = [
    entry,
    ...loadRecent(userId).filter((e) => e.key !== entry.key),
  ].slice(0, MAX);
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(next));
  } catch {
    // Storage full or blocked: recents are a nicety, carry on without them.
  }
  return next;
}

export function clearRecent(userId: string) {
  try {
    localStorage.removeItem(storageKey(userId));
  } catch {
    // ignore
  }
}
