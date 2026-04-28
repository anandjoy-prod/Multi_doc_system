'use client';

import { Moon, Sun, Monitor, Lock } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { cn } from '@/lib/cn';

export function ThemeToggle() {
  const { theme, setTheme, locked } = useTheme();

  const opts: { value: 'light' | 'dark' | 'system'; Icon: typeof Sun }[] = [
    { value: 'light', Icon: Sun },
    { value: 'dark', Icon: Moon },
    { value: 'system', Icon: Monitor },
  ];

  if (locked) {
    return (
      <div
        className="flex items-center gap-2 rounded-full border border-border bg-bg-secondary px-3 py-1.5 text-xs text-fg-secondary"
        title="Theme is locked by your role"
      >
        <Lock className="h-3.5 w-3.5" /> Theme locked by role
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border bg-bg-secondary p-1">
      {opts.map(({ value, Icon }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          aria-label={`Switch to ${value} theme`}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-full transition',
            theme === value
              ? 'bg-bg-primary text-fg-primary shadow-sm'
              : 'text-fg-secondary hover:text-fg-primary',
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}
