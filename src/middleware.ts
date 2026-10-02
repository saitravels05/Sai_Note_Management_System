import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE_NAME = "sai_auth_session";

// Public paths that do not require authentication
const PUBLIC_PATHS = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/unauthorized",
];

function getJwtSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET || "dev-secret-key-change-in-production-1234";
  return new TextEncoder().encode(secret);
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // 1. Bypass static assets, API health, Next.js internal routes, and brand files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/brand/") ||
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/api/health") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // 2. Extract and verify session cookie
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  let isAuthenticated = false;

  if (sessionCookie) {
    try {
      const secret = getJwtSecret();
      await jwtVerify(sessionCookie, secret, { algorithms: ["HS256"] });
      isAuthenticated = true;
    } catch {
      isAuthenticated = false;
    }
  }

  const isPublicPath = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  // 3. Handle root path `/`
  if (pathname === "/") {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 4. If logged in and attempting to access /login, redirect to /dashboard
  if (isAuthenticated && (pathname === "/login" || pathname === "/forgot-password")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // 5. If unauthenticated on a protected path, redirect to /login with sanitized returnTo
  if (!isAuthenticated && !isPublicPath) {
    const returnTo = `${pathname}${search}`;
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/dashboard") {
      loginUrl.searchParams.set("returnTo", returnTo);
    }
    if (sessionCookie) {
      // Had an invalid or expired cookie
      loginUrl.searchParams.set("expired", "1");
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete(SESSION_COOKIE_NAME);
      return response;
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
