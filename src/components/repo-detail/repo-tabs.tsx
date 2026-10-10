import { SectionNav } from "@/components/common/section-nav";

export const REPO_TABS = [
  { id: "overview", label: "Overview" },
  { id: "pull-requests", label: "Pull requests" },
  { id: "issues", label: "Issues" },
  { id: "ci", label: "CI" },
  { id: "releases", label: "Releases" },
  { id: "contributors", label: "Contributors" },
] as const;

export type RepoTabId = (typeof REPO_TABS)[number]["id"];

export function parseRepoTab(value: string | string[] | undefined): RepoTabId {
  const raw = Array.isArray(value) ? value[0] : value;
  return REPO_TABS.find((tab) => tab.id === raw)?.id ?? "overview";
}

/**
 * Section navigation for a repository. Plain links with `?tab=`, so each section is
 * bookmarkable and server-rendered.
 */
export function RepoTabs({ basePath, active }: { basePath: string; active: RepoTabId }) {
  return (
    <SectionNav
      label="Repository sections"
      active={active}
      items={REPO_TABS.map((tab) => ({
        ...tab,
        href: tab.id === "overview" ? basePath : `${basePath}?tab=${tab.id}`,
      }))}
    />
  );
}
