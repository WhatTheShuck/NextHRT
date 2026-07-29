/**
 * Canonical public base URL of this app, for links that leave the browser —
 * emails, PDFs, anything a recipient opens later from somewhere else.
 *
 * Never derive these from the incoming request: in the standalone Docker image
 * the server binds HOSTNAME=0.0.0.0 (see Dockerfile), so `request.nextUrl.origin`
 * resolves to http://0.0.0.0:5844 and every emailed link is dead.
 *
 * Resolution order — first non-empty wins:
 *   APP_URL             explicit override
 *   BETTER_AUTH_URL     set in prod to https://hrt.ksb.com.au/api/auth
 *   AUTH_URL            legacy name, still present in some .env files
 * then localhost in development, so locally-sent mail doesn't link to prod.
 */
const FALLBACK = "https://hrt.ksb.com.au";
const DEV_FALLBACK = "http://localhost:3000";

export function getAppUrl(): string {
  const candidate =
    process.env.APP_URL ||
    process.env.BETTER_AUTH_URL ||
    process.env.AUTH_URL ||
    (process.env.NODE_ENV === "development" ? DEV_FALLBACK : FALLBACK);

  const normalised = candidate
    .trim()
    .replace(/\/api\/auth\/?$/, "")
    .replace(/\/$/, "");

  return normalised || FALLBACK;
}

/** Absolute URL for an app-relative path, e.g. appLink("/admin/onboarding/12"). */
export function appLink(path: string): string {
  return `${getAppUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
