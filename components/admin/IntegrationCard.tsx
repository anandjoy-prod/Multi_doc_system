'use client';

import { useState } from 'react';
import { Check, Loader2, Plug } from 'lucide-react';
import { cn } from '@/lib/cn';

type Status = 'available' | 'connecting' | 'connected';

/**
 * Client island for the integrations grid. The page itself stays a server
 * component — only this card needs interactivity. Icons are passed as
 * ReactNode (serializable JSX) so the server can choose them without
 * shipping the whole lucide-react import to the client side of the page.
 */
export function IntegrationCard({
  name,
  description,
  icon,
  initialStatus = 'available',
}: {
  name: string;
  description: string;
  icon: React.ReactNode;
  initialStatus?: Status;
}) {
  const [status, setStatus] = useState<Status>(initialStatus);

  async function connect() {
    if (status !== 'available') return;
    setStatus('connecting');
    // Simulated OAuth round-trip — swap for the real /api/admin/integrations
    // /:type/connect call once you wire OAuth providers.
    await new Promise((r) => setTimeout(r, 1100));
    setStatus('connected');
  }

  return (
    <div
      className={cn(
        'flex items-start gap-4 rounded-2xl border bg-bg-secondary p-5 transition',
        status === 'connected'
          ? 'border-accent-success/40'
          : 'border-border hover:border-accent/40',
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-bg-tertiary text-accent">
        {icon}
      </div>

      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-base font-semibold">{name}</h3>
          <StatusPill status={status} />
        </div>
        <p className="mt-1 text-sm text-fg-secondary">{description}</p>

        <button
          type="button"
          onClick={connect}
          disabled={status !== 'available'}
          className={cn(
            'mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition',
            status === 'available'
              ? 'bg-accent text-white hover:opacity-90'
              : status === 'connecting'
                ? 'bg-bg-tertiary text-fg-secondary'
                : 'bg-accent-success/10 text-accent-success',
          )}
          aria-label={`Connect ${name}`}
        >
          {status === 'available' ? (
            <>
              <Plug className="h-3.5 w-3.5" /> Connect
            </>
          ) : status === 'connecting' ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Connecting…
            </>
          ) : (
            <>
              <Check className="h-3.5 w-3.5" /> Connected
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: Status }) {
  const label =
    status === 'connected' ? 'connected' : status === 'connecting' ? 'connecting' : 'available';
  const palette =
    status === 'connected'
      ? 'border-accent-success/40 text-accent-success'
      : status === 'connecting'
        ? 'border-border text-fg-secondary'
        : 'border-border text-fg-secondary';
  return (
    <span
      className={cn(
        'rounded-full border px-2 py-0.5 text-[11px] capitalize',
        palette,
      )}
    >
      {label}
    </span>
  );
}
