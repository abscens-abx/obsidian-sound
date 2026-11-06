import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Wordmark } from "./Wordmark";
import { MiniPlayer } from "./MiniPlayer";
import { libraryNav, mobileNav, primaryNav, utilityNav } from "./nav-items";

function SideLink({ to, label, icon: Icon }: { to: string; label: string; icon: LucideIcon }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: true }}
      activeProps={{ "aria-current": "page" }}
      className="group flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-platinum data-[status=active]:bg-graphite data-[status=active]:text-platinum"
    >
      <Icon className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
      {label}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-platinum px-3 py-2 text-obsidian focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-hairline bg-sidebar px-4 py-6 md:flex">
        <Link to="/" aria-label="LAWLIET home" className="mb-10 flex min-h-11 items-center px-3">
          <Wordmark />
        </Link>
        <nav aria-label="Primary" className="flex flex-col gap-1">
          {primaryNav.map((i) => (
            <SideLink key={i.to} {...i} />
          ))}
        </nav>
        <p className="eyebrow mb-2 mt-8 px-3">Library</p>
        <nav aria-label="Library" className="flex flex-col gap-1">
          {libraryNav.map((i) => (
            <SideLink key={i.to} {...i} />
          ))}
        </nav>
        <nav aria-label="Utility" className="mt-auto flex flex-col gap-1">
          {utilityNav.map((i) => (
            <SideLink key={i.to} {...i} />
          ))}
        </nav>
      </aside>

      <header className="sticky top-0 z-30 flex min-h-14 items-center border-b border-hairline bg-background px-5 pt-[env(safe-area-inset-top)] md:hidden">
        <Link to="/" aria-label="LAWLIET home" className="flex min-h-11 items-center">
          <Wordmark />
        </Link>
      </header>

      <div className="md:pl-60">
        <main
          id="main"
          className="mx-auto max-w-5xl px-5 pb-[calc(var(--nav-height)+var(--mini-player-height)+2.5rem)] pt-8 md:px-12 md:pb-[calc(var(--mini-player-height)+3rem)] md:pt-14"
        >
          {children}
        </main>
      </div>

      <div className="fixed inset-x-0 bottom-[var(--nav-height)] z-40 md:bottom-0 md:left-60">
        <MiniPlayer />
      </div>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 grid h-[var(--nav-height)] grid-cols-4 border-t border-hairline bg-sidebar pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {mobileNav.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact: to !== "/library" }}
            activeProps={{ "aria-current": "page" }}
            className="flex min-h-11 flex-col items-center justify-center gap-1 text-[0.6875rem] text-muted-foreground data-[status=active]:text-platinum"
          >
            <Icon className="size-5" strokeWidth={1.5} aria-hidden />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
