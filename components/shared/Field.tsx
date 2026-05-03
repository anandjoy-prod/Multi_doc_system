'use client';

import { useId } from 'react';
import { cn } from '@/lib/cn';

const inputCls =
  'h-10 w-full rounded-lg border border-border bg-bg-primary px-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-50';

/**
 * Labeled input wrapper. Pass any standard input props through.
 * Use `error` to show inline validation copy (also flips border red).
 */
export function Field({
  label,
  hint,
  error,
  className,
  ...inputProps
}: {
  label: string;
  hint?: string;
  error?: string | null;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <label htmlFor={id} className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-xs font-medium text-fg-secondary">{label}</span>
      <input
        id={id}
        {...inputProps}
        className={cn(
          inputCls,
          error ? 'border-accent-error focus:border-accent-error focus:ring-accent-error/30' : '',
        )}
        aria-invalid={!!error}
      />
      {error ? (
        <span className="text-xs text-accent-error">{error}</span>
      ) : hint ? (
        <span className="text-xs text-fg-secondary">{hint}</span>
      ) : null}
    </label>
  );
}

/**
 * Styled native <select>. Native is the right call here — accessible by
 * default and zero JS for the dropdown. We just skin it.
 */
export function Select({
  label,
  hint,
  error,
  className,
  options,
  ...selectProps
}: {
  label: string;
  hint?: string;
  error?: string | null;
  options: { value: string; label: string }[];
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <label htmlFor={id} className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-xs font-medium text-fg-secondary">{label}</span>
      <select
        id={id}
        {...selectProps}
        className={cn(
          inputCls,
          'pr-8',
          error ? 'border-accent-error focus:border-accent-error focus:ring-accent-error/30' : '',
        )}
        aria-invalid={!!error}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error ? (
        <span className="text-xs text-accent-error">{error}</span>
      ) : hint ? (
        <span className="text-xs text-fg-secondary">{hint}</span>
      ) : null}
    </label>
  );
}
