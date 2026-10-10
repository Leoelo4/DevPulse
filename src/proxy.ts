import { NextResponse, type NextRequest } from "next/server";
import { hasMalformedEncoding, hasSignInCookie } from "@/lib/auth/proxy-checks";

/**
 * Two cheap checks before a request reaches a page:
 *
 * 1. Malformed URLs get a clean 404 instead of surfacing a framework decoding error as a 500.
 * 2. Optimistic gate: visitors with neither a demo cookie nor a session cookie are sent straight to
 *    the landing page instead of rendering an app shell for them.
 *
 * Neither is authorization — the presence of a cookie proves nothing. Every page and action
 * re-validates the viewer on the server (see `requireViewer`), so a forged cookie gets no data.
 */
export function proxy(request: NextRequest) {
  if (hasMalformedEncoding(request.nextUrl.pathname)) {
    return NextResponse.rewrite(new URL("/page-not-found", request.url), { status: 404 });
  }
  if (!hasSignInCookie((name) => request.cookies.has(name))) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/overview/:path*",
    "/repositories/:path*",
    "/pull-requests/:path*",
    "/ci-releases/:path*",
    "/settings/:path*",
    "/onboarding/:path*",
  ],
};
