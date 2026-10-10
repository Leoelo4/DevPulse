import Link from "next/link";
import { NAV_ITEMS } from "./nav-config";

/**
 * Rendered while the client-side active-route highlighting streams in. It carries the same real
 * links, so navigation works (and is in the prerendered HTML) before the highlight appears.
 */
export function SidebarNavFallback() {
  return (
    <nav aria-label="Main">
      <ul className="space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
