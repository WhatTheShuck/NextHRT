import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  // Get the pathname of the request
  const path = request.nextUrl.pathname;

  // Define public paths that don't require authentication
  const isPublicPath =
    path === "/auth" ||
    path.startsWith("/api/auth") ||
    path.includes("_next") ||
    path.includes("static");

  // Get the session token
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // If the path is not public and there's no token, redirect to auth page
  if (!isPublicPath && !token) {
    return NextResponse.redirect(new URL("/auth", request.url));
  }

  // If the user is already logged in and tries to access the auth page,
  // redirect them to the homepage
  if (isPublicPath && token && path === "/auth") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Continue with the request
  return NextResponse.next();
}

// Configure which paths the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};
