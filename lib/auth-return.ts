// In-app return path after sign-in, for emailed deep links (spec "Return path after sign-in").
// Kept apart from the Caddy `redirect` param, which only accepts other *.ksb.com.au apps.

/** A path inside this app, or null. Blocks protocol-relative and backslash tricks. */
export function safeReturnPath(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith("/")) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  for (const v of [raw, decoded]) {
    // Browsers strip tab/CR/LF when parsing a Location header, so "/\t/evil.com" becomes
    // "//evil.com"; backslashes are treated as slashes. Refuse both outright.
    if (/[\x00-\x1f\x7f\\]/.test(v) || v.startsWith("//")) return null;
  }
  try {
    if (new URL(raw, "http://x").origin !== "http://x") return null;
  } catch {
    return null;
  }
  return raw;
}

export function buildReturnTo(path: string, searchParams: Record<string, string | string[] | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (typeof v === "string") qs.append(k, v);
    else if (Array.isArray(v)) v.forEach((x) => qs.append(k, x));
  }
  const full = qs.size > 0 ? `${path}?${qs.toString()}` : path;
  return `/auth?returnTo=${encodeURIComponent(full)}`;
}
