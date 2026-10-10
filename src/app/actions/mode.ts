"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MODE_COOKIE, MODE_COOKIE_DEMO, MODE_COOKIE_MAX_AGE_SECONDS } from "@/lib/auth/constants";

/** Switches the visitor into demo mode. Safe for anonymous callers: demo data is local and public. */
export async function enterDemoMode() {
  const store = await cookies();
  store.set(MODE_COOKIE, MODE_COOKIE_DEMO, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MODE_COOKIE_MAX_AGE_SECONDS,
  });
  redirect("/overview");
}

/** Leaves demo mode and returns to the landing page. */
export async function exitDemoMode() {
  const store = await cookies();
  store.delete(MODE_COOKIE);
  redirect("/");
}
