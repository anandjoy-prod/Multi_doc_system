import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

/**
 * Two clients:
 *
 *   - serverAdmin: service-role key, bypasses RLS. Use ONLY in trusted
 *     server-side paths (auth, migrations, admin endpoints, chat routes).
 *     Never ship this to the browser. Ownership is enforced in app code,
 *     not at the DB layer (yet).
 *
 *   - serverWithUser(userId, isAdmin): currently aliased to serverAdmin.
 *     The arguments are kept so call sites don't change when you flip on
 *     RLS — see CRITIQUE.md #5 for the upgrade path. When that day comes,
 *     change only this file: callers stay the same.
 */

let _admin: SupabaseClient | null = null;

export function serverAdmin(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
  }
  return _admin;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function serverWithUser(userId: string, isAdmin: boolean): SupabaseClient {
  // TODO(rls): swap for an RLS-enforcing client. See the comment above.
  return serverAdmin();
}
