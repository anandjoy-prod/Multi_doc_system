'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Brand } from './Brand';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';
import { MobileDrawer } from './MobileDrawer';

/**
 * Layout shell shared by /admin/** and /chat/** routes. It owns:
 *
 *   - The mobile menu open/close state.
 *   - A topbar with: skip-to-content, hamburger (mobile), brand+heading,
 *     theme toggle, user menu.
 *   - The desktop sidebar slot (rendered inline next to <main>).
 *   - The mobile drawer (renders the same nav inside a slide-in panel).
 *   - The page <main> with the route's children.
 */
export function AppShell({
  heading,
  drawerTitle,
  desktopSidebar,
  mobileNav,
  scrollable = true,
  children,
}: {
  heading: string;
  drawerTitle: string;
  desktopSidebar: React.ReactNode;
  mobileNav: React.ReactNode;
  /** Whether <main> should scroll. Chat keeps its own scrolling, so set false there. */
  scrollable?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-screen w-full">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-1.5 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>

      {desktopSidebar}

      <MobileDrawer
        open={open}
        onClose={() => setOpen(false)}
        title={drawerTitle}
      >
        {mobileNav}
      </MobileDrawer>

      <div className="flex h-full flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-3 border-b border-border bg-bg-primary/80 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={open}
              aria-controls="mobile-drawer"
              className="flex h-9 w-9 items-center justify-center rounded-md text-fg-secondary transition hover:bg-bg-secondary hover:text-fg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Brand />
            <span className="hidden text-fg-secondary sm:inline">/</span>
            <h1 className="hidden font-display text-base font-semibold tracking-tight sm:block">
              {heading}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>

        <main
          id="main-content"
          className={
            scrollable
              ? 'flex-1 overflow-y-auto bg-bg-primary px-4 py-6 sm:px-6'
              : 'flex-1 overflow-hidden'
          }
        >
          {scrollable ? (
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
