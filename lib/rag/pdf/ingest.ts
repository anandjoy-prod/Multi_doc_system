// =============================================================================
// PDF ingestion pipeline.
//
//   Extract → chunk → embed (batched) → store
//
// Yields IngestEvent objects so the API route can stream progress to the
// client as NDJSON. The DB row's `status` column tracks the same state, so
// even if the client disconnects mid-flight the document ends up in a
// consistent state ('ready' or 'failed').
//
// Each embedding batch is recorded to llm_calls with kind='embed_ingest'
// so the observability dashboard can show indexing cost separately.
// =============================================================================

import { serverAdmin } from '@/lib/supabase';
import { embedBatched, EMBEDDING_MODEL } from '../embed';
import { splitText } from '../chunk';
import { recordLlmCall } from '@/lib/observability/track';
import type { ChunkInput, IngestEvent } from '../types';
import { extractPdfText } from './extract';

interface IngestOpts {
  userId: string;
  filename: string;
  fileSize: number;
  buffer: ArrayBuffer;
}

function looksLikeMissingRagTables(msg: string): boolean {
  return /schema cache|relation .* does not exist|Could not find the table/i.test(
    msg,
  );
}

export async function* ingestPdf(opts: IngestOpts): AsyncGenerator<IngestEvent> {
  const sb = serverAdmin();

  // 1. Create the document row up front.
  const { data: doc, error: insertErr } = await sb
    .from('rag_documents')
    .insert({
      user_id: opts.userId,
      source: 'pdf',
      filename: opts.filename,
      file_size: opts.fileSize,
      status: 'extracting',
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

  try {
    // 2. Extract per-page text.
    const { pages, totalPages } = await extractPdfText(opts.buffer);
    if (pages.length === 0) {
      throw new Error('No extractable text — is this a scanned image PDF?');
    }
    await sb
      .from('rag_documents')
      .update({ status: 'chunking', total_pages: totalPages })
      .eq('id', documentId);
    yield { event: 'extracted', documentId, pages: totalPages };

    // 3. Chunk.
    const chunks: ChunkInput[] = [];
    for (const p of pages) {
      const pageChunks = splitText(p.text, { page: p.page });
      for (const c of pageChunks) chunks.push(c);
    }
    yield { event: 'chunking', documentId, progress: 1, chunks: chunks.length };

    if (chunks.length === 0) {
      throw new Error('No chunks produced from extracted text');
    }

    // 4. Embed in batches; one telemetry row per batch.
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

    // 5. Mark as ready.
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
