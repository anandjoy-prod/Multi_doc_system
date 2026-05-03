'use client';

import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Row-level dropdown menu. Plain CSS — no popover library.
 *
 * Closes on outside click, on Escape, on selection.
 */
export function UserActions({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Row actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-7 w-7 items-center justify-center rounded-md text-fg-secondary transition hover:bg-bg-tertiary hover:text-fg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open ? (
        <div
          role="menu"
          className={cn(
            'absolute right-0 top-9 z-20 w-40 overflow-hidden rounded-lg border border-border bg-bg-primary shadow-lg',
          )}
        >
          <MenuItem
            icon={<Pencil className="h-3.5 w-3.5" />}
            onSelect={() => {
              setOpen(false);
              onEdit();
            }}
          >
            Edit
          </MenuItem>
          <MenuItem
            icon={<Trash2 className="h-3.5 w-3.5" />}
            destructive
            onSelect={() => {
              setOpen(false);
              onDelete();
            }}
          >
            Delete
          </MenuItem>
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({
  icon,
  destructive,
  onSelect,
  children,
}: {
  icon: React.ReactNode;
  destructive?: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      role="menuitem"
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-bg-tertiary focus-visible:outline-none focus-visible:bg-bg-tertiary',
        destructive ? 'text-accent-error' : 'text-fg-primary',
      )}
    >
      {icon}
      {children}
    </button>
  );
}
