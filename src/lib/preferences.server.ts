import "server-only";
import { cookies } from "next/headers";
import { PREFS_COOKIE, parseStoredPreferences, type Preferences } from "./preferences";

/** The current visitor's preferences (cookie-backed; defaults when unset or invalid). */
export async function getPreferences(): Promise<Preferences> {
  const store = await cookies();
  return parseStoredPreferences(store.get(PREFS_COOKIE)?.value);
}
