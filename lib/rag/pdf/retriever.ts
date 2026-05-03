// =============================================================================
// PDF retriever — implements the Retriever interface.
//
// Hybrid search via the `hybrid_search_rag` SQL function: semantic (cosine
// distance on embedding) + keyword (Postgres full-text on tsvector), fused
// with Reciprocal Rank Fusion (k=60). Single round-trip to the DB.
//
// Reads are ORG-WIDE — any logged-in user can query any indexed document.
// Writes (uploads, deletes) remain owner-scoped. This matches the typical
// team-knowledge-base pattern (Confluence, Notion, Slack search).
//
// Records observability for every embedQuery call so the dashboard can
// show retrieval-time embedding cost separately from chat completion cost.
// =============================================================================

import { serverAdmin } from '@/lib/supabase';
import { embedQuery, EMBEDDING_MODEL } from '../embed';
import { recordLlmCall } from '@/lib/observability/track';
import type { RetrievedChunk, Retriever } from '../types';

interface MatchRow {
  chunk_id: string;
  document_id: string;
  content: string;
  metadata: Record<string, unknown> | null;
  score: number;
  filename: string;
  page: number | null;
}

export const pdfRetriever: Retriever = {
  id: 'pdf',
  name: 'PDF documents',

  // Org-wide: true if ANYONE has indexed at least one ready document.
  async available(_userId: string): Promise<boolean> {
    const sb = serverAdmin();
    const { count } = await sb
      .from('rag_documents')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'ready');
    return (count ?? 0) > 0;
  },

  async retrieve(
    userId: string,
    query: string,
    k: number,
  ): Promise<RetrievedChunk[]> {
    // Embed the query — timed + recorded.
    const start = Date.now();
    let queryEmbedding: number[];
    let promptTokens = 0;
    try {
      const r = await embedQuery(query);
      queryEmbedding = r.vector;
      promptTokens = r.promptTokens;
      void recordLlmCall({
        userId,
        sessionId: null,
        kind: 'embed_query',
        model: EMBEDDING_MODEL,
        promptTokens,
        latencyMs: Date.now() - start,
        status: 'ok',
      });
    } catch (err) {
      void recordLlmCall({
        userId,
        sessionId: null,
        kind: 'embed_query',
        model: EMBEDDING_MODEL,
        latencyMs: Date.now() - start,
        status: 'error',
        error: err instanceof Error ? err.message : 'unknown',
      });
      throw err;
    }

    // Hybrid search — pass NULL for user_id_filter to make it org-wide.
    const sb = serverAdmin();
    const { data, error } = await sb.rpc('hybrid_search_rag', {
      query_text: query,
      query_embedding: queryEmbedding as unknown as string,
      match_count: k,
      user_id_filter: null,
    });
    if (error || !data) return [];
    return (data as MatchRow[]).map((r) => {
      const meta = (r.metadata ?? {}) as {
        url?: unknown;
        sheet?: unknown;
      };
      return {
        chunkId: r.chunk_id,
        documentId: r.document_id,
        content: r.content,
        filename: r.filename,
        page: r.page,
        sheet: typeof meta.sheet === 'string' ? meta.sheet : null,
        score: r.score,
        sourceUri:
          typeof meta.url === 'string' ? meta.url : null,
      };
    });
  },
};
