import { auth } from "@/lib/auth";
import type { NextRequest } from "next/server";

/**
 * Resolves a session from either a cookie-based session or an API key Bearer token.
 *
 * Priority:
 * 1. Cookie session (standard browser auth)
 * 2. Authorization: Bearer <api-key> — the token is treated as an API key and
 *    verified via the x-api-key header mechanism that better-auth's apiKey plugin uses.
 *
 * Returns the session object or null if neither credential is valid.
 */
export async function getAuth(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (session) return session;

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  return auth.api.getSession({
    headers: new Headers({ "x-api-key": token }),
  });
}
