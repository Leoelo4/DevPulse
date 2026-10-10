import {
  FolderGit2,
  GitPullRequest,
  LayoutDashboard,
  Rocket,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Every entry maps to a real route; keep this list in sync with `src/app/(app)`. */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/repositories", label: "Repositories", icon: FolderGit2 },
  { href: "/pull-requests", label: "Pull requests", icon: GitPullRequest },
  { href: "/ci-releases", label: "CI & releases", icon: Rocket },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
