// =============================================================================
// Sentence-aware text chunker.
//
// Why sentence-aware: splitting mid-sentence destroys local context, which
// hurts retrieval recall AND hurts LLM answer quality. We accumulate full
// sentences until we hit the size limit, then carry an overlap from the end
// of the current chunk to preserve continuity.
//
// Defaults are tuned for English prose:
//   chunkSize  = 800 chars  (~ 200 tokens — fits comfortably with 4 others)
//   overlap    = 100 chars  (~ 25 tokens — enough to bridge mid-sentence cuts)
// =============================================================================

import type { ChunkInput } from './types';

interface Opts {
  chunkSize?: number;
  overlap?: number;
}

/**
 * baseMeta is whatever location info the caller wants stamped onto every
 * chunk produced from this text. PDF passes { page }, Excel passes { sheet },
 * URL passes { page: 1 } (and adds url separately at the end).
 */
type BaseMeta = Omit<ChunkInput['metadata'], 'chunk_index'>;

const SENTENCE_BOUNDARY = /(?<=[.!?])\s+(?=[A-Z(])/g;

export function splitText(
  text: string,
  baseMeta: BaseMeta,
  opts: Opts = {},
): ChunkInput[] {
  const chunkSize = opts.chunkSize ?? 800;
  const overlap = opts.overlap ?? 100;

  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];

  const sentences = cleaned.split(SENTENCE_BOUNDARY).filter(Boolean);
  const chunks: ChunkInput[] = [];
  let buffer = '';

  for (const sentence of sentences) {
    // Sentence alone exceeds chunkSize: hard-split it on word boundaries
    // rather than dropping it.
    if (sentence.length > chunkSize) {
      if (buffer) {
        chunks.push(makeChunk(buffer, baseMeta, chunks.length));
        buffer = tail(buffer, overlap);
      }
      for (const piece of hardSplit(sentence, chunkSize, overlap)) {
        chunks.push(makeChunk(piece, baseMeta, chunks.length));
      }
      continue;
    }

    if (buffer.length + sentence.length + 1 > chunkSize && buffer.length > 0) {
      chunks.push(makeChunk(buffer, baseMeta, chunks.length));
      buffer = tail(buffer, overlap);
    }
    buffer = buffer ? `${buffer} ${sentence}` : sentence;
  }

  if (buffer.trim()) chunks.push(makeChunk(buffer, baseMeta, chunks.length));
  return chunks;
}

function makeChunk(
  content: string,
  baseMeta: BaseMeta,
  chunkIndex: number,
): ChunkInput {
  return {
    content: content.trim(),
    metadata: { ...baseMeta, chunk_index: chunkIndex },
  };
}

function tail(s: string, n: number): string {
  if (n <= 0 || s.length <= n) return s;
  // Snap overlap to a word boundary so we don't start a chunk mid-word.
  const slice = s.slice(s.length - n);
  const space = slice.indexOf(' ');
  return space === -1 ? slice : slice.slice(space + 1);
}

function hardSplit(s: string, size: number, overlap: number): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < s.length) {
    const end = Math.min(i + size, s.length);
    out.push(s.slice(i, end));
    if (end === s.length) break;
    i = end - overlap;
  }
  return out;
}
