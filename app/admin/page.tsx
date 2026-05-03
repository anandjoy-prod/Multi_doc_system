import { Users, MessageSquare, Activity, Sparkles } from 'lucide-react';
import { StatCard } from '@/components/admin/StatCard';
import { Sparkline } from '@/components/admin/Sparkline';
import { getDashboardStats } from '@/lib/analytics';

// Always render this on each request — no static caching of analytics.
export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const { totals, messagesByDay, topUsers } = await getDashboardStats();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          Dashboard
        </h2>
        <p className="text-sm text-fg-secondary">
          Live totals from your Supabase project.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Users"
          value={totals.users}
          delta="all roles"
          trend="flat"
          icon={Users}
        />
        <StatCard
          label="Sessions"
          value={totals.sessions}
          delta="across all users"
          trend="flat"
          icon={MessageSquare}
        />
        <StatCard
          label="Messages today"
          value={totals.messagesToday}
          delta="user + assistant turns"
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
              live
            </span>
          </div>
          {messagesByDay.some((n) => n > 0) ? (
            <Sparkline data={messagesByDay} className="h-24 w-full" />
          ) : (
            <div className="flex h-24 items-center justify-center text-sm text-fg-secondary">
              No messages this week — start a chat at /chat.
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-bg-secondary p-5">
          <h3 className="mb-3 font-display text-base font-semibold">
            Top users
          </h3>
          {topUsers.length === 0 ? (
            <p className="text-sm text-fg-secondary">
              Once users start chats, they will appear here.
            </p>
          ) : (
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
          )}
        </section>
      </div>
    </div>
  );
}
