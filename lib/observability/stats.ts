// =============================================================================
// Observability dashboard helpers — read-side aggregations.
//
// Pulls llm_calls rows and computes:
//   - 7-day totals (calls, tokens, cost, error rate)
//   - per-day cost+calls breakdown for sparklines
//   - latency p50 / p95 (computed in JS — small enough to do it in app)
//   - top users by cost
//   - recent N calls for the table
//
// Everything's keyed off the last 7 days. Larger windows can be added later.
// =============================================================================

import { serverAdmin } from '@/lib/supabase';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface DashboardStats {
  totals: {
    calls: number;
    promptTokens: number;
    completionTokens: number;
    estCostUsd: number;
    errorRate: number; // 0..1
  };
  latency: {
    p50: number;
    p95: number;
  };
  byDay: { day: string; calls: number; cost: number }[]; // 7 entries
  byKind: { kind: string; calls: number; cost: number }[];
  topUsers: { userId: string; email: string; calls: number; cost: number }[];
  recent: RecentCall[];
}

export interface RecentCall {
  id: string;
  created_at: string;
  kind: string;
  model: string;
  email: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  latencyMs: number | null;
  ragChunks: number | null;
  costUsd: number;
  status: 'ok' | 'error';
  error: string | null;
}

interface CallRow {
  id: string;
  created_at: string;
  kind: string;
  model: string;
  user_id: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  latency_ms: number | null;
  rag_chunks: number | null;
  estimated_cost_usd: number | string | null;
  status: 'ok' | 'error';
  error: string | null;
  users: { email: string } | null;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.floor((sorted.length - 1) * p);
  return sorted[idx]!;
}

export async function getObservabilityStats(): Promise<DashboardStats> {
  const sb = serverAdmin();
  const sinceISO = new Date(Date.now() - 7 * DAY_MS).toISOString();

  const { data, error } = await sb
    .from('llm_calls')
    .select(
      'id, created_at, kind, model, user_id, prompt_tokens, completion_tokens, total_tokens, latency_ms, rag_chunks, estimated_cost_usd, status, error, users ( email )',
    )
    .gte('created_at', sinceISO)
    .order('created_at', { ascending: false })
    .limit(2000)
    .returns<CallRow[]>();

  if (error || !data) {
    return emptyStats();
  }

  const calls = data.length;
  const promptTokens = sum(data, (r) => r.prompt_tokens ?? 0);
  const completionTokens = sum(data, (r) => r.completion_tokens ?? 0);
  const totalCost = sum(data, (r) => Number(r.estimated_cost_usd ?? 0));
  const errors = data.filter((r) => r.status === 'error').length;
  const errorRate = calls === 0 ? 0 : errors / calls;

  const latencies = data
    .map((r) => r.latency_ms)
    .filter((n): n is number => typeof n === 'number')
    .sort((a, b) => a - b);

  // 7-day per-day buckets, oldest first.
  const byDay: DashboardStats['byDay'] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * DAY_MS);
    return { day: d.toISOString().slice(0, 10), calls: 0, cost: 0 };
  });
  for (const row of data) {
    const ageMs = Date.now() - new Date(row.created_at).getTime();
    const daysAgo = Math.floor(ageMs / DAY_MS);
    if (daysAgo >= 0 && daysAgo < 7) {
      const idx = 6 - daysAgo;
      byDay[idx]!.calls += 1;
      byDay[idx]!.cost += Number(row.estimated_cost_usd ?? 0);
    }
  }

  // Per kind.
  const kindAgg = new Map<string, { calls: number; cost: number }>();
  for (const row of data) {
    const k = kindAgg.get(row.kind) ?? { calls: 0, cost: 0 };
    k.calls += 1;
    k.cost += Number(row.estimated_cost_usd ?? 0);
    kindAgg.set(row.kind, k);
  }

  // Top users by cost.
  const userAgg = new Map<
    string,
    { userId: string; email: string; calls: number; cost: number }
  >();
  for (const row of data) {
    if (!row.user_id) continue;
    const cur = userAgg.get(row.user_id) ?? {
      userId: row.user_id,
      email: row.users?.email ?? '(unknown)',
      calls: 0,
      cost: 0,
    };
    cur.calls += 1;
    cur.cost += Number(row.estimated_cost_usd ?? 0);
    userAgg.set(row.user_id, cur);
  }

  return {
    totals: {
      calls,
      promptTokens,
      completionTokens,
      estCostUsd: totalCost,
      errorRate,
    },
    latency: {
      p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
    },
    byDay,
    byKind: Array.from(kindAgg.entries())
      .map(([kind, v]) => ({ kind, ...v }))
      .sort((a, b) => b.calls - a.calls),
    topUsers: Array.from(userAgg.values())
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 5),
    recent: data.slice(0, 25).map((r) => ({
      id: r.id,
      created_at: r.created_at,
      kind: r.kind,
      model: r.model,
      email: r.users?.email ?? null,
      promptTokens: r.prompt_tokens,
      completionTokens: r.completion_tokens,
      totalTokens: r.total_tokens,
      latencyMs: r.latency_ms,
      ragChunks: r.rag_chunks,
      costUsd: Number(r.estimated_cost_usd ?? 0),
      status: r.status,
      error: r.error,
    })),
  };
}

function sum<T>(arr: T[], pick: (t: T) => number): number {
  let n = 0;
  for (const x of arr) n += pick(x);
  return n;
}

function emptyStats(): DashboardStats {
  return {
    totals: {
      calls: 0,
      promptTokens: 0,
      completionTokens: 0,
      estCostUsd: 0,
      errorRate: 0,
    },
    latency: { p50: 0, p95: 0 },
    byDay: Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.now() - (6 - i) * DAY_MS);
      return { day: d.toISOString().slice(0, 10), calls: 0, cost: 0 };
    }),
    byKind: [],
    topUsers: [],
    recent: [],
  };
}
