# How to run the project

You'll need: a free **Supabase** project (DB), a free **GitHub Models** token (LLM), and Node 18.18+.

## 1. Get a Supabase project

1. Sign in at <https://supabase.com> and create a new project (free tier is fine).
2. In the dashboard, open **Project Settings → API**. You'll need:
   - `NEXT_PUBLIC_SUPABASE_URL` — Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon public key
   - `SUPABASE_SERVICE_ROLE_KEY` — service_role key (secret — server-only)

## 2. Run the schema migrations

In the Supabase dashboard, open **SQL Editor → New query**, paste each file, click **Run**.

1. [`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql) — core schema (users, roles, chat, audit, etc.).
2. [`supabase/migrations/0002_rag.sql`](./supabase/migrations/0002_rag.sql) — RAG schema (`rag_documents`, `rag_chunks`, pgvector, hybrid search RPC).

You should see "Success. No rows returned." after each. Both are idempotent — re-running them is safe.

## 3. Get a free GitHub Models token

1. Open <https://github.com/settings/tokens?type=beta> and click **Generate new token** (fine-grained).
   No specific scopes are required for the public Models catalog.
2. Copy the token (you'll only see it once).
3. Optional: browse <https://github.com/marketplace?type=models> to pick a different model than the default `gpt-4o-mini`.

## 4. Generate a JWT secret

The login cookie is signed with HMAC-SHA256, so you need a 32-byte secret.

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## 5. Configure env

```bash
cd "/Users/anandpahade/Desktop/projects/lamaindex_rag"
cp .env.example .env.local
```

Open `.env.local` and set:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# GitHub Models
GITHUB_TOKEN=<paste from step 3>

# Auth
JWT_SECRET=<paste from step 4>

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Optional model overrides:

```env
GITHUB_MODEL=Phi-3.5-mini-instruct
GITHUB_MODELS_BASE_URL=https://models.inference.ai.azure.com
```

## 6. Install + seed + run

```bash
npm install
npm run db:seed     # bcrypt-hashes & inserts the demo users into Supabase
npm run dev
```

The seeder is idempotent — safe to re-run.

## 7. Sign in

Open <http://localhost:3000>. You'll be redirected to `/login`. Sign in with any of:

| Role   | Email             | Password    | Lands on |
| ------ | ----------------- | ----------- | -------- |
| Admin  | `admin@test.com`  | `admin123`  | `/admin` |
| User   | `user@test.com`   | `user123`   | `/chat`  |
| Viewer | `viewer@test.com` | `viewer123` | `/chat` (read-only) |
| User   | `sam@test.com`    | `sam123`    | `/chat`  |
| User   | `lin@test.com`    | `lin123`    | `/chat`  |

## What lives where now

| Concern                         | Location                                  |
| ------------------------------- | ----------------------------------------- |
| Users, roles, sessions, messages | Supabase (`users`, `roles`, `chat_sessions`, `messages`) |
| Auth                             | Custom JWT in httpOnly cookie, bcrypt password hashing |
| Chat memory (last 10 turns)      | `messages` table, ordered by `created_at` |
| LLM                              | GitHub Models, OpenAI-compatible          |
| Dashboard analytics              | Live `count` queries via `lib/analytics.ts` |
| Theme preferences                | `users.theme_preference` + `roles.theme_override` |

## Common issues

**Login fails with "Invalid email or password"**
The seeder hasn't run, or it ran before the migration. Run the migration first (step 2), then `npm run db:seed`. Check the Supabase **Table Editor → users** — you should see five rows.

**Login redirects me back to `/login`**
The JWT cookie is signed with `JWT_SECRET`. If you change the secret without clearing your cookie, the browser sends a token the server can't verify. DevTools → Application → Cookies → delete `session`, sign in again.

**"Model error" in chat**
Confirm `GITHUB_TOKEN` is set in `.env.local` and that you restarted `npm run dev` after editing. Test the token directly:

```bash
curl https://models.inference.ai.azure.com/chat/completions \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hi"}]}'
```

A 401 means the token is wrong; 429 means you've hit the free-tier rate limit (wait a minute).

**"Invalid environment variables" on startup**
The Supabase keys must be present. Check that `.env.local` has all three Supabase variables, that `JWT_SECRET` is at least 32 chars, and that there are no surrounding quotes in the values.

**Empty dashboard**
That's correct on a fresh DB — go to `/chat`, send a message, and the dashboard counts and sparkline will populate.

**Seed reports "row violates row-level security policy"**
RLS is enabled on `chat_sessions`, `messages`, `suggestions`, `integrations` (per the migration). The seed and the app talk to Supabase with the **service-role key**, which bypasses RLS. If you're hitting this, your `SUPABASE_SERVICE_ROLE_KEY` is missing or you accidentally used the anon key.

## RAG over PDFs

Retrieval-augmented chat against your own PDFs. After you finish steps 1–7, sign in as any user and:

1. Open <http://localhost:3000/admin/integrations/pdf> (or click **PDF documents** on the integrations page).
2. Drag a PDF onto the dropzone (or click to pick one). Up to 20 MB.
3. Watch the progress bar walk through `extracting → chunking → embedding → done`.
4. Once status is **Ready**, go to `/chat`, ask a question grounded in the PDF, and you'll see source chips below the assistant's answer. Click a chip to see the snippet.

**How it works (one paragraph):**
PDFs are parsed page-by-page with `unpdf`, split into ~800-character sentence-aware chunks (100-char overlap), embedded with `text-embedding-3-small`, and stored in Supabase pgvector. At chat time we run hybrid search — semantic (cosine on vectors) plus keyword (Postgres full-text on a `tsvector`) — fused with Reciprocal Rank Fusion. The top 5 chunks go into a citation-forced system prompt; the model must answer from context or say it doesn't know. Sources travel back as an `X-Sources` response header so chips render alongside the streamed answer, and they're persisted in `messages.metadata.sources` so chat history round-trips them.

**Token cost:**
A typical question costs roughly 1 embedding call (≈2k tokens at $0.02/1M) + 5 context chunks × ~150 tokens + answer (~200 tokens) ≈ **~1.2k input + 200 output tokens per turn**. On `gpt-4o-mini` that's about $0.0002 per question.

## What's intentionally still a stub

These are wired up enough to demonstrate the pattern, not enough to ship:

- **Integrations connect** (Google Docs, Sheets, Confluence, Postgres) — UI-only flow with a simulated success. PDF is the real one.
- **Production rate limiting** — the in-memory limiter from the original spec is intentionally a no-op (see `CRITIQUE.md` #3 for why and the Upstash upgrade path).

When you're ready to flip these on, see `CRITIQUE.md` for the architectural notes.
