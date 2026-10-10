import { z } from "zod";
import type { RepoRef } from "@/lib/domain/types";

/**
 * Each tracked repository costs roughly 15–20 GitHub requests on a cold load. Capping the
 * selection keeps a full dashboard load comfortably inside the hourly rate limit.
 */
export const MAX_SELECTED_REPOSITORIES = 12;

const NAME_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;

/** GitHub owner/repo segments: letters, digits, `.`, `_`, `-`; never `.` or `..` (path traversal). */
const segment = z
  .string()
  .regex(NAME_PATTERN)
  .refine((value) => value !== "." && value !== "..", "Invalid name");

const repoString = z
  .string()
  .trim()
  .max(201)
  .transform((value, ctx): RepoRef => {
    const [owner, name, ...rest] = value.split("/");
    const parsed = z.tuple([segment, segment]).safeParse([owner, name]);
    if (!parsed.success || rest.length > 0) {
      ctx.addIssue({
        code: "custom",
        message: `"${value.slice(0, 60)}" is not a valid owner/name`,
      });
      return z.NEVER;
    }
    return { owner: parsed.data[0], name: parsed.data[1] };
  });

export type SelectionParseResult = { ok: true; repos: RepoRef[] } | { ok: false; error: string };

/**
 * Validates the repositories a user submitted: every entry must look like `owner/name`, duplicates
 * (case-insensitive, as GitHub names are) collapse to one, and the total is capped. This is input
 * validation only — whether the user can actually *access* each repository is checked separately
 * against GitHub before anything is saved.
 */
export function parseSelection(raw: unknown): SelectionParseResult {
  if (!Array.isArray(raw)) return { ok: false, error: "Select at least one repository." };

  const parsed = z.array(repoString).safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid repository selection." };
  }

  const seen = new Set<string>();
  const repos: RepoRef[] = [];
  for (const repo of parsed.data) {
    const key = `${repo.owner}/${repo.name}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    repos.push(repo);
  }

  if (repos.length === 0) return { ok: false, error: "Select at least one repository." };
  if (repos.length > MAX_SELECTED_REPOSITORIES) {
    return {
      ok: false,
      error: `You can track up to ${MAX_SELECTED_REPOSITORIES} repositories (you selected ${repos.length}). Each one uses part of your GitHub API rate limit.`,
    };
  }
  return { ok: true, repos };
}

export const repoKey = (repo: RepoRef) => `${repo.owner}/${repo.name}`;
