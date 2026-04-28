// =============================================================================
// In-memory chat-session store. Resets on every dev-server restart, which is
// fine for the UI demo. Replace with the real DB layer when ready.
// =============================================================================

import { SAMPLE_SESSIONS } from './dummy-data';

export interface StoredMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export interface StoredSession {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages: StoredMessage[];
}

// Use a global so HMR in `next dev` does not wipe the store on every save.
declare global {
  // eslint-disable-next-line no-var
  var __chatStore: Map<string, StoredSession> | undefined;
}

function init(): Map<string, StoredSession> {
  const m = new Map<string, StoredSession>();
  for (const s of SAMPLE_SESSIONS) {
    m.set(s.id, {
      id: s.id,
      user_id: s.user_id,
      title: s.title,
      created_at: s.created_at,
      updated_at: s.updated_at,
      messages: s.messages.map((msg, i) => ({
        id: `${s.id}-msg-${i}`,
        role: msg.role,
        content: msg.content,
        created_at: s.created_at,
      })),
    });
  }
  return m;
}

const store: Map<string, StoredSession> = globalThis.__chatStore ?? init();
if (!globalThis.__chatStore) globalThis.__chatStore = store;

// ---- API ----

export function listSessionsForUser(userId: string): StoredSession[] {
  return Array.from(store.values())
    .filter((s) => s.user_id === userId)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export function getSession(id: string): StoredSession | undefined {
  return store.get(id);
}

export function createSession(userId: string, title?: string): StoredSession {
  const id = `sess-${Math.random().toString(36).slice(2, 10)}`;
  const now = new Date().toISOString();
  const session: StoredSession = {
    id,
    user_id: userId,
    title: title ?? 'New chat',
    created_at: now,
    updated_at: now,
    messages: [],
  };
  store.set(id, session);
  return session;
}

export function appendMessage(
  sessionId: string,
  role: StoredMessage['role'],
  content: string,
): StoredMessage | null {
  const s = store.get(sessionId);
  if (!s) return null;
  const msg: StoredMessage = {
    id: `${sessionId}-msg-${s.messages.length}`,
    role,
    content,
    created_at: new Date().toISOString(),
  };
  s.messages.push(msg);
  s.updated_at = msg.created_at;

  // Auto-title from the first user message.
  if (s.title === 'New chat' && role === 'user') {
    s.title = content.slice(0, 60).trim();
  }
  return msg;
}

export function deleteSession(id: string): boolean {
  return store.delete(id);
}
