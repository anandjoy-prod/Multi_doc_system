import { cn } from '@/lib/cn';

export function StatCard({
  label,
  value,
  delta,
  trend,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  delta?: string;
  trend?: 'up' | 'down' | 'flat';
  icon: React.ComponentType<{ className?: string }>;
}) {
  const trendColor =
    trend === 'up'
      ? 'text-accent-success'
      : trend === 'down'
        ? 'text-accent-error'
        : 'text-fg-secondary';

  return (
    <div className="rounded-2xl border border-border bg-bg-secondary p-5 shadow-sm transition hover:border-accent/40">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-fg-secondary">
          {label}
        </span>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-bg-tertiary text-accent">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 font-display text-3xl font-semibold tracking-tight">
        {value}
      </div>
      {delta ? (
        <div className={cn('mt-1 text-xs', trendColor)}>{delta}</div>
      ) : null}
    </div>
  );
}
