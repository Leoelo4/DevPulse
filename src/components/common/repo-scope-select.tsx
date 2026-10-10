"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "all";

/** Chooses whether a cross-repository page covers every tracked repository or just one (URL-backed). */
export function RepoScopeSelect({
  repos,
  value,
}: {
  repos: { fullName: string }[];
  /** Currently selected `owner/name`, or `undefined` for all. */
  value: string | undefined;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function onChange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === ALL) params.delete("repo");
    else params.set("repo", next);
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  return (
    <Select value={value ?? ALL} onValueChange={onChange}>
      <SelectTrigger className="w-64" aria-label="Repository scope" aria-busy={pending}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All repositories ({repos.length})</SelectItem>
        {repos.map((repo) => (
          <SelectItem key={repo.fullName} value={repo.fullName}>
            {repo.fullName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
