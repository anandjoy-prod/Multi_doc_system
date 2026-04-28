import { Users, MessageSquare, Activity, Sparkles } from 'lucide-react';
import { StatCard } from '@/components/admin/StatCard';
import { Sparkline } from '@/components/admin/Sparkline';
import { ANALYTICS, USERS } from '@/lib/dummy-data';

export default function AdminDashboard() {
  const { totals, messagesByDay, topUsers, recentActions } = ANALYTICS;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          Dashboard
        </h2>
        <p className="text-sm text-fg-secondary">
          Snapshot of your workspace — refreshed in real time.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Users"
          value={totals.users}
          delta={`${USERS.length} total`}
          trend="flat"
          icon={Users}
        />
        <StatCard
          label="Sessions"
          value={totals.sessions}
          delta="+1 this week"
          trend="up"
          icon={MessageSquare}
        />
        <StatCard
          label="Messages today"
          value={totals.messagesToday}
          delta="+12% vs. yesterday"
          trend="up"
          icon={Sparkles}
        />
        <StatCard
          label="Active now"
          value={totals.activeNow}
          delta="last 5 minutes"
          trend="flat"
          icon={Activity}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-border bg-bg-secondary p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-semibold">
                Messages, last 7 days
              </h3>
              <p className="text-xs text-fg-secondary">
                Includes both user and assistant turns.
              </p>
            </div>
            <span className="rounded-full border border-border px-2 py-0.5 text-xs text-fg-secondary">
              dummy data
            </span>
          </div>
          <Sparkline data={messagesByDay} className="h-24 w-full" />
        </section>

        <section className="rounded-2xl border border-border bg-bg-secondary p-5">
          <h3 className="mb-3 font-display text-base font-semibold">
            Top users
          </h3>
          <ul className="space-y-2">
            {topUsers.map((u) => (
              <li
                key={u.name}
                className="flex items-center justify-between text-sm"
              >
                <span>{u.name}</span>
                <span className="font-mono text-xs text-fg-secondary">
                  {u.messages}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-bg-secondary p-5">
        <h3 className="mb-4 font-display text-base font-semibold">
          Recent activity
        </h3>
        <ul className="divide-y divide-border">
          {recentActions.map((r, i) => (
            <li
              key={i}
              className="flex items-center justify-between py-3 text-sm"
            >
              <div>
                <span className="font-medium">{r.actor}</span>
                <span className="text-fg-secondary"> — {r.action}</span>
              </div>
              <span className="text-xs text-fg-secondary">{r.at}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
