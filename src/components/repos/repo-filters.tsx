"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAGE_SIZES } from "@/lib/repos/query";

const HEALTH_OPTIONS = [
  ["all", "Any health"],
  ["healthy", "No concerns"],
  ["needs_attention", "Needs attention"],
  ["at_risk", "At risk"],
  ["insufficient_data", "Not enough data"],
] as const;

const CI_OPTIONS = [
  ["all", "Any CI status"],
  ["passing", "Passing"],
  ["failing", "Failing"],
  ["running", "Running"],
  ["no_runs", "No runs"],
  ["unknown", "Unavailable"],
] as const;

/**
 * Filter bar for the repository explorer. All state lives in the URL, so views are shareable,
 * survive reloads, and work with the browser's back button. Changing any filter resets to page 1.
 */
export function RepoFilters({
  languages,
  initial,
}: {
  languages: string[];
  initial: { q: string; language: string; health: string; ci: string; size: number };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(initial.q);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function update(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "" || value === "all") params.delete(key);
      else params.set(key, value);
    }
    params.delete("page");
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  // Debounce typing so each keystroke doesn't trigger a server render.
  function onSearchChange(value: string) {
    setSearch(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => update({ q: value.trim() }), 250);
  }
  useEffect(() => () => clearTimeout(timer.current), []);

  const hasFilters =
    search !== "" || initial.language !== "all" || initial.health !== "all" || initial.ci !== "all";

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="search"
      aria-label="Filter repositories"
      aria-busy={pending}
    >
      <div className="relative min-w-52 flex-1 sm:max-w-xs">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search repositories…"
          aria-label="Search repositories"
          className="pl-8"
          maxLength={100}
        />
      </div>

      <Select value={initial.language} onValueChange={(value) => update({ language: value })}>
        <SelectTrigger className="w-40" aria-label="Filter by language">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any language</SelectItem>
          {languages.map((language) => (
            <SelectItem key={language} value={language}>
              {language}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={initial.health} onValueChange={(value) => update({ health: value })}>
        <SelectTrigger className="w-44" aria-label="Filter by health">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {HEALTH_OPTIONS.map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={initial.ci} onValueChange={(value) => update({ ci: value })}>
        <SelectTrigger className="w-40" aria-label="Filter by CI status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CI_OPTIONS.map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={String(initial.size)}
        onValueChange={(value) => update({ size: value === "10" ? null : value })}
      >
        <SelectTrigger className="w-32" aria-label="Rows per page">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PAGE_SIZES.map((size) => (
            <SelectItem key={size} value={String(size)}>
              {size} per page
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSearch("");
            update({ q: null, language: null, health: null, ci: null });
          }}
        >
          <X aria-hidden /> Clear filters
        </Button>
      ) : null}
    </div>
  );
}
