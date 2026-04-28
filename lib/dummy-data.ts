// =============================================================================
// Dummy data for the UI-only demo. Plaintext passwords on purpose — no DB,
// no hashing, no encryption. Replace with the real DB layer when ready.
// =============================================================================

import type { Theme, RoleName } from './types';

export interface DummyRole {
  id: string;
  name: RoleName;
  permissions: string[];
  theme_override: Theme | null;
  description: string;
}

export interface DummyUser {
  id: string;
  email: string;
  password: string; // plaintext — dummy only
  name: string;
  role_id: string;
  theme_preference: Theme;
  created_at: string;
  last_login: string | null;
}

export const ROLES: DummyRole[] = [
  {
    id: 'role-admin',
    name: 'admin',
    permissions: ['*'],
    theme_override: null,
    description: 'Full access — manage users, roles, integrations.',
  },
  {
    id: 'role-user',
    name: 'user',
    permissions: ['chat', 'view_history'],
    theme_override: null,
    description: 'Standard chat user with full conversation access.',
  },
  {
    id: 'role-viewer',
    name: 'viewer',
    permissions: ['view_only'],
    theme_override: 'light',
    description: 'Read-only — can view chats but not send messages.',
  },
];

export const USERS: DummyUser[] = [
  {
    id: 'user-admin',
    email: 'admin@test.com',
    password: 'admin123',
    name: 'Aria Admin',
    role_id: 'role-admin',
    theme_preference: 'dark',
    created_at: '2026-01-12T09:00:00Z',
    last_login: '2026-04-27T18:42:00Z',
  },
  {
    id: 'user-user',
    email: 'user@test.com',
    password: 'user123',
    name: 'Uma User',
    role_id: 'role-user',
    theme_preference: 'system',
    created_at: '2026-02-03T11:30:00Z',
    last_login: '2026-04-28T08:11:00Z',
  },
  {
    id: 'user-viewer',
    email: 'viewer@test.com',
    password: 'viewer123',
    name: 'Vince Viewer',
    role_id: 'role-viewer',
    theme_preference: 'light',
    created_at: '2026-03-18T15:05:00Z',
    last_login: null,
  },
  {
    id: 'user-extra-1',
    email: 'sam@test.com',
    password: 'sam123',
    name: 'Sam Carter',
    role_id: 'role-user',
    theme_preference: 'dark',
    created_at: '2026-03-22T10:00:00Z',
    last_login: '2026-04-26T14:00:00Z',
  },
  {
    id: 'user-extra-2',
    email: 'lin@test.com',
    password: 'lin123',
    name: 'Lin Park',
    role_id: 'role-user',
    theme_preference: 'system',
    created_at: '2026-04-05T16:45:00Z',
    last_login: '2026-04-28T09:32:00Z',
  },
];

export function findUserByEmail(email: string): DummyUser | undefined {
  return USERS.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export function findRoleById(id: string): DummyRole | undefined {
  return ROLES.find((r) => r.id === id);
}

export function findUserById(id: string): DummyUser | undefined {
  return USERS.find((u) => u.id === id);
}

// ---- Sample chat sessions (seeded into the in-memory store on first read) ---

export interface SampleSession {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
}

export const SAMPLE_SESSIONS: SampleSession[] = [
  {
    id: 'sess-001',
    user_id: 'user-user',
    title: 'Pricing tiers explained',
    created_at: '2026-04-25T10:00:00Z',
    updated_at: '2026-04-25T10:08:00Z',
    messages: [
      { role: 'user', content: 'How does pricing work?' },
      {
        role: 'assistant',
        content:
          'We have three tiers: Starter ($0), Pro ($29/mo), and Team ($99/mo). The main differences are seats, message volume, and admin features.',
      },
      { role: 'user', content: 'What does the Pro tier include?' },
      {
        role: 'assistant',
        content:
          'Pro gives you unlimited messages, faster models, chat history export, and priority support. It is billed monthly and you can cancel any time.',
      },
    ],
  },
  {
    id: 'sess-002',
    user_id: 'user-user',
    title: 'Deploying to Vercel',
    created_at: '2026-04-27T14:15:00Z',
    updated_at: '2026-04-27T14:22:00Z',
    messages: [
      { role: 'user', content: 'What do I need to deploy this to Vercel?' },
      {
        role: 'assistant',
        content:
          'Connect your GitHub repo, set the env vars (GITHUB_TOKEN, JWT_SECRET, NEXT_PUBLIC_APP_URL), and click Deploy. The first build takes about two minutes.',
      },
    ],
  },
  {
    id: 'sess-003',
    user_id: 'user-admin',
    title: 'Role management quick check',
    created_at: '2026-04-28T08:55:00Z',
    updated_at: '2026-04-28T08:59:00Z',
    messages: [
      { role: 'user', content: 'Summarise role differences in one sentence each.' },
      {
        role: 'assistant',
        content:
          'Admin can do everything; user can chat and view their own history; viewer is read-only and cannot send messages.',
      },
    ],
  },
];

// ---- Suggestions shown when a chat is empty --------------------------------

export const STARTER_SUGGESTIONS = [
  'Summarise yesterday\'s standup notes',
  'Draft a friendly follow-up email',
  'Explain like I\'m five: vector embeddings',
  'Compare Postgres and SQLite for a small SaaS',
];

// ---- Pre-baked analytics for the admin dashboard ---------------------------

export const ANALYTICS = {
  totals: {
    users: USERS.length,
    sessions: SAMPLE_SESSIONS.length,
    messagesToday: 47,
    activeNow: 2,
  },
  // last 7 days, oldest first — used by the sparkline mock
  messagesByDay: [12, 18, 9, 24, 31, 28, 47],
  topUsers: [
    { name: 'Sam Carter', messages: 134 },
    { name: 'Uma User', messages: 91 },
    { name: 'Lin Park', messages: 62 },
    { name: 'Aria Admin', messages: 28 },
  ],
  recentActions: [
    { actor: 'Aria Admin', action: 'Created user lin@test.com', at: '2 minutes ago' },
    { actor: 'Aria Admin', action: 'Changed Sam Carter to user role', at: '1 hour ago' },
    { actor: 'System', action: 'Daily backup completed', at: '6 hours ago' },
    { actor: 'Aria Admin', action: 'Updated dark-theme palette', at: 'yesterday' },
  ],
};
