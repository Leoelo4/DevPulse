import { NextResponse, type NextRequest } from "next/server";
import { MODE_COOKIE } from "@/lib/auth/constants";

/** Malformed percent-encoding (e.g. `%E0%A4%A`) can never match a real route. */
function hasMalformedEncoding(pathname: string): boolean {
  try {
    decodeURIComponent(pathname);
    return false;
  } catch {
    return true;
  }
}

/**
 * Two cheap checks before a request reaches a page:
 *
 * 1. Malformed URLs get a clean 404 instead of surfacing a framework decoding error as a 500.
 * 2. Optimistic gate: visitors with no demo/session cookie at all are sent straight to the landing
 *    page instead of rendering an app shell for them.
 *
 * Neither is authorization — every page and action re-validates the viewer on the server
 * (see `requireViewer`).
 */
export function proxy(request: NextRequest) {
  if (hasMalformedEncoding(request.nextUrl.pathname)) {
    return NextResponse.rewrite(new URL("/page-not-found", request.url), { status: 404 });
  }
  if (!request.cookies.has(MODE_COOKIE)) {
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
  ],
};
