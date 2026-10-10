import { ExternalLink as ExternalLinkIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Link to a page on GitHub. Sample data has no GitHub counterpart (`href` is `null`), so the
 * link is rendered as inert, clearly-explained text rather than pointing at an unrelated page.
 */
export function ExternalLink({
  href,
  children,
  className,
  showIcon = true,
}: {
  href: string | null;
  children: ReactNode;
  className?: string;
  showIcon?: boolean;
}) {
  if (href === null) {
    return (
      <span
        className={cn("inline-flex items-center gap-1 text-muted-foreground", className)}
        title="Sample data has no page on GitHub"
      >
        {children}
      </span>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1 underline-offset-4 hover:text-primary hover:underline",
        className,
      )}
    >
      {children}
      {showIcon ? <ExternalLinkIcon className="size-3 shrink-0 opacity-70" aria-hidden /> : null}
      <span className="sr-only">(opens GitHub in a new tab)</span>
    </a>
  );
}
