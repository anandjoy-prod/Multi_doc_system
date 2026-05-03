// =============================================================================
// RAG types & interfaces.
//
// The Retriever interface is the seam where future LangGraph integration
// will plug in. Today, registry.ts fans out to every available retriever and
// merges by score. Tomorrow, a router agent will pick which retrievers to
// call — but the interface stays the same, so callers never change.
// =============================================================================

export type DocumentStatus =
  | 'pending'
  | 'extracting'
  | 'chunking'
  | 'embedding'
  | 'ready'
  | 'failed';

export interface RagDocumentRow {
  id: string;
  user_id: string;
  source: 'pdf';
  filename: string;
  file_size: number;
  total_pages: number | null;
  status: DocumentStatus;
  chunks_count: number;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChunkInput {
  content: string;
  /**
   * Discriminator-free metadata so different ingest sources can attach
   * what makes sense for them:
   *   PDF   → { page, chunk_index }
   *   Excel → { sheet, chunk_index }
   *   URL   → { page: 1, chunk_index, url }
   * The retriever surfaces whichever location field is present.
   */
  metadata: {
    page?: number;
    sheet?: string;
    chunk_index: number;
    url?: string;
  };
}

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  content: string;
  filename: string;
  /** PDF page number, if the chunk came from a PDF. */
  page: number | null;
  /** Excel sheet name, if the chunk came from an Excel file. */
  sheet?: string | null;
  score: number;
  /** Original URL for `source: 'url'` chunks. Stamped at ingest into chunk.metadata.url. */
  sourceUri?: string | null;
}

export interface IngestEvent {
  event: 'started' | 'extracted' | 'chunking' | 'embedding' | 'done' | 'error';
  documentId?: string;
  message?: string;
  /** 0..1 progress within the current stage. */
  progress?: number;
  pages?: number;
  chunks?: number;
}

export interface Retriever {
  /** Stable identifier, e.g. 'pdf', 'google-docs'. */
  id: string;
  /** Human-readable name for UI. */
  name: string;
  /** Whether this retriever has data for this user (DB check). */
  available(userId: string): Promise<boolean>;
  /** Run the actual retrieval. */
  retrieve(userId: string, query: string, k: number): Promise<RetrievedChunk[]>;
}
