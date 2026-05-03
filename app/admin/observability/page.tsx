import {
  Activity,
  AlertCircle,
  CircleDollarSign,
  Clock,
  Hash,
  Sparkles,
} from 'lucide-react';
import { StatCard } from '@/components/admin/StatCard';
import { Sparkline } from '@/components/admin/Sparkline';
import { getObservabilityStats } from '@/lib/observability/stats';
import { cn } from '@/lib/cn';

export const dynamic = 'force-dynamic';

const fmtUsd = (n: number) =>
  n === 0
    ? '$0'
    : n < 0.01
      ? `$${n.toFixed(5)}`
      : `$${n.toFixed(4)}`;

const fmtNum = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: 0 });

export default async function ObservabilityPage() {
  const stats = await getObservabilityStats();
  const { totals, latency, byDay, byKind, topUsers, recent } = stats;
  const dailyCost = byDay.map((d) => d.cost);
  const dailyCalls = byDay.map((d) => d.calls);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          Observability
        </h2>
        <p className="text-sm text-fg-secondary">
          Token, latency, and cost telemetry from every LLM and embedding call.
          Last 7 days.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Calls"
          value={fmtNum(totals.calls)}
          delta={`${fmtNum(totals.promptTokens + totals.completionTokens)} tokens`}
          trend="flat"
          icon={Activity}
        />
        <StatCard
          label="Est. cost"
          value={fmtUsd(totals.estCostUsd)}
          delta="real-OpenAI list prices"
          trend="flat"
          icon={CircleDollarSign}
        />
        <StatCard
          label="Latency p95"
          value={`${fmtNum(latency.p95)} ms`}
          delta={`p50: ${fmtNum(latency.p50)} ms`}
          trend="flat"
          icon={Clock}
        />
        <StatCard
          label="Error rate"
          value={`${(totals.errorRate * 100).toFixed(1)}%`}
          delta={
            totals.errorRate === 0
              ? 'all good'
              : `${Math.round(totals.errorRate * totals.calls)} failed`
          }
          trend={totals.errorRate > 0.05 ? 'down' : 'flat'}
          icon={AlertCircle}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-border bg-bg-secondary p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-semibold">
                Cost by day
              </h3>
              <p className="text-xs text-fg-secondary">
                Total: {fmtUsd(totals.estCostUsd)} · {fmtNum(totals.calls)} calls
              </p>
            </div>
            <span className="rounded-full border border-border px-2 py-0.5 text-xs text-fg-secondary">
              live
            </span>
          </div>
          {dailyCost.some((c) => c > 0) ? (
            <Sparkline data={dailyCost.map((c) => c * 1e6)} className="h-24 w-full" />
          ) : (
            <div className="flex h-24 items-center justify-center text-sm text-fg-secondary">
              No telemetry yet — send a chat or upload a PDF.
            </div>
          )}
          <div className="mt-3 grid grid-cols-7 gap-2 text-center text-[11px] text-fg-secondary">
            {byDay.map((d, i) => (
              <div key={d.day}>
                <div className="font-mono text-xs text-fg-primary">
                  {dailyCalls[i]}
                </div>
                <div>{d.day.slice(5)}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-bg-secondary p-5">
          <h3 className="mb-3 font-display text-base font-semibold">By kind</h3>
          {byKind.length === 0 ? (
            <p className="text-sm text-fg-secondary">No calls yet.</p>
          ) : (
            <ul className="space-y-2">
              {byKind.map((k) => (
                <li
                  key={k.kind}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="capitalize">{k.kind.replace('_', ' ')}</span>
                  <span className="font-mono text-xs text-fg-secondary">
                    {fmtNum(k.calls)} · {fmtUsd(k.cost)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-bg-secondary p-5">
        <h3 className="mb-4 font-display text-base font-semibold">
          Top users by cost
        </h3>
        {topUsers.length === 0 ? (
          <p className="text-sm text-fg-secondary">No attributed calls yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {topUsers.map((u) => {
              const max = topUsers[0]!.cost || 1;
              const pct = (u.cost / max) * 100;
              return (
                <li key={u.userId} className="flex items-center gap-3">
                  <span className="w-44 shrink-0 truncate font-mono text-xs">
                    {u.email}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-tertiary">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-24 text-right font-mono text-xs text-fg-secondary">
                    {fmtUsd(u.cost)}
                  </span>
                  <span className="w-16 text-right font-mono text-xs text-fg-secondary">
                    {fmtNum(u.calls)} calls
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-bg-secondary">
        <header className="border-b border-border p-4">
          <h3 className="font-display text-base font-semibold">Recent calls</h3>
          <p className="text-xs text-fg-secondary">
            Last {recent.length} calls · message content is never stored, only
            counts and metadata
          </p>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-fg-secondary">
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Kind</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">
                  Model
                </th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">
                  User
                </th>
                <th className="px-4 py-3 font-medium">Tokens</th>
                <th className="px-4 py-3 font-medium">Latency</th>
                <th className="px-4 py-3 font-medium">Cost</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recent.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-sm text-fg-secondary"
                  >
                    No calls recorded yet.
                  </td>
                </tr>
              ) : (
                recent.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 text-fg-secondary">
                      {new Date(r.created_at).toLocaleTimeString(undefined, {
                        hour: 'numeric',
                        minute: 'numeric',
                        second: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <KindPill kind={r.kind} />
                    </td>
                    <td className="hidden px-4 py-3 font-mono text-xs text-fg-secondary md:table-cell">
                      {r.model}
                    </td>
                    <td className="hidden px-4 py-3 font-mono text-xs text-fg-secondary lg:table-cell">
                      {r.email ?? '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {r.totalTokens ? fmtNum(r.totalTokens) : '—'}
                      {r.completionTokens && r.promptTokens ? (
                        <span className="ml-1 text-fg-secondary">
                          ({fmtNum(r.promptTokens)} +{' '}
                          {fmtNum(r.completionTokens)})
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-fg-secondary">
                      {r.latencyMs != null ? `${r.latencyMs} ms` : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {fmtUsd(r.costUsd)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={r.status} error={r.error} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="rounded-xl border border-border bg-bg-secondary p-4 text-xs text-fg-secondary">
        <p className="flex items-start gap-2">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
          <span>
            Costs are estimated against{' '}
            <span className="font-medium text-fg-primary">
              real OpenAI list prices
            </span>{' '}
            so you have a forward-looking spend signal even while you're on the
            free GitHub Models tier (where actual cost is $0). Update prices in{' '}
            <code className="font-mono">lib/observability/pricing.ts</code> when
            OpenAI does.
          </span>
        </p>
      </footer>
    </div>
  );
}

function KindPill({ kind }: { kind: string }) {
  const palette =
    kind === 'chat'
      ? 'border-accent/40 text-accent'
      : kind === 'embed_query'
        ? 'border-fg-secondary text-fg-secondary'
        : 'border-accent-success/40 text-accent-success';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]',
        palette,
      )}
    >
      <Hash className="h-3 w-3" /> {kind.replace('_', ' ')}
    </span>
  );
}

function StatusPill({
  status,
  error,
}: {
  status: 'ok' | 'error';
  error: string | null;
}) {
  if (status === 'ok') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-accent-success/40 px-2 py-0.5 text-[11px] text-accent-success">
        ok
      </span>
    );
  }
  return (
    <span
      title={error ?? undefined}
      className="inline-flex items-center gap-1 rounded-full border border-accent-error/40 px-2 py-0.5 text-[11px] text-accent-error"
    >
      <AlertCircle className="h-3 w-3" /> error
    </span>
  );
}
