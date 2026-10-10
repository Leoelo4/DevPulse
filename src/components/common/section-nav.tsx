import Link from "next/link";
import { cn } from "@/lib/utils";

export interface SectionNavItem {
  id: string;
  label: string;
  href: string;
}

/** Underlined link navigation between sections of a page. `aria-current` marks the active one. */
export function SectionNav({
  label,
  items,
  active,
}: {
  label: string;
  items: readonly SectionNavItem[];
  active: string;
}) {
  return (
    <nav aria-label={label} className="-mx-1 overflow-x-auto overflow-y-hidden border-b">
      <ul className="flex min-w-max gap-1 px-1">
        {items.map((item) => {
          const isActive = item.id === active;
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "-mb-px inline-block border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
