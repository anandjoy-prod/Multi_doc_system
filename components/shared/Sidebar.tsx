'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

export interface SidebarItem {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}

/**
 * Desktop sidebar — hidden on mobile (`lg:flex`). The same `SidebarBody`
 * is reused inside the mobile drawer.
 */
export function Sidebar({
  title,
  items,
  footer,
}: {
  title: string;
  items: SidebarItem[];
  footer?: React.ReactNode;
}) {
  return (
    <aside className="hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-bg-secondary lg:flex">
      <div className="flex h-14 items-center border-b border-border px-5 font-display text-base font-semibold tracking-tight">
        {title}
      </div>
      <SidebarBody items={items} />
      {footer ? <div className="border-t border-border p-3">{footer}</div> : null}
    </aside>
  );
}

/**
 * Just the nav portion — no header, no aside wrapper. Reusable inside
 * the mobile drawer or any other shell.
 */
export function SidebarBody({ items }: { items: SidebarItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary navigation" className="flex flex-1 flex-col gap-0.5 p-3">
      {items.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/');
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              active
                ? 'bg-bg-tertiary text-fg-primary'
                : 'text-fg-secondary hover:bg-bg-tertiary hover:text-fg-primary',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
