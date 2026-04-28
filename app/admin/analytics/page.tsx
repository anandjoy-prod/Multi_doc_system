import { Sparkline } from '@/components/admin/Sparkline';
import { ANALYTICS } from '@/lib/dummy-data';

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function AdminAnalyticsPage() {
  const { messagesByDay, topUsers } = ANALYTICS;
  const total = messagesByDay.reduce((a, b) => a + b, 0);
  const avg = Math.round(total / messagesByDay.length);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          Analytics
        </h2>
        <p className="text-sm text-fg-secondary">
          A quick read on usage. Real charts wait for a real DB.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-bg-secondary p-5">
        <div className="mb-2 flex items-end justify-between">
          <div>
            <h3 className="font-display text-base font-semibold">
              Messages this week
            </h3>
            <p className="text-xs text-fg-secondary">
              {total} total · {avg} per day on average
            </p>
          </div>
        </div>
        <Sparkline data={messagesByDay} className="h-32 w-full" />
        <div className="mt-3 grid grid-cols-7 gap-2 text-center text-[11px] text-fg-secondary">
          {messagesByDay.map((v, i) => (
            <div key={i}>
              <div className="font-mono text-xs text-fg-primary">{v}</div>
              <div>{days[i]}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-bg-secondary p-5">
        <h3 className="mb-4 font-display text-base font-semibold">
          Most active users
        </h3>
        <ul className="flex flex-col gap-3">
          {topUsers.map((u) => {
            const max = Math.max(...topUsers.map((x) => x.messages));
            const pct = (u.messages / max) * 100;
            return (
              <li key={u.name} className="flex items-center gap-3">
                <span className="w-32 shrink-0 truncate text-sm">{u.name}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-tertiary">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-12 text-right font-mono text-xs text-fg-secondary">
                  {u.messages}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
