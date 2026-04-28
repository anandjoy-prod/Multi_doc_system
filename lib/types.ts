// Shared domain types. Keep in sync with supabase/migrations/0001_init.sql.

export type Theme = 'light' | 'dark' | 'system';

export type RoleName = 'admin' | 'user' | 'viewer' | (string & {});

export interface Role {
  id: string;
  name: RoleName;
  permissions: string[]; // '*' is the wildcard
  theme_override: Theme | null;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  role_id: string;
  theme_preference: Theme;
  created_at: string;
  last_login: string | null;
}

export interface ChatSession {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  session_id: string;
  role: MessageRole;
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface Suggestion {
  id: string;
  user_id: string;
  suggestion_text: string;
  trigger_keywords: string[];
  usage_count: number;
  created_at: string;
}

export interface Integration {
  id: string;
  user_id: string;
  type: 'google_docs' | 'google_sheets' | (string & {});
  credentials: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
}

// JWT payload — kept narrow on purpose.
export interface SessionClaims {
  sub: string;          // user id
  role: RoleName;
  perms: string[];
  // exp / iat handled by jose
}

// Permissions check helper — '*' beats any specific permission.
export function hasPermission(perms: readonly string[], needed: string): boolean {
  return perms.includes('*') || perms.includes(needed);
}
