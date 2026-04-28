# AI Chat Application with Role-Based CMS

Smart, simple chat interface with admin control panel — built for scale, delivered lean.

> **Just want to run the demo?** See [`RUN.md`](./RUN.md) — six steps from a clean
> clone to a working app with login, admin dashboard, and streaming chat over a
> free GitHub Models token. No database needed.

The rest of this README is the full product spec; `CRITIQUE.md` lists the
issues we found in it.

## What This Does (Now)

**Two-part system:**

**1. CMS Dashboard (Admin Backend)**

- Create / manage users
- Assign roles & permissions
- Configure Google Docs / Sheets access (OAuth)
- Set chat themes per user / role
- View chat analytics

**2. Chat Application (User Frontend)**

- Login with assigned credentials
- Chat with an AI assistant
- Memory of previous conversations
- Smart suggestions based on chat history
- Dark / light theme (set by admin or user)
- Clean, modern UI

## What This Will Do (Future-Ready Architecture)

Built to scale without rebuilding:

```text
NOW (MVP)                    FUTURE (Scale)
├── OpenAI API          →    LangChain + LangGraph
├── Simple memory       →    LlamaIndex RAG system
├── Google Docs         →    Confluence + PDF + Excel + SQL
├── Dummy data          →    Real enterprise integrations
├── Supabase            →    Supabase + pgvector embeddings
└── Basic chat          →    Multi-agent workflows + LangSmith observability
```

**Key principle:** start simple, scale smart. No over-engineering.

## System Architecture

### Current (MVP)

```text
┌─────────────────────────────────────────────────────────┐
│                      USERS                              │
├──────────────────┬──────────────────────────────────────┤
│      ADMIN       │           CHAT USERS                 │
└────────┬─────────┴─────────────┬────────────────────────┘
         │                       │
   ┌─────▼────────┐         ┌────▼─────────┐
   │ CMS Dashboard│         │ Chat Interface│
   │ (Admin Panel)│         │ (User App)   │
   └─────┬────────┘         └────┬─────────┘
         │                       │
         └──────────┬────────────┘
                    │
           ┌────────▼────────┐
           │  Next.js API    │
           │     Routes      │
           └────────┬────────┘
                    │
         ┌──────────┼──────────┐
         │          │          │
    ┌────▼───┐  ┌──▼───┐  ┌──▼────┐
    │Supabase│  │OpenAI│  │Google │
    │   DB   │  │ API  │  │ OAuth │
    └────────┘  └──────┘  └───────┘
```

### Future (Scale)

```text
                   ┌───────────────┐
                   │  Chat Users   │
                   └───────┬───────┘
                           │
                   ┌───────▼────────┐
                   │  Next.js App   │
                   └───────┬────────┘
                           │
                   ┌───────▼────────┐
                   │  API Gateway   │
                   └───────┬────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼────────┐  ┌─────▼──────┐  ┌────────▼───────┐
   │ LangGraph   │  │ LlamaIndex │  │ Memory System  │
   │ Multi-Agent │  │ RAG Engine │  │ (Redis/Vector) │
   └────┬────────┘  └─────┬──────┘  └────────┬───────┘
        │                 │                  │
        └────────┬────────┴──────────────────┘
                 │
        ┌────────▼──────────┐
        │  Supabase Vector  │
        │  DB (pgvector)    │
        └────────┬──────────┘
                 │
   ┌─────────────┼─────────────┐
   │             │             │
┌──▼──────┐  ┌───▼────┐  ┌────▼────┐
│Confluence│ │ Google │  │   SQL   │
│   API    │ │ Docs / │  │   DBs   │
│          │ │ Sheets │  │         │
└──────────┘ └────────┘  └─────────┘
```

## Quick Start (5 Minutes)

### Prerequisites

- Node.js 18+
- npm or pnpm
- Supabase account (free tier)
- OpenAI API key

### 1. Clone & install

```bash
git clone <repo-url>
cd ai-chat-cms
npm install
```

### 2. Environment setup

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# OpenAI
OPENAI_API_KEY=sk-proj-xxxxx

# Google OAuth (for Docs / Sheets)
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxx

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
JWT_SECRET=your-random-secret-key
```

### 3. Database setup

```bash
# Run SQL migrations in Supabase dashboard, or:
npx supabase db push
```

### 4. Run dev server

```bash
npm run dev
```

**Access:**

- CMS Dashboard: `http://localhost:3000/admin`
- Chat App: `http://localhost:3000/chat`
- Default admin: `admin@example.com` / `admin123`

## Project Structure

```text
ai-chat-cms/
├── app/
│   ├── (admin)/              # CMS Dashboard routes
│   │   ├── admin/
│   │   │   ├── dashboard/
│   │   │   ├── users/
│   │   │   ├── roles/
│   │   │   ├── integrations/
│   │   │   └── analytics/
│   │   └── layout.tsx
│   │
│   ├── (chat)/               # User Chat routes
│   │   ├── chat/
│   │   │   └── [sessionId]/
│   │   └── layout.tsx
│   │
│   ├── api/                  # API Routes
│   │   ├── auth/
│   │   ├── chat/
│   │   ├── users/
│   │   ├── google/
│   │   └── admin/
│   │
│   └── layout.tsx
│
├── components/
│   ├── admin/                # CMS components
│   │   ├── UserTable.tsx
│   │   ├── RoleManager.tsx
│   │   └── ThemeConfigurator.tsx
│   │
│   ├── chat/                 # Chat components
│   │   ├── ChatInterface.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── ChatInput.tsx
│   │   └── Suggestions.tsx
│   │
│   └── shared/               # Reusable components
│       ├── ThemeToggle.tsx
│       └── Sidebar.tsx
│
├── lib/
│   ├── supabase.ts           # Supabase clients (server + browser)
│   ├── openai.ts             # OpenAI client
│   ├── auth.ts               # Auth utilities
│   └── types.ts              # TypeScript types
│
├── styles/
│   └── globals.css           # Global styles + themes
│
└── public/
    └── dummy-data/           # Sample data for testing
```

## Database Schema (Supabase)

The full, runnable migration lives in `supabase/migrations/0001_init.sql`. The shapes below are documentation; the migration file is the source of truth.

### Core tables

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role_id UUID REFERENCES roles(id),
  theme_preference TEXT DEFAULT 'system', -- 'light' | 'dark' | 'system'
  google_credentials JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

-- Roles
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,        -- 'admin' | 'user' | 'viewer'
  permissions JSONB NOT NULL,
  theme_override TEXT,              -- force theme for users with this role
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat sessions
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,              -- 'user' | 'assistant' | 'system'
  content TEXT NOT NULL,
  metadata JSONB,                  -- future: embeddings, sources
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Suggestions
CREATE TABLE suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  suggestion_text TEXT NOT NULL,
  trigger_keywords TEXT[],
  usage_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Integrations
CREATE TABLE integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  type TEXT NOT NULL,              -- 'google_docs' | 'google_sheets'
  credentials JSONB NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Future-ready tables

```sql
-- For RAG (LlamaIndex)
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  source TEXT NOT NULL,            -- 'confluence' | 'google_docs' | 'pdf'
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vector store (run when ready)
-- CREATE EXTENSION vector;
-- ALTER TABLE documents ADD COLUMN embedding vector(1536);
-- CREATE INDEX ON documents USING ivfflat (embedding vector_cosine_ops);
```

## Design System

**Aesthetic:** modern editorial dark.

- Clean, readable typography
- High contrast for dark mode
- Soft, ambient light mode
- Subtle animations
- Professional yet approachable

### Color palette

**Dark theme:**

```css
--bg-primary:      #0a0e14;
--bg-secondary:    #12161d;
--bg-tertiary:     #1a1f29;
--text-primary:    #e6e8eb;
--text-secondary:  #9ca3af;
--accent-primary:  #3b82f6;
--accent-success:  #10b981;
--accent-warning:  #f59e0b;
--accent-error:    #ef4444;
--border:          #1f2937;
```

**Light theme:**

```css
--bg-primary:      #ffffff;
--bg-secondary:    #f9fafb;
--bg-tertiary:     #f3f4f6;
--text-primary:    #111827;
--text-secondary:  #6b7280;
--accent-primary:  #2563eb;
--accent-success:  #059669;
--accent-warning:  #d97706;
--accent-error:    #dc2626;
--border:          #e5e7eb;
```

### Typography

```css
--font-display: 'Cal Sans', 'Satoshi', system-ui;
--font-body:    'Inter Variable', -apple-system, sans-serif;
--font-mono:    'JetBrains Mono', 'Fira Code', monospace;
```

### Key UI patterns

**Chat bubbles:**

- User: right-aligned, accent color
- Assistant: left-aligned, secondary background
- Rounded corners: 16px
- Subtle shadow in light mode, border glow in dark mode

**Admin dashboard:**

- Card-based layout
- Glassmorphism for data cards
- Smooth transitions (200ms ease)
- Hover states with color shift

## Authentication & Roles

### Role hierarchy

```typescript
type RoleDefinition = {
  admin: {
    permissions: ['all'];
    features: ['user_management', 'role_management', 'analytics', 'integrations'];
  };
  user: {
    permissions: ['chat', 'view_history'];
    features: ['chat', 'suggestions', 'theme_toggle'];
  };
  viewer: {
    permissions: ['view_only'];
    features: ['read_chats']; // no sending messages
  };
};
```

### JWT flow

```text
1. User logs in → server validates credentials
2. Generate JWT with: { userId, roleId, permissions }
3. Store JWT in httpOnly cookie
4. Middleware validates JWT on protected routes
5. Pass user context to components
```

## Chat Features

### Current

1. **Message streaming** — real-time chunk-by-chunk display.
2. **Chat memory** — last 10 messages in context, stored in Supabase.
3. **Suggestions** — keyword-triggered prompts based on history.
4. **Theme switching** — per-user preference, with optional role override.

### Future (architecture-ready)

```typescript
// When you add RAG:
interface ChatRequest {
  message: string;
  sessionId: string;
  context?: {
    documents?: string[]; // doc IDs
    sources?: string[];   // 'confluence' | 'google_docs' | ...
  };
}

// When you add LangGraph:
interface AgentWorkflow {
  router: 'decide if RAG needed';
  retriever: 'fetch relevant documents';
  synthesizer: 'generate answer';
  memory: 'update user memory';
}
```

## Integrations

### Google OAuth setup

1. **Create OAuth credentials**
   - Google Cloud Console → OAuth 2.0 Client ID
   - Authorized redirect URI: `http://localhost:3000/api/auth/google/callback`

2. **Scopes**

   ```typescript
   const GOOGLE_SCOPES = [
     'https://www.googleapis.com/auth/documents.readonly',
     'https://www.googleapis.com/auth/spreadsheets.readonly',
     'https://www.googleapis.com/auth/userinfo.email',
   ];
   ```

3. **Stored credentials shape**

   ```typescript
   {
     user_id: 'uuid',
     google_credentials: {
       access_token: 'xxx',
       refresh_token: 'xxx',
       expires_at: 'timestamp'
     }
   }
   ```

### Future integrations (hooks ready)

```typescript
// lib/integrations.ts (create when needed)

export async function connectConfluence(userId: string, credentials: ConfluenceAuth) {
  // Save to integrations table
}

export async function ingestPDF(userId: string, file: File) {
  // Parse → chunk → embed → store
}

export async function connectDatabase(userId: string, connectionString: string) {
  // Validate → store connection
}
```

## API Routes

### Chat

**POST `/api/chat/send`**

```typescript
// Request
{ sessionId: string; message: string }

// Response (streaming)
{ type: 'chunk' | 'done'; content: string; suggestions?: string[] }
```

**GET `/api/chat/history/:sessionId`**

```typescript
// Response
{
  messages: Message[];
  session: { id: string; title: string; createdAt: string };
}
```

### Admin

**POST `/api/admin/users`**

```typescript
{
  email: string;
  password: string;
  roleId: string;
  themePreference?: 'light' | 'dark' | 'system';
}
```

**PATCH `/api/admin/users/:id/role`**

```typescript
{ roleId: string }
```

**POST `/api/admin/integrations/google`**

```typescript
{ userId: string; authCode: string }
```

## Sample Data (Dummy)

The seed inserts in `supabase/migrations/0001_init.sql` create the three default roles and three test users.

```sql
-- Roles must be inserted before users (FK dependency)
INSERT INTO roles (name, permissions) VALUES
  ('admin',  '{"all": true}'),
  ('user',   '{"chat": true, "view_history": true}'),
  ('viewer', '{"view_only": true}');

INSERT INTO users (email, password_hash, role_id, theme_preference) VALUES
  ('admin@test.com',  '$2a$...', (SELECT id FROM roles WHERE name = 'admin'),  'dark'),
  ('user1@test.com',  '$2a$...', (SELECT id FROM roles WHERE name = 'user'),   'light'),
  ('viewer@test.com', '$2a$...', (SELECT id FROM roles WHERE name = 'viewer'), 'system');
```

## Development Workflow

### Phase 1: MVP (week 1–2)

- [ ] Project setup (Next.js + TypeScript + Supabase)
- [ ] Database schema creation
- [ ] Authentication system (email / password)
- [ ] CMS Dashboard: user CRUD, role management, basic analytics
- [ ] Chat Interface: send/receive, session management, last-10 memory
- [ ] Theme system (dark / light)

### Phase 2: Polish (week 3)

- [ ] Google OAuth integration
- [ ] Chat suggestions (keyword-based)
- [ ] Better UI animations
- [ ] Admin dashboard charts
- [ ] Mobile responsive

### Phase 3: Future-proofing (week 4)

- [ ] Add pgvector extension (don't use yet)
- [ ] Create documents table structure
- [ ] Add embedding column (empty for now)
- [ ] Implement API hooks for future integrations
- [ ] Documentation for scaling

## Future Scaling Path

### When you're ready to add RAG

1. Install dependencies:

   ```bash
   npm install langchain @langchain/openai llamaindex
   ```

2. Enable pgvector:

   ```sql
   CREATE EXTENSION vector;
   ALTER TABLE documents ADD COLUMN embedding vector(1536);
   CREATE INDEX ON documents USING ivfflat (embedding vector_cosine_ops);
   ```

3. Create ingestion pipeline:

   ```typescript
   // lib/rag/ingest.ts
   import { LlamaIndex } from 'llamaindex';

   export async function ingestDocument(source: DocumentSource) {
     // Parse → chunk → embed → store
   }
   ```

4. Update chat API:

   ```typescript
   import { retrieveRelevantDocs } from '@/lib/rag/retrieve';

   const relevantDocs = await retrieveRelevantDocs(message, userId);
   const context = relevantDocs.map(d => d.content).join('\n');
   ```

### When you're ready for multi-agent

```typescript
// lib/agents/workflow.ts
import { StateGraph } from '@langchain/langgraph';

const workflow = new StateGraph({ /* ... */ })
  .addNode('router',    routerAgent)
  .addNode('retriever', retrieverAgent)
  .addNode('generator', generatorAgent);
```

## Tech Stack

### Core

- **Frontend:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Database:** Supabase (PostgreSQL)
- **Auth:** custom JWT over Supabase tables (see `CRITIQUE.md` for the trade-off vs Supabase Auth)
- **AI:** OpenAI API

### UI / Styling

- **Styling:** Tailwind CSS
- **Components:** shadcn/ui (when needed)
- **Icons:** Lucide React
- **Animations:** Framer Motion (optional)

### Future (when scaling)

- **RAG:** LlamaIndex
- **Agents:** LangChain + LangGraph (TS bindings)
- **Observability:** LangSmith
- **Vector DB:** Supabase pgvector
- **Cache:** Redis / Upstash (for distributed rate limiting)

## Suggestions & Improvements

See `CRITIQUE.md` for a list of concrete fixes (auth strategy, theme precedence, distributed rate limiting, RLS policies, audit logs) before you start coding.

## Deployment

### Vercel

```bash
npm i -g vercel
vercel          # preview
vercel --prod   # production
```

Add all `.env.local` variables in the Vercel dashboard.

## License

MIT.

## Final Notes

**Philosophy:**

- Build what you need now
- Architect for what you need later
- Never over-engineer
- Always leave hooks for growth

**This project gives you:**

- Working MVP in two weeks
- Clean, maintainable code
- Modern, beautiful UI
- Ready to scale when you are

When you're ready to scale: uncomment the future-ready code, run the scaling migrations, add the dependencies. Everything just works.
