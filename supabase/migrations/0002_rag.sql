-- =========================================================================
-- 0002_rag.sql — RAG schema (PDF ingestion + hybrid vector/keyword search)
--
-- Run this AFTER 0001_init.sql. Idempotent — safe to re-run.
--
-- Design notes:
--   * Two tables: rag_documents (one per file) and rag_chunks (per chunk).
--   * Embedding model: text-embedding-3-small (1536 dims).
--   * Index: ivfflat — fine up to ~1M chunks. Switch to HNSW later if needed.
--   * Full-text: tsvector GENERATED ALWAYS column + GIN index for keyword search.
--   * Retrieval: hybrid_search_rag combines semantic + keyword via Reciprocal
--     Rank Fusion (RRF, k=60). One round-trip.
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ----- rag_documents --------------------------------------------------------
CREATE TABLE IF NOT EXISTS rag_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source          TEXT NOT NULL,                      -- 'pdf' (more later)
  filename        TEXT NOT NULL,
  file_size       INTEGER NOT NULL,
  total_pages     INTEGER,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','extracting','chunking','embedding','ready','failed')),
  chunks_count    INTEGER NOT NULL DEFAULT 0,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rag_documents_user_idx
  ON rag_documents (user_id, created_at DESC);

DROP TRIGGER IF EXISTS rag_documents_set_updated_at ON rag_documents;
CREATE TRIGGER rag_documents_set_updated_at
BEFORE UPDATE ON rag_documents
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----- rag_chunks -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS rag_chunks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     UUID NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
  content         TEXT NOT NULL,
  embedding       vector(1536),
  metadata        JSONB,                              -- { page, chunk_index }
  content_tsv     TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rag_chunks_document_idx
  ON rag_chunks (document_id);

CREATE INDEX IF NOT EXISTS rag_chunks_embedding_idx
  ON rag_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS rag_chunks_tsv_idx
  ON rag_chunks USING GIN (content_tsv);

-- ----- hybrid search (RRF) --------------------------------------------------
-- Returns top match_count chunks combining semantic + keyword ranks.
-- RRF formula: score = sum(1 / (k + rank_i)) where k=60 is the standard.

CREATE OR REPLACE FUNCTION hybrid_search_rag(
  query_text       TEXT,
  query_embedding  vector(1536),
  match_count      INT,
  user_id_filter   UUID
)
RETURNS TABLE(
  chunk_id     UUID,
  document_id  UUID,
  content      TEXT,
  metadata     JSONB,
  score        FLOAT,
  filename     TEXT,
  page         INT
)
LANGUAGE SQL STABLE AS $$
  WITH semantic AS (
    SELECT
      c.id AS cid,
      ROW_NUMBER() OVER (ORDER BY c.embedding <=> query_embedding) AS rank
    FROM rag_chunks c
    JOIN rag_documents d ON d.id = c.document_id
    WHERE d.user_id = user_id_filter
      AND d.status = 'ready'
      AND c.embedding IS NOT NULL
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count * 4
  ),
  keyword AS (
    SELECT
      c.id AS cid,
      ROW_NUMBER() OVER (
        ORDER BY ts_rank(c.content_tsv, websearch_to_tsquery('english', query_text)) DESC
      ) AS rank
    FROM rag_chunks c
    JOIN rag_documents d ON d.id = c.document_id
    WHERE d.user_id = user_id_filter
      AND d.status = 'ready'
      AND c.content_tsv @@ websearch_to_tsquery('english', query_text)
    ORDER BY ts_rank(c.content_tsv, websearch_to_tsquery('english', query_text)) DESC
    LIMIT match_count * 4
  ),
  fused AS (
    SELECT
      COALESCE(s.cid, k.cid)                              AS cid,
      COALESCE(1.0 / (60 + s.rank), 0)
        + COALESCE(1.0 / (60 + k.rank), 0)                AS rrf_score
    FROM semantic s
    FULL OUTER JOIN keyword k ON s.cid = k.cid
  )
  SELECT
    c.id                                                  AS chunk_id,
    c.document_id,
    c.content,
    c.metadata,
    f.rrf_score                                           AS score,
    d.filename,
    NULLIF(c.metadata->>'page','')::INT                   AS page
  FROM fused f
  JOIN rag_chunks    c ON c.id = f.cid
  JOIN rag_documents d ON d.id = c.document_id
  ORDER BY f.rrf_score DESC
  LIMIT match_count;
$$;
