import { Suspense, type ReactNode } from "react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Brand } from "./brand";
import { DemoBanner } from "./demo-banner";
import { MobileNav } from "./mobile-nav";
import { ModeBadge, ModeBadgeFallback } from "./mode-badge";
import { SidebarNav } from "./sidebar-nav";
import { SidebarNavFallback } from "./sidebar-nav-fallback";

/**
 * Static application chrome. It reads no request data at the top level, so it can be prerendered
 * and shown instantly; viewer-dependent pieces stream in behind their own Suspense boundaries.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="hidden border-r border-sidebar-border bg-sidebar lg:block">
        <div className="sticky top-0 flex h-dvh flex-col">
          <div className="flex h-14 items-center border-b border-sidebar-border px-4">
            <Brand href="/overview" />
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <Suspense fallback={<SidebarNavFallback />}>
              <SidebarNav />
            </Suspense>
          </div>
          <div className="border-t border-sidebar-border p-4 text-xs leading-relaxed text-muted-foreground">
            Open source · MIT licensed
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/90 px-4 backdrop-blur sm:px-6">
          <Suspense fallback={null}>
            <MobileNav />
          </Suspense>
          <div className="lg:hidden">
            <Brand href="/overview" className="text-sm" />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Suspense fallback={<ModeBadgeFallback />}>
              <ModeBadge />
            </Suspense>
            <ThemeToggle />
          </div>
        </header>

        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 sm:px-6"
        >
          <Suspense fallback={null}>
            <DemoBanner />
          </Suspense>
          {children}
        </main>
      </div>
    </div>
  );
}
