import { NextResponse, type NextRequest } from "next/server";

/**
 * Light gate: bounce unauthenticated requests off protected paths before they
 * render. This only checks for the presence of a session cookie — the real
 * validation (and RLS scoping) happens in the (app) layout via requireUser().
 */
const PROTECTED = ["/dashboard", "/jobs", "/onboarding"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const needsAuth = PROTECTED.some((p) => pathname.startsWith(p));
  if (needsAuth && !req.cookies.get("ru_session")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/jobs/:path*", "/onboarding/:path*"],
};
