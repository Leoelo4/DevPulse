import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { formatInteger } from "@/lib/format";
import { buildRepoHref, type RepoQuery } from "@/lib/repos/query";
import { cn } from "@/lib/utils";

/** Server-rendered pagination: plain links, so it works without JavaScript and is crawlable. */
export function RepoPagination({
  query,
  page,
  pageCount,
  total,
}: {
  query: RepoQuery;
  page: number;
  pageCount: number;
  total: number;
}) {
  const first = (page - 1) * query.size + 1;
  const last = Math.min(page * query.size, total);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground"
    >
      <p aria-live="polite">
        {total === 0
          ? "No repositories"
          : `Showing ${formatInteger(first)}–${formatInteger(last)} of ${formatInteger(total)}`}
      </p>
      {pageCount > 1 ? (
        <div className="flex items-center gap-2">
          <span className="text-xs">
            Page {page} of {pageCount}
          </span>
          <PageLink query={query} target={page - 1} disabled={page <= 1} label="Previous page">
            <ChevronLeft aria-hidden />
          </PageLink>
          <PageLink query={query} target={page + 1} disabled={page >= pageCount} label="Next page">
            <ChevronRight aria-hidden />
          </PageLink>
        </div>
      ) : null}
    </nav>
  );
}

function PageLink({
  query,
  target,
  disabled,
  label,
  children,
}: {
  query: RepoQuery;
  target: number;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const className = cn(buttonVariants({ variant: "outline", size: "icon-sm" }));
  if (disabled) {
    return (
      <span
        aria-disabled="true"
        aria-label={label}
        className={cn(className, "pointer-events-none opacity-50")}
      >
        {children}
      </span>
    );
  }
  return (
    <Link href={buildRepoHref(query, { page: target })} aria-label={label} className={className}>
      {children}
    </Link>
  );
}
