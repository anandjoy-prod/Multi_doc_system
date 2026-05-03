import Link from 'next/link';
import { Sparkles } from 'lucide-react';

/**
 * Always-available "go home" link. Lives in the TopBar so users can escape
 * any deep page with one click. The destination is `/` — the root page
 * routes the user back to either /admin or /chat based on their role.
 */
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="Go to home"
      className="group flex items-center gap-2 rounded-md px-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-white">
        <Sparkles className="h-3.5 w-3.5" />
      </span>
      {compact ? null : (
        <span className="font-display text-sm font-semibold tracking-tight text-fg-primary">
          AI Chat CMS
        </span>
      )}
    </Link>
  );
}
