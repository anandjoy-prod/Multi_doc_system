// =============================================================================
// URL ingestion pipeline.
//
//   fetch + extract → chunk → embed (batched) → store
//
// Same async-generator + NDJSON pattern as PDF ingest. Reuses chunk/embed.
// Stores `source: 'url'` and stamps each chunk's metadata with the source
// URL so citations can deep-link back to the page.
// =============================================================================

import { serverAdmin } from '@/lib/supabase';
import { embedBatched, EMBEDDING_MODEL } from '../embed';
import { splitText } from '../chunk';
import { recordLlmCall } from '@/lib/observability/track';
import type { ChunkInput, IngestEvent } from '../types';
import { fetchAndExtract, UrlFetchError } from './fetch';

interface IngestUrlOpts {
  userId: string;
  url: string;
}

function looksLikeMissingRagTables(msg: string): boolean {
  return /schema cache|relation .* does not exist|Could not find the table/i.test(
    msg,
  );
}

export async function* ingestUrl(opts: IngestUrlOpts): AsyncGenerator<IngestEvent> {
  const sb = serverAdmin();

  // 1. Fetch + extract upfront so we can surface a meaningful error before
  //    creating the document row (avoids "failed" rows for typos / 404s).
  let extracted;
  try {
    extracted = await fetchAndExtract(opts.url);
  } catch (err) {
    const message =
      err instanceof UrlFetchError
        ? err.userMessage
        : err instanceof Error
          ? err.message
          : 'Failed to fetch URL';
    yield { event: 'error', message };
    return;
  }

  // 2. Create the document row.
  const { data: doc, error: insertErr } = await sb
    .from('rag_documents')
    .insert({
      user_id: opts.userId,
      source: 'url',
      filename: extracted.title,
      file_size: extracted.byteSize,
      status: 'chunking',
    })
    .select('id')
    .single();

  if (insertErr || !doc) {
    const raw = insertErr?.message ?? 'Failed to create document row';
    const friendly = looksLikeMissingRagTables(raw)
      ? 'RAG tables not found. Run supabase/migrations/0002_rag.sql in the Supabase SQL Editor, then retry.'
      : raw;
    yield { event: 'error', message: friendly };
    return;
  }
  const documentId = doc.id as string;
  yield { event: 'started', documentId };
  yield { event: 'extracted', documentId, pages: 1 };

  try {
    // 3. Chunk. URL gets one logical "page" — page=1 for citation continuity.
    const chunks: ChunkInput[] = splitText(extracted.text, { page: 1 });
    if (chunks.length === 0) {
      throw new Error('No chunks produced from extracted text');
    }
    // Stamp each chunk with the source URL so citations can deep-link.
    for (const c of chunks) {
      (c.metadata as Record<string, unknown>).url = extracted.url;
    }
    yield { event: 'chunking', documentId, progress: 1, chunks: chunks.length };

    // 4. Embed in batches.
    await sb
      .from('rag_documents')
      .update({ status: 'embedding', chunks_count: chunks.length })
      .eq('id', documentId);

    let embedded = 0;
    for await (const batch of embedBatched(chunks.map((c) => c.content))) {
      const batchStart = Date.now();
      const rows = batch.vectors.map((vec, i) => {
        const chunk = chunks[batch.from + i]!;
        return {
          document_id: documentId,
          content: chunk.content,
          embedding: vec as unknown as string,
          metadata: chunk.metadata,
        };
      });
      const { error: rowsErr } = await sb.from('rag_chunks').insert(rows);
      if (rowsErr) {
        void recordLlmCall({
          userId: opts.userId,
          sessionId: null,
          documentId,
          kind: 'embed_ingest',
          model: EMBEDDING_MODEL,
          promptTokens: batch.promptTokens,
          latencyMs: Date.now() - batchStart,
          status: 'error',
          error: rowsErr.message,
        });
        throw rowsErr;
      }
      void recordLlmCall({
        userId: opts.userId,
        sessionId: null,
        documentId,
        kind: 'embed_ingest',
        model: EMBEDDING_MODEL,
        promptTokens: batch.promptTokens,
        latencyMs: Date.now() - batchStart,
        status: 'ok',
      });

      embedded = batch.to;
      yield {
        event: 'embedding',
        documentId,
        progress: embedded / chunks.length,
        chunks: chunks.length,
      };
    }

    // 5. Mark ready.
    await sb
      .from('rag_documents')
      .update({ status: 'ready' })
      .eq('id', documentId);

    yield { event: 'done', documentId, chunks: chunks.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await sb
      .from('rag_documents')
      .update({ status: 'failed', error: message })
      .eq('id', documentId);
    yield { event: 'error', documentId, message };
  }
}
