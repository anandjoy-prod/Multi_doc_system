-- =========================================================================
-- 0004_rag_orgwide.sql — make RAG retrieval org-wide instead of per-user.
--
-- Run AFTER 0003. Idempotent.
--
-- Why: a team RAG knowledge base is most useful when everyone can query it,
-- not just the person who uploaded each document. Ownership is preserved
-- in `rag_documents.user_id` and enforced for delete operations in app code.
-- Reads are org-wide.
--
-- Change: hybrid_search_rag's `user_id_filter` parameter becomes optional —
-- pass NULL (or omit) for org-wide search; pass a UUID for per-user search.
-- =========================================================================

CREATE OR REPLACE FUNCTION hybrid_search_rag(
  query_text       TEXT,
  query_embedding  vector(1536),
  match_count      INT,
  user_id_filter   UUID DEFAULT NULL
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
    WHERE (user_id_filter IS NULL OR d.user_id = user_id_filter)
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
    WHERE (user_id_filter IS NULL OR d.user_id = user_id_filter)
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
