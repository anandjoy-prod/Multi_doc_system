# Spec Critique — Concrete Issues & Fixes

This is a review of the AI Chat + CMS spec in `README.md`. The spec is solid in shape but has several inconsistencies, gaps, and decisions that will bite you in production. Each item below names the issue, why it matters, and the recommended fix.

## 1. Auth strategy is contradictory

**Issue.** The "Tech Stack" section lists *"Auth: Supabase Auth + JWT"*, but the schema defines `users.password_hash` and the JWT-flow section describes signing your own tokens with `JWT_SECRET`. Those are two different auth systems.

**Why it matters.** If you wire up Supabase Auth (`auth.users`), you do **not** store `password_hash` yourself — Supabase manages credentials, sessions, and password reset flows. If you go custom JWT, you give up Supabase's row-level security tied to `auth.uid()` and have to implement reset / verification yourself.

**Fix — pick one and commit:**

| Option | When it's right | Cost |
| --- | --- | --- |
| **Supabase Auth** | You want password reset, magic links, OAuth, MFA, RLS via `auth.uid()` for free. | Your `users` table becomes a **profile** table keyed by `auth.uid()` — no `password_hash` column. |
| **Custom JWT over your tables** | You want full control of the token shape, claim contents, multi-tenant routing. | You have to build verification, reset, refresh, and write RLS policies that read your custom claim from a JWT helper. |

The scaffold in this repo defaults to **custom JWT** (because the schema in the spec already has `password_hash`). If you'd rather use Supabase Auth, drop the password column and re-do `lib/auth.ts`.

## 2. Theme precedence is undefined

**Issue.** `users.theme_preference` and `roles.theme_override` both exist, but the spec never says which wins, or what "override" means when set to `NULL`.

**Fix.** Define it explicitly:

> Effective theme = `roles.theme_override ?? users.theme_preference ?? 'system'`.
>
> A non-null `theme_override` is a *force* — the user's toggle is hidden in the UI.

Add a comment to that effect on the `theme_override` column and centralize the resolution in one helper (`lib/theme.ts`) so the chat UI and the CMS render the same answer.

## 3. In-memory rate limiter won't work on Vercel

**Issue.** The "Rate Limiting (Simple version)" snippet uses `new Map()` in module scope. On Vercel (and any serverless platform), each invocation is a separate function instance, so the map is effectively empty every request. The limiter does nothing.

**Fix.** Use a shared store. Two cheap options:

- **Upstash Redis** + `@upstash/ratelimit` — free tier handles this case, two lines of code.
- **Supabase table** with `INSERT ... ON CONFLICT` and a `created_at` window — slower but no extra service.

If you genuinely need only single-region, single-instance dev mode, fine — but mark the snippet `// dev only` so future you doesn't ship it.

## 4. Role/user seed has FK ordering and idempotency problems

**Issue.** The dummy `INSERT` statements work in a fresh DB but fail on re-run (no `ON CONFLICT`), and if anyone ever re-orders the inserts (users before roles) the FK lookup `(SELECT id FROM roles WHERE name = ...)` returns nothing and the insert silently writes `NULL` into `role_id`.

**Fix.** Make seeds idempotent and assertive:

```sql
INSERT INTO roles (name, permissions) VALUES
  ('admin',  '{"all": true}'),
  ('user',   '{"chat": true, "view_history": true}'),
  ('viewer', '{"view_only": true}')
ON CONFLICT (name) DO NOTHING;

-- Then, with a guard:
INSERT INTO users (email, password_hash, role_id, theme_preference)
SELECT 'admin@test.com', '$2a$...', r.id, 'dark' FROM roles r WHERE r.name = 'admin'
ON CONFLICT (email) DO NOTHING;
```

The migration file in `supabase/migrations/0001_init.sql` does it this way.

## 5. Row-level security is missing entirely

**Issue.** The spec relies on application-layer checks (the API route reads the JWT and filters by `userId`). That's fine until someone — including future-you — forgets the `WHERE user_id = $current_user` clause on a query that uses the service-role key. Then user A can read user B's chat history.

**Fix.** Enable RLS on `chat_sessions`, `messages`, `suggestions`, `integrations`, and write policies. If you stay on custom JWT, you'll need to set a session variable (`SET app.current_user_id`) before queries and reference it in policies. If you switch to Supabase Auth, use `auth.uid()`. The migration includes a commented-out RLS template for both paths.

## 6. Mixed TypeScript / Python dependencies

**Issue.** The "future scaling" section says:

```bash
npm install langchain @langchain/openai llamaindex
pip install langsmith langgraph
```

That mixes the Node and Python ecosystems. You can't `import` Python packages from a Next.js API route — they'd need a separate Python service. This is a real architectural decision, not a one-liner install.

**Fix.** Pick a runtime up front:

- **All TS** — `langchain`, `@langchain/langgraph`, `@langchain/openai`, `llamaindex` (the TS port). Simplest deployment story (everything is one Vercel project).
- **Polyglot** — keep Next.js for the app, run a separate Python FastAPI service for the agent layer. Required if you need Python-only libs (e.g. `dspy`, certain `llama-index` integrations, `langchain` Python community packages). Add the service URL to env, treat it as a private API.

The README has been updated to say "LangChain + LangGraph (TS bindings)" — confirm that's what you want before installing anything.

## 7. Suggestions table is too naive to be useful

**Issue.** `suggestions.trigger_keywords TEXT[]` with substring matching is a 2010 chatbot pattern. It will fire constantly on common words and almost never on what the user actually means.

**Fix — two paths:**

- **Cheap:** drop the keyword array. Generate suggestions on the fly from the last N messages with a small LLM call (`gpt-4o-mini`) that returns 3 short follow-ups. Cache by session.
- **Future:** when you turn on pgvector, embed historical user questions and surface the top-K nearest as suggested follow-ups. This is what the `documents` table is set up for.

Either way the table as designed is not pulling its weight.

## 8. `google_credentials` stored as plain JSONB

**Issue.** OAuth refresh tokens are durable secrets — they don't expire on their own. If your DB leaks, every connected user's Google account leaks with it.

**Fix.** At minimum, encrypt at rest with `pgcrypto`:

```sql
-- Once
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Insert
INSERT INTO integrations (user_id, type, credentials)
VALUES ($1, 'google_docs',
        pgp_sym_encrypt($2::text, current_setting('app.settings.encryption_key')));

-- Read
SELECT pgp_sym_decrypt(credentials::bytea,
                       current_setting('app.settings.encryption_key'))::jsonb;
```

Better: use a managed secret store (Vercel KV, Doppler, AWS Secrets Manager). Don't put refresh tokens in the same table you query from the dashboard.

## 9. `users.google_credentials` and `integrations` table both store the same thing

**Issue.** `users.google_credentials JSONB` *and* `integrations(type='google_docs', credentials JSONB)` are two places to store the same data. New devs won't know which is canonical.

**Fix.** Drop `users.google_credentials`. Always go through `integrations`. One row per (user, type) — add `UNIQUE (user_id, type)`. The migration enforces this.

## 10. No `updated_at` triggers

**Issue.** `chat_sessions.updated_at DEFAULT NOW()` only sets the column on insert. UPDATEs won't bump it, so the field is misleading.

**Fix.** Add a trigger:

```sql
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER chat_sessions_updated_at
BEFORE UPDATE ON chat_sessions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

Included in the migration.

## 11. No indexes on hot paths

**Issue.** Every chat-history fetch does `WHERE session_id = $1 ORDER BY created_at`. With no index, that's a full scan of `messages` once you have any volume.

**Fix.** Add:

```sql
CREATE INDEX messages_session_created_idx
  ON messages (session_id, created_at);

CREATE INDEX chat_sessions_user_updated_idx
  ON chat_sessions (user_id, updated_at DESC);
```

Both are in the migration.

## 12. `permissions JSONB` with `'{"all": true}'` is hard to query

**Issue.** Checking "does this user have permission X?" against arbitrary JSON is slow and error-prone. `'all: true'` as a sentinel is special-case code in every check.

**Fix.** Use an enum + a permissions table, or at minimum a `TEXT[]`:

```sql
permissions TEXT[] NOT NULL DEFAULT '{}'
-- admin:  ARRAY['*']
-- user:   ARRAY['chat', 'view_history']
-- viewer: ARRAY['view_only']
```

Then `'*' = ANY(permissions) OR 'chat' = ANY(permissions)` is one operator. The migration uses the array form.

## 13. No audit log despite an "Audit Logs" suggestion

**Issue.** The spec says "Audit Logs (For compliance)" in the *suggestions* section but never builds them. Auditing user-management actions (role changes, integration connects) is genuinely cheap to add now and impossible to backfill later.

**Fix.** Add `audit_logs` to the initial migration. Every admin endpoint writes one row. Done. Included in `0001_init.sql`.

## 14. "Default admin: admin@example.com / admin123"

**Issue.** A weak hardcoded admin password documented in the public README is the textbook way to ship a backdoor. Even with a fresh install someone will forget to change it.

**Fix.** Generate the admin password on first boot, print it once to the server log, and require a reset on first login. Or require the operator to set `INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD` env vars before the seed runs and refuse to start if they're missing.

## 15. Streaming response shape is non-standard

**Issue.** The chat endpoint streams a custom `{ type: 'chunk' | 'done', content, suggestions? }` JSON envelope. That works, but most front-end libs (`@ai-sdk/react`, `useChat`, etc.) expect the Vercel AI SDK protocol or raw SSE. Rolling your own means writing a custom parser on the client.

**Fix.** Either use the Vercel AI SDK (`ai` package) which handles streaming end-to-end, or commit to SSE (`Content-Type: text/event-stream`) so any standard `EventSource` consumer works. The scaffold uses the AI SDK.

## 16. No CSRF protection on cookie auth

**Issue.** httpOnly cookie + JWT is great for protecting against XSS *exfiltration*, but it does nothing against CSRF. State-changing endpoints (`/api/admin/*`, `/api/chat/send`) are vulnerable to a malicious site POSTing on the user's behalf.

**Fix.** Either use `SameSite=Lax` + double-submit token, or skip cookies and put the JWT in `Authorization: Bearer` (which CSRF can't reach because cross-origin requests can't read storage). The scaffold uses `SameSite=Lax` cookies and validates `Origin` for write methods.

## What the scaffold in this repo does

The scaffold (`package.json`, `supabase/migrations/0001_init.sql`, `lib/*`, `app/api/*`) makes opinionated choices on each item above:

- Custom JWT auth (#1) — switch to Supabase Auth later if you'd rather.
- Theme resolution helper in `lib/theme.ts` (#2).
- Rate limiter wired to Upstash with an in-memory dev fallback (#3).
- Idempotent seeds in the migration (#4).
- RLS template for the custom-JWT path (#5).
- TS-only stack — no Python (#6).
- Suggestions left as a TODO with an LLM-call comment (#7).
- `integrations` is the single source of credentials (#9), with an encryption note in the migration (#8).
- `updated_at` trigger and indexes included (#10, #11).
- `permissions TEXT[]` (#12).
- `audit_logs` table + helper (#13).
- First-boot admin requires env vars (#14).
- Vercel AI SDK streaming (#15).
- `SameSite=Lax` cookies + Origin check (#16).

Each is reversible — they're scaffold defaults, not commitments.
