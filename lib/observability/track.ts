// =============================================================================
// LLM call tracker — fire-and-forget, never blocks, never throws.
//
// Failure to write a telemetry row must NEVER abort the user-visible action.
// All errors are swallowed and logged. If the table is missing (migration
// not yet run), every call no-ops silently — the app still works.
// =============================================================================

import { serverAdmin } from '@/lib/supabase';
import { estimateCost } from './pricing';

export type LlmCallKind = 'chat' | 'embed_query' | 'embed_ingest';

export interface LlmCallRecord {
  userId: string | null;
  sessionId: string | null;
  documentId?: string | null;
  kind: LlmCallKind;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  latencyMs: number;
  ragChunks?: number;
  status: 'ok' | 'error';
  error?: string;
}

export async function recordLlmCall(rec: LlmCallRecord): Promise<void> {
  try {
    const promptTokens = rec.promptTokens ?? 0;
    const completionTokens = rec.completionTokens ?? 0;
    const totalTokens = promptTokens + completionTokens;
    const cost = estimateCost(rec.model, promptTokens, completionTokens);

    await serverAdmin().from('llm_calls').insert({
      user_id: rec.userId,
      session_id: rec.sessionId,
      document_id: rec.documentId ?? null,
      kind: rec.kind,
      model: rec.model,
      prompt_tokens: promptTokens || null,
      completion_tokens: completionTokens || null,
      total_tokens: totalTokens || null,
      latency_ms: Math.round(rec.latencyMs),
      rag_chunks: rec.ragChunks ?? null,
      estimated_cost_usd: cost,
      status: rec.status,
      error: rec.error ?? null,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[observability] failed to record', { kind: rec.kind, err });
  }
}

/**
 * Convenience: time an async operation and record success/failure.
 */
export async function timed<T>(
  base: Omit<LlmCallRecord, 'status' | 'latencyMs'>,
  fn: () => Promise<{ result: T; promptTokens?: number; completionTokens?: number }>,
): Promise<T> {
  const start = Date.now();
  try {
    const { result, promptTokens, completionTokens } = await fn();
    void recordLlmCall({
      ...base,
      promptTokens,
      completionTokens,
      latencyMs: Date.now() - start,
      status: 'ok',
    });
    return result;
  } catch (err) {
    void recordLlmCall({
      ...base,
      latencyMs: Date.now() - start,
      status: 'error',
      error: err instanceof Error ? err.message : 'unknown',
    });
    throw err;
  }
}
