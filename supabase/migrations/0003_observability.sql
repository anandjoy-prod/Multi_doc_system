-- =========================================================================
-- 0003_observability.sql — per-call telemetry for LLM + embedding requests.
--
-- Run AFTER 0001_init.sql and 0002_rag.sql. Idempotent.
--
-- Design notes:
--   * One row per outbound API call (chat completion or embedding).
--   * No message content stored — token COUNTS only, plus minimal labels.
--     Keeps PII out of the telemetry table and keeps row size tiny.
--   * `kind` partitions by usage so dashboards can filter cheaply:
--       - 'chat'         → assistant generation
--       - 'embed_query'  → retrieval-time embedding
--       - 'embed_ingest' → PDF ingestion embedding batch
--   * Cost is computed in app code from a pricing table — pre-stored so the
--     dashboard never needs to know prices. If you change models, old rows
--     keep the cost they were recorded with.
-- =========================================================================

CREATE TABLE IF NOT EXISTS llm_calls (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID REFERENCES users(id)         ON DELETE SET NULL,
  session_id           UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
  document_id          UUID REFERENCES rag_documents(id) ON DELETE SET NULL,
  kind                 TEXT NOT NULL CHECK (kind IN ('chat','embed_query','embed_ingest')),
  model                TEXT NOT NULL,
  prompt_tokens        INTEGER,
  completion_tokens    INTEGER,
  total_tokens         INTEGER,
  latency_ms           INTEGER,
  rag_chunks           INTEGER,                        -- # chunks retrieved (chat only)
  estimated_cost_usd   NUMERIC(12, 8),                 -- rounded at write time
  status               TEXT NOT NULL CHECK (status IN ('ok','error')),
  error                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS llm_calls_created_idx
  ON llm_calls (created_at DESC);

CREATE INDEX IF NOT EXISTS llm_calls_user_created_idx
  ON llm_calls (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS llm_calls_kind_created_idx
  ON llm_calls (kind, created_at DESC);
