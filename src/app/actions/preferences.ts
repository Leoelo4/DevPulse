"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireViewer } from "@/lib/auth/viewer";
import { PREFS_COOKIE, serializeThresholds, thresholdsInputSchema } from "@/lib/preferences";

export interface ThresholdsFormState {
  status: "idle" | "saved" | "reset" | "error";
  message?: string;
  fieldErrors?: Partial<
    Record<"stalePullRequestDays" | "staleIssueDays" | "releaseOverdueDays", string>
  >;
  /** Echoes submitted values so the form keeps what the user typed when validation fails. */
  values?: Record<string, string>;
}

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Validates and stores metric thresholds. Re-checks the viewer: client UI is never the gatekeeper. */
export async function saveThresholds(
  _previous: ThresholdsFormState,
  formData: FormData,
): Promise<ThresholdsFormState> {
  await requireViewer();

  const submitted = {
    stalePullRequestDays: String(formData.get("stalePullRequestDays") ?? ""),
    staleIssueDays: String(formData.get("staleIssueDays") ?? ""),
    releaseOverdueDays: String(formData.get("releaseOverdueDays") ?? ""),
  };
  const parsed = thresholdsInputSchema.safeParse(submitted);

  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    return {
      status: "error",
      message: "Some values are invalid. Nothing was saved.",
      fieldErrors: {
        stalePullRequestDays: flat.stalePullRequestDays?.[0],
        staleIssueDays: flat.staleIssueDays?.[0],
        releaseOverdueDays: flat.releaseOverdueDays?.[0],
      },
      values: submitted,
    };
  }

  const store = await cookies();
  store.set(PREFS_COOKIE, serializeThresholds(parsed.data), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });
  revalidatePath("/", "layout");
  return { status: "saved", message: "Thresholds saved. Metrics now use the new values." };
}

export async function resetThresholds(): Promise<ThresholdsFormState> {
  await requireViewer();
  const store = await cookies();
  store.delete(PREFS_COOKIE);
  revalidatePath("/", "layout");
  return { status: "reset", message: "Thresholds reset to the defaults." };
}
