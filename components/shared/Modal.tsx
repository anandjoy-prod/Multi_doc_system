'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Centered, accessible modal dialog. Same a11y pattern as MobileDrawer:
 * focus trap, Escape close, backdrop click, body scroll lock, focus
 * restoration. Defaults to a small dialog; override `size` for wider forms.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  size = 'sm',
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      lastFocusedRef.current = document.activeElement as HTMLElement | null;
      const t = setTimeout(() => {
        const first = panelRef.current?.querySelector<HTMLElement>(
          'input, select, textarea, button, [tabindex]:not([tabindex="-1"])',
        );
        first?.focus();
      }, 0);
      return () => clearTimeout(t);
    } else {
      lastFocusedRef.current?.focus?.();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab' && panelRef.current) {
        const focusables = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(
            'input, select, textarea, button, a, [tabindex]:not([tabindex="-1"])',
          ),
        ).filter(
          (el) =>
            !el.hasAttribute('disabled') &&
            (el as HTMLInputElement).type !== 'hidden',
        );
        if (focusables.length === 0) return;
        const first = focusables[0]!;
        const last = focusables[focusables.length - 1]!;
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const sizeClass =
    size === 'lg' ? 'max-w-2xl' : size === 'md' ? 'max-w-lg' : 'max-w-md';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative w-full rounded-t-2xl border border-border bg-bg-secondary shadow-xl sm:rounded-2xl',
          sizeClass,
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div>
            <h2 className="font-display text-base font-semibold tracking-tight">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-xs text-fg-secondary">{description}</p>
            ) : null}
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-fg-secondary transition hover:bg-bg-tertiary hover:text-fg-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="p-5">{children}</div>
        {footer ? (
          <footer className="flex items-center justify-end gap-2 border-t border-border bg-bg-primary/40 px-5 py-4">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
