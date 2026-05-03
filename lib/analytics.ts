import { serverAdmin } from './supabase';

/**
 * Dashboard analytics. Real totals from the DB; sparkline + top-users are
 * still demo-flavoured until there is meaningful workload data to aggregate.
 *
 * The shape mirrors what the dashboard page expects so swapping in real
 * aggregation later is a no-op for the JSX.
 */

export interface DashboardStats {
  totals: {
    users: number;
    sessions: number;
    messagesToday: number;
    activeNow: number; // last_login within 5 minutes
  };
  messagesByDay: number[]; // 7 entries, oldest first
  topUsers: { name: string; messages: number }[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function emailToName(email: string): string {
  const local = email.split('@')[0] ?? email;
  return local.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const sb = serverAdmin();

  const now = Date.now();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(now - 7 * DAY_MS);
  const fiveMinAgo = new Date(now - 5 * 60 * 1000);

  const [usersHead, sessionsHead, msgsTodayHead, activeHead, weekMsgs, topUsers] =
    await Promise.all([
      sb.from('users').select('*', { count: 'exact', head: true }),
      sb.from('chat_sessions').select('*', { count: 'exact', head: true }),
      sb
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', todayStart.toISOString()),
      sb
        .from('users')
        .select('*', { count: 'exact', head: true })
        .gte('last_login', fiveMinAgo.toISOString()),
      sb
        .from('messages')
        .select('created_at')
        .gte('created_at', sevenDaysAgo.toISOString())
        .returns<{ created_at: string }[]>(),
      // Top 4 users by chat session count (proxy for activity until we
      // expose a SQL view that joins through messages cheaply).
      sb
        .from('users')
        .select('id, email, chat_sessions(id)')
        .returns<{ id: string; email: string; chat_sessions: { id: string }[] }[]>(),
    ]);

  // Bucket weekly messages by day, oldest first.
  const messagesByDay = Array<number>(7).fill(0);
  for (const m of weekMsgs.data ?? []) {
    const daysAgo = Math.floor((now - new Date(m.created_at).getTime()) / DAY_MS);
    if (daysAgo >= 0 && daysAgo < 7) messagesByDay[6 - daysAgo]! += 1;
  }

  const ranked = (topUsers.data ?? [])
    .map((u) => ({
      name: emailToName(u.email),
      messages: u.chat_sessions?.length ?? 0,
    }))
    .sort((a, b) => b.messages - a.messages)
    .slice(0, 4);

  return {
    totals: {
      users: usersHead.count ?? 0,
      sessions: sessionsHead.count ?? 0,
      messagesToday: msgsTodayHead.count ?? 0,
      activeNow: activeHead.count ?? 0,
    },
    messagesByDay,
    topUsers: ranked,
  };
}
