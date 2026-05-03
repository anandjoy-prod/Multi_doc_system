// =============================================================================
// Retriever registry — the seam where LangGraph will plug in.
//
// Today: fan out to every retriever that's "available" for the user, merge
// the results, return top-k overall. Cheap and dumb.
//
// Tomorrow (LangGraph): replace `retrieve` with a router agent that picks
// which retrievers to call based on the query. The Retriever interface in
// types.ts stays the same, so the chat send route doesn't change.
// =============================================================================

import { pdfRetriever } from './pdf/retriever';
import type { RetrievedChunk, Retriever } from './types';

const RETRIEVERS: Retriever[] = [
  pdfRetriever,
  // googleDocsRetriever,
  // confluenceRetriever,
];

/**
 * Lightweight skip-RAG heuristic. Avoids the embedding + DB roundtrip for
 * pure-conversational openings ("hi", "thanks", "ok cool"). Saves tokens
 * AND latency on the most common case.
 */
const TRIVIAL_RE =
  /^(hi+|hello|hey+|yo|sup|thanks|thank you|ok|okay|cool|nice|wow|lol|haha|got it|sure|yes|no|y|n|true|false)\b[\s!?.]*$/i;

export function shouldRetrieve(message: string): boolean {
  const t = message.trim();
  if (t.length < 4) return false;
  if (t.length < 30 && TRIVIAL_RE.test(t)) return false;
  return true;
}

export async function retrieve(
  userId: string,
  query: string,
  k = 5,
): Promise<RetrievedChunk[]> {
  if (!shouldRetrieve(query)) return [];

  const availability = await Promise.all(
    RETRIEVERS.map(async (r) => ({ r, ok: await r.available(userId) })),
  );
  const usable = availability.filter((a) => a.ok).map((a) => a.r);
  if (usable.length === 0) return [];

  const results = await Promise.all(
    usable.map((r) => r.retrieve(userId, query, k).catch(() => [])),
  );

  // Merge by score, keep top-k overall, dedupe by chunk id.
  const seen = new Set<string>();
  return results
    .flat()
    .sort((a, b) => b.score - a.score)
    .filter((c) => {
      if (seen.has(c.chunkId)) return false;
      seen.add(c.chunkId);
      return true;
    })
    .slice(0, k);
}

export function listRetrievers(): { id: string; name: string }[] {
  return RETRIEVERS.map((r) => ({ id: r.id, name: r.name }));
}
