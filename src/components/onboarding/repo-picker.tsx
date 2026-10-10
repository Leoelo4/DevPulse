"use client";

import { Lock, Search } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import { saveSelectedRepositories, type SelectionFormState } from "@/app/actions/live";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface PickerRepo {
  fullName: string;
  description: string | null;
  language: string | null;
  isPrivate: boolean;
  isArchived: boolean;
}

const INITIAL: SelectionFormState = { status: "idle" };

/**
 * Repository selection form. The server re-validates everything on submit (format, cap, and that
 * GitHub grants this user access to each repository); the cap and filtering here are conveniences.
 */
export function RepoPicker({
  repos,
  initiallySelected,
  max,
  truncated,
}: {
  repos: PickerRepo[];
  initiallySelected: string[];
  max: number;
  /** True when the viewer has more repositories than were loaded. */
  truncated: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveSelectedRepositories, INITIAL);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initiallySelected.map((name) => name.toLowerCase())),
  );
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return repos;
    return repos.filter((repo) =>
      `${repo.fullName} ${repo.description ?? ""} ${repo.language ?? ""}`
        .toLowerCase()
        .includes(needle),
    );
  }, [repos, query]);

  const atLimit = selected.size >= max;

  function toggle(fullName: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      const key = fullName.toLowerCase();
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  // Selections that are no longer in the loaded list (e.g. access lost) are still submitted so the
  // server can report them, rather than silently dropping them.
  const known = new Set(repos.map((repo) => repo.fullName.toLowerCase()));
  const orphaned = [...selected].filter((name) => !known.has(name));

  return (
    <form action={formAction} className="space-y-4" aria-busy={pending}>
      {state.status === "error" && state.message ? (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Selection not saved</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-52 flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter your repositories…"
            aria-label="Filter your repositories"
            className="pl-8"
          />
        </div>
        <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
          <strong className="font-medium text-foreground">{selected.size}</strong> of {max} selected
          {atLimit ? " — limit reached" : ""}
        </p>
      </div>

      <fieldset className="rounded-lg border">
        <legend className="sr-only">Repositories to track</legend>
        {visible.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No repositories match &ldquo;{query}&rdquo;.
          </p>
        ) : (
          <ul className="max-h-96 divide-y overflow-y-auto">
            {visible.map((repo) => {
              const checked = selected.has(repo.fullName.toLowerCase());
              const id = `repo-${repo.fullName}`;
              return (
                <li key={repo.fullName} className="flex items-start gap-3 px-4 py-3">
                  <Checkbox
                    id={id}
                    checked={checked}
                    disabled={!checked && atLimit}
                    onCheckedChange={(value) => toggle(repo.fullName, value === true)}
                    className="mt-0.5"
                  />
                  <Label
                    htmlFor={id}
                    className="flex-1 cursor-pointer flex-col items-start gap-0.5 font-normal"
                  >
                    <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {repo.fullName}
                      {repo.isPrivate ? (
                        <span className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                          <Lock className="size-3" aria-hidden /> Private
                        </span>
                      ) : null}
                      {repo.isArchived ? (
                        <span className="rounded-md border px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                          Archived
                        </span>
                      ) : null}
                    </span>
                    {repo.description ? (
                      <span className="line-clamp-2 text-xs leading-snug text-muted-foreground">
                        {repo.description}
                      </span>
                    ) : null}
                    {repo.language ? (
                      <span className="text-xs text-muted-foreground">{repo.language}</span>
                    ) : null}
                  </Label>
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>

      {truncated ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          GitHub lists more repositories than DevPulse loads here (the 300 most recently pushed).
          Use the filter to find yours, or narrow what you grant access to.
        </p>
      ) : null}

      {/* The submitted selection (checkbox state lives in React, so mirror it as form fields). */}
      {repos
        .filter((repo) => selected.has(repo.fullName.toLowerCase()))
        .map((repo) => (
          <input key={repo.fullName} type="hidden" name="repos" value={repo.fullName} />
        ))}
      {orphaned.map((name) => (
        <input key={name} type="hidden" name="repos" value={name} />
      ))}

      <Button type="submit" disabled={pending || selected.size === 0}>
        {pending ? "Saving…" : "Save and open dashboard"}
      </Button>
    </form>
  );
}
