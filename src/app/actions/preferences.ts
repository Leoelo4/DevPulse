"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { isRefreshMode } from "@/lib/cache/freshness";
import { requireViewer } from "@/lib/auth/viewer";
import { DEFAULT_THRESHOLDS } from "@/lib/metrics/thresholds";
import {
  PREFS_COOKIE,
  parseStoredPreferences,
  serializePreferences,
  thresholdsInputSchema,
  type Preferences,
} from "@/lib/preferences";

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

async function readPreferences(): Promise<Preferences> {
  return parseStoredPreferences((await cookies()).get(PREFS_COOKIE)?.value);
}

async function writePreferences(preferences: Preferences) {
  (await cookies()).set(PREFS_COOKIE, serializePreferences(preferences), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });
  revalidatePath("/", "layout");
}

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

  await writePreferences({ ...(await readPreferences()), thresholds: parsed.data });
  return { status: "saved", message: "Thresholds saved. Metrics now use the new values." };
}

export async function resetThresholds(): Promise<ThresholdsFormState> {
  await requireViewer();
  await writePreferences({ ...(await readPreferences()), thresholds: { ...DEFAULT_THRESHOLDS } });
  return { status: "reset", message: "Thresholds reset to the defaults." };
}

export interface RefreshModeFormState {
  status: "idle" | "saved" | "error";
  message?: string;
}

/** Stores how long live data is cached before GitHub is asked again. */
export async function saveRefreshMode(
  _previous: RefreshModeFormState,
  formData: FormData,
): Promise<RefreshModeFormState> {
  await requireViewer();
  const mode = formData.get("refreshMode");
  if (!isRefreshMode(mode)) {
    return { status: "error", message: "Choose one of the listed refresh modes." };
  }
  await writePreferences({ ...(await readPreferences()), refreshMode: mode });
  return { status: "saved", message: "Refresh mode saved." };
}
