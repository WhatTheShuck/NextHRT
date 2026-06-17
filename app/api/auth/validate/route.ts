import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAuth } from "@/lib/api-auth";

// Strips /api/auth suffix that BETTER_AUTH_URL may include in this project.
const appBaseUrl = (
  process.env.BETTER_AUTH_URL ?? "https://hrt.ksb.com.au/api/auth"
)
  .replace(/\/api\/auth\/?$/, "")
  .replace(/\/$/, "") || "https://hrt.ksb.com.au";

function isAllowedHost(hostname: string): boolean {
  return (
    hostname === "ksb.com.au" || hostname.endsWith(".ksb.com.au")
  );
}

function buildRedirectTarget(request: NextRequest): string | null {
  // Prefer an explicit ?redirect= param (useful when Caddy is configured to
  // pass it), then fall back to reconstructing from X-Forwarded-* headers.
  const explicit = request.nextUrl.searchParams.get("redirect");
  if (explicit) {
    try {
      const { protocol, hostname } = new URL(explicit);
      if (protocol === "https:" && isAllowedHost(hostname)) return explicit;
    } catch {
      // fall through
    }
    return null;
  }

  const host = request.headers.get("x-forwarded-host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const uri = request.headers.get("x-forwarded-uri") ?? "/";
  if (host && isAllowedHost(host)) return `${proto}://${host}${uri}`;

  return null;
}

// Called by Caddy's forward_auth on every request to a downstream app.
// Returns 200 + X-User-* headers on a valid session, 401 + Location otherwise.
// No DB writes — session read only.
export async function GET(request: NextRequest) {
  const session = await getAuth(request);

  if (!session) {
    const loginUrl = new URL("/auth", appBaseUrl);
    const redirectTarget = buildRedirectTarget(request);
    if (redirectTarget) loginUrl.searchParams.set("redirect", redirectTarget);

    return new NextResponse(null, {
      status: 302,
      headers: { Location: loginUrl.toString() },
    });
  }

  return new NextResponse(null, {
    status: 200,
    headers: {
      "X-User-Id": session.user.id,
      "X-User-Name": session.user.name,
      "X-User-Email": session.user.email,
      "X-User-Role": session.user.role ?? "User",
    },
  });
}
