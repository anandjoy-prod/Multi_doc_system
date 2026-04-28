import { ShieldCheck, User as UserIcon, Eye } from 'lucide-react';
import { cn } from '@/lib/cn';

type Variant = 'pill' | 'inline';

const ICON_FOR: Record<string, React.ComponentType<{ className?: string }>> = {
  admin: ShieldCheck,
  viewer: Eye,
};

const COLOR_FOR: Record<string, string> = {
  admin: 'border-accent text-accent',
  viewer: 'border-fg-secondary text-fg-secondary',
};

/**
 * Single source of truth for role chips. `variant` controls density:
 *   - pill   — bordered chip, used in the user table row
 *   - inline — bare icon + text, used in the top-bar user menu
 */
export function RoleBadge({
  role,
  variant = 'pill',
  className,
}: {
  role: string;
  variant?: Variant;
  className?: string;
}) {
  const Icon = ICON_FOR[role] ?? UserIcon;
  const color = COLOR_FOR[role] ?? 'border-accent-success text-accent-success';

  if (variant === 'inline') {
    return (
      <span
        className={cn(
          'flex items-center gap-1 text-xs text-fg-secondary',
          className,
        )}
      >
        <Icon className="h-3.5 w-3.5" />
        {role}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs',
        color,
        className,
      )}
    >
      <Icon className="h-3 w-3" /> {role}
    </span>
  );
}
