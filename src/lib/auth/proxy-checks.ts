import { MODE_COOKIE, SESSION_COOKIE_PREFIX } from "./constants";

/** Malformed percent-encoding (e.g. `%E0%A4%A`) can never match a real route. */
export function hasMalformedEncoding(pathname: string): boolean {
  try {
    decodeURIComponent(pathname);
    return false;
  } catch {
    return true;
  }
}

/**
 * Whether the request carries *any* sign-in cookie (demo choice or Better Auth session token; the
 * latter gets a `__Secure-` prefix over HTTPS). This is an optimistic hint for the proxy, not
 * proof of anything: the cookie's value is validated server-side before any data is returned.
 */
export function hasSignInCookie(has: (name: string) => boolean): boolean {
  return (
    has(MODE_COOKIE) ||
    has(`${SESSION_COOKIE_PREFIX}.session_token`) ||
    has(`__Secure-${SESSION_COOKIE_PREFIX}.session_token`)
  );
}
