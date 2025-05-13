import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const authPageRoutes = ["/auth"];
const protectedRoutes = ["/reports"];
const apiAuthPrefix = "/api/auth";

export default auth((request) => {
  const { nextUrl } = request;
  const isLoggedIn = !!request.auth;
  const path = nextUrl.pathname;
  const isApiAuthRoute = nextUrl.pathname.startsWith(apiAuthPrefix);
  const isProtectedRoute = protectedRoutes.includes(path);
  const isAuthPageRoute = authPageRoutes.includes(path);
  const isPublicPath =
    path === "/auth" ||
    path.startsWith("/api/auth") ||
    path.includes("_next") ||
    path.includes("static");

  if (isApiAuthRoute) {
    return NextResponse.next();
  }

  if (!isPublicPath && !isLoggedIn) {
    return NextResponse.redirect(new URL("/auth", request.nextUrl));
  }

  if (isLoggedIn && isAuthPageRoute) {
    return NextResponse.redirect(new URL("/", request.nextUrl));
  }

  return NextResponse.next();
});

// // Configure which paths the middleware should run on
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
//   // Get the session token
//   const token = await getToken({
//     req: request,
//     secret: process.env.NEXTAUTH_SECRET,
//   });
