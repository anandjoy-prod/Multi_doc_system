# How to run the UI demo

This is the **UI-only** mode: no database, dummy users, free GitHub Models for the
LLM. Six steps from a fresh clone to a running app.

## 1. Get a free GitHub Models token

GitHub Models gives every personal account free, rate-limited access to a
catalog of frontier models (gpt-4o-mini, Llama, Phi, Mistral, …) over an
OpenAI-compatible API.

1. Sign in to GitHub.
2. Open <https://github.com/settings/tokens?type=beta> and click **Generate new
   token** (a *fine-grained* token works — no specific scopes needed for the
   public Models catalog).
   - If you prefer the classic UI: <https://github.com/settings/tokens> → *Generate
     new token (classic)* → leave all scopes unchecked → generate.
3. Copy the token (it starts with `github_pat_…` for fine-grained or `ghp_…` for
   classic). You will only see it once.
4. Optional: open <https://github.com/marketplace?type=models> and pick a
   different model if you don't want the default `gpt-4o-mini`.

## 2. Generate a JWT secret

The login cookie is signed with HMAC-SHA256, so you need a 32-byte secret. Run
this once and copy the output:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## 3. Configure the env

```bash
cd /Users/anandpahade/Desktop/projects/lamaindex_rag
cp .env.example .env.local
```

Open `.env.local` and set:

```env
GITHUB_TOKEN=<paste the token from step 1>
JWT_SECRET=<paste the value from step 2>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

That's the minimum. Optional overrides:

```env
GITHUB_MODEL=Phi-3.5-mini-instruct        # any model from the catalog
GITHUB_MODELS_BASE_URL=https://models.inference.ai.azure.com   # default
```

## 4. Install dependencies

```bash
npm install
```

(or `pnpm install` / `yarn` — the lockfile is whatever your tool generates)

## 5. Run the dev server

```bash
npm run dev
```

Open <http://localhost:3000>. You'll be redirected to `/login`.

## 6. Sign in with dummy credentials

| Role   | Email             | Password    | Lands on |
| ------ | ----------------- | ----------- | -------- |
| Admin  | `admin@test.com`  | `admin123`  | `/admin` |
| User   | `user@test.com`   | `user123`   | `/chat`  |
| Viewer | `viewer@test.com` | `viewer123` | `/chat` (read-only) |

Two extra seeded users (`sam@test.com` / `sam123`, `lin@test.com` / `lin123`)
exist if you want more rows in the admin table.

## What you can do in the UI

- **Admin dashboard** (`/admin`) — stat cards, sparkline, top-user bar chart, recent activity.
- **Users page** (`/admin/users`) — table with search, role badges, themes, "Invite user" button (alert stub).
- **Roles page** (`/admin/roles`) — three role cards with permissions and theme overrides.
- **Integrations** (`/admin/integrations`) — placeholder list of connectors.
- **Analytics** (`/admin/analytics`) — week sparkline, per-user bar chart.
- **Chat** (`/chat`) — start a conversation, watch tokens stream from GitHub Models, switch between sessions in the left sidebar, delete sessions, switch theme in the top bar. Viewer role gets a read-only state instead of the input box.
- **Theme toggle** — light / dark / system in the top bar of every page. Viewer role has the toggle locked because its `theme_override` is set to `light`.

## Troubleshooting

**Login redirects me back to /login**
The JWT cookie is signed with `JWT_SECRET`. If you change the secret without
clearing your cookie, the browser sends a token the server can't verify.
Open devtools → Application → Cookies → delete `session`, then sign in again.

**Chat says "Model error: …"**
1. Confirm `GITHUB_TOKEN` is set in `.env.local` and that you restarted
   `npm run dev` after editing.
2. Hit GitHub Models directly to confirm the token works:

   ```bash
   curl https://models.inference.ai.azure.com/chat/completions \
     -H "Authorization: Bearer $GITHUB_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hi"}]}'
   ```

   A 401 means the token is wrong; a 429 means you've hit the free-tier rate
   limit (wait a minute and retry).
3. Try a different model: set `GITHUB_MODEL=Phi-3.5-mini-instruct` and restart.

**The dev server complains about JWT_SECRET length**
`JWT_SECRET` must be at least 32 characters. Re-run the `node -e …` command
in step 2 and paste the new value.

**Chat sessions disappeared after restart**
Expected — the in-memory store resets on every dev-server restart. The three
seeded sessions (`Pricing tiers explained`, `Deploying to Vercel`, `Role
management quick check`) come back on next boot.

## What's intentionally missing

This is UI mode. Some things are deliberately stubbed:

- No database (Supabase migration is preserved in `supabase/migrations/` for later).
- Passwords are plaintext in `lib/dummy-data.ts`.
- "Invite user", "Connect integration", and the avatar dropdown are alert/no-op stubs.
- No password reset, no email verification, no MFA.
- No production rate limiting (the in-memory limiter from the original spec is
  gone — see `CRITIQUE.md` for why).

When you're ready to wire it back to a real DB, see `CRITIQUE.md` and the
preserved `supabase/migrations/0001_init.sql`.
