// =============================================================================
// Embedding helpers — text-embedding-3-small (1536 dims) via GitHub Models.
//
// 3-small is ~6× cheaper than 3-large and gives ≥95% of its accuracy on
// English prose. Don't upgrade unless retrieval quality measurably suffers.
//
// Batching: GitHub Models accepts arrays. We batch in 32s — large enough to
// be efficient, small enough to keep p99 latency low and to retry granularly.
//
// Both helpers report token usage so the observability layer can record
// prompt_tokens for every embedding call.
// =============================================================================

import { llm } from '@/lib/llm';

export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIM = 1536;

const BATCH_SIZE = 32;

export interface EmbedResult {
  vector: number[];
  promptTokens: number;
}

export interface BatchedEmbedResult {
  from: number;
  to: number;
  vectors: number[][];
  promptTokens: number;
}

export async function embedQuery(text: string): Promise<EmbedResult> {
  const res = await llm().embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.slice(0, 8000),
  });
  const vec = res.data[0]?.embedding;
  if (!vec) throw new Error('Empty embedding response');
  return {
    vector: vec,
    promptTokens: res.usage?.prompt_tokens ?? 0,
  };
}

export async function* embedBatched(
  inputs: string[],
): AsyncGenerator<BatchedEmbedResult> {
  for (let i = 0; i < inputs.length; i += BATCH_SIZE) {
    const slice = inputs.slice(i, i + BATCH_SIZE).map((s) => s.slice(0, 8000));
    const res = await llm().embeddings.create({
      model: EMBEDDING_MODEL,
      input: slice,
    });
    yield {
      from: i,
      to: i + slice.length,
      vectors: res.data.map((d) => d.embedding),
      promptTokens: res.usage?.prompt_tokens ?? 0,
    };
  }
}
