-- =========================================================================
-- 0001_init.sql — initial schema for the AI Chat + CMS app
--
-- Safe to re-run: every CREATE uses IF NOT EXISTS, every seed uses
-- ON CONFLICT DO NOTHING.
--
-- Decisions baked in (see CRITIQUE.md for rationale):
--   * Custom JWT auth — `users` owns `password_hash`.
--   * `permissions` is TEXT[] not JSONB — easier to query, '*' is the wildcard.
--   * `theme_override` (role) wins over `theme_preference` (user).
--   * `integrations` is the single source of truth for OAuth credentials.
--   * `updated_at` is bumped by a trigger, not just on insert.
--   * RLS is ENABLED on user-scoped tables; policies expect the request
--     to set `app.current_user_id` to the authenticated user's UUID.
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----- helper: bump updated_at on UPDATE -----
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================================================================
-- roles
-- =========================================================================
CREATE TABLE IF NOT EXISTS roles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT UNIQUE NOT NULL,             -- 'admin' | 'user' | 'viewer' | ...
  permissions     TEXT[] NOT NULL DEFAULT '{}',     -- '*' is the wildcard
  theme_override  TEXT CHECK (theme_override IN ('light', 'dark', 'system')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================================
-- users
-- =========================================================================
CREATE TABLE IF NOT EXISTS users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email               TEXT UNIQUE NOT NULL,
  password_hash       TEXT NOT NULL,
  role_id             UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  theme_preference    TEXT NOT NULL DEFAULT 'system'
                      CHECK (theme_preference IN ('light', 'dark', 'system')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS users_role_idx ON users (role_id);

-- =========================================================================
-- chat_sessions
-- =========================================================================
CREATE TABLE IF NOT EXISTS chat_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_sessions_user_updated_idx
  ON chat_sessions (user_id, updated_at DESC);

DROP TRIGGER IF EXISTS chat_sessions_set_updated_at ON chat_sessions;
CREATE TRIGGER chat_sessions_set_updated_at
BEFORE UPDATE ON chat_sessions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================================
-- messages
-- =========================================================================
CREATE TABLE IF NOT EXISTS messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content     TEXT NOT NULL,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS messages_session_created_idx
  ON messages (session_id, created_at);

-- =========================================================================
-- suggestions  (kept simple for MVP; see CRITIQUE.md #7 for the upgrade path)
-- =========================================================================
CREATE TABLE IF NOT EXISTS suggestions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  suggestion_text   TEXT NOT NULL,
  trigger_keywords  TEXT[] NOT NULL DEFAULT '{}',
  usage_count       INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS suggestions_user_idx ON suggestions (user_id);

-- =========================================================================
-- integrations  (single source of truth for OAuth credentials)
-- =========================================================================
CREATE TABLE IF NOT EXISTS integrations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,                       -- 'google_docs' | 'google_sheets' | ...
  credentials  JSONB NOT NULL,                      -- encrypt at rest in prod (see CRITIQUE.md #8)
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, type)
);

CREATE INDEX IF NOT EXISTS integrations_user_active_idx
  ON integrations (user_id) WHERE is_active;

-- =========================================================================
-- audit_logs  (see CRITIQUE.md #13)
-- =========================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,                        -- 'user.create', 'role.change', ...
  target_id   UUID,                                 -- the user/role/etc. acted on
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_actor_created_idx
  ON audit_logs (actor_id, created_at DESC);

-- =========================================================================
-- documents  (future-ready for RAG; embedding column commented out)
-- =========================================================================
CREATE TABLE IF NOT EXISTS documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  source      TEXT NOT NULL,                        -- 'confluence' | 'google_docs' | 'pdf' | ...
  content     TEXT NOT NULL,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS documents_user_idx ON documents (user_id);

-- When you turn on RAG:
--   CREATE EXTENSION vector;
--   ALTER TABLE documents ADD COLUMN embedding vector(1536);
--   CREATE INDEX documents_embedding_idx
--     ON documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- =========================================================================
-- RLS — custom-JWT path
--
-- The API sets `app.current_user_id` to the authenticated user's UUID and
-- `app.is_admin` to 'true'/'false' before issuing queries with the
-- (non-service-role) anon connection. Policies enforce ownership.
-- =========================================================================

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations  ENABLE ROW LEVEL SECURITY;

-- helper: read the current user UUID from the GUC, NULL-safe
CREATE OR REPLACE FUNCTION current_app_user_id() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::UUID;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION current_app_is_admin() RETURNS BOOLEAN AS $$
  SELECT COALESCE(NULLIF(current_setting('app.is_admin', true), ''), 'false')::BOOLEAN;
$$ LANGUAGE SQL STABLE;

-- chat_sessions: owners read/write; admins read all
DROP POLICY IF EXISTS chat_sessions_owner_rw ON chat_sessions;
CREATE POLICY chat_sessions_owner_rw ON chat_sessions
  USING (user_id = current_app_user_id() OR current_app_is_admin())
  WITH CHECK (user_id = current_app_user_id());

-- messages: owners (via session) read/write; admins read all
DROP POLICY IF EXISTS messages_owner_rw ON messages;
CREATE POLICY messages_owner_rw ON messages
  USING (
    EXISTS (
      SELECT 1 FROM chat_sessions s
      WHERE s.id = messages.session_id
        AND (s.user_id = current_app_user_id() OR current_app_is_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_sessions s
      WHERE s.id = messages.session_id AND s.user_id = current_app_user_id()
    )
  );

-- suggestions: per-user
DROP POLICY IF EXISTS suggestions_owner_rw ON suggestions;
CREATE POLICY suggestions_owner_rw ON suggestions
  USING (user_id = current_app_user_id() OR current_app_is_admin())
  WITH CHECK (user_id = current_app_user_id());

-- integrations: per-user, never read by others (admins included for now)
DROP POLICY IF EXISTS integrations_owner_rw ON integrations;
CREATE POLICY integrations_owner_rw ON integrations
  USING (user_id = current_app_user_id())
  WITH CHECK (user_id = current_app_user_id());

-- =========================================================================
-- Seeds — idempotent
-- =========================================================================

INSERT INTO roles (name, permissions, theme_override) VALUES
  ('admin',  ARRAY['*'],                       NULL),
  ('user',   ARRAY['chat', 'view_history'],    NULL),
  ('viewer', ARRAY['view_only'],               NULL)
ON CONFLICT (name) DO NOTHING;

-- The default admin is created by the app on first boot from the
-- INITIAL_ADMIN_EMAIL / INITIAL_ADMIN_PASSWORD env vars (see lib/auth.ts).
-- We do NOT seed credentials here — see CRITIQUE.md #14.
