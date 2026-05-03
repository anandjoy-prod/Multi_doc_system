// =============================================================================
// Read/write the github integration row for a user.
//
// Stored in the existing `integrations` table:
//   type        = 'github'
//   credentials = { pat, login, active_repo?, active_branch? }
//
// PAT is in plaintext for the demo. For production, encrypt with pgcrypto:
//   pgp_sym_encrypt(credentials::text, current_setting('app.encryption_key'))
// See CRITIQUE.md #8.
// =============================================================================

import { serverAdmin } from '@/lib/supabase';

export interface GithubIntegrationRow {
  pat: string;
  login: string;
  active_repo?: string;
  active_branch?: string;
}

export async function getGithubIntegration(
  userId: string,
): Promise<GithubIntegrationRow | null> {
  const sb = serverAdmin();
  const { data } = await sb
    .from('integrations')
    .select('credentials, is_active')
    .eq('user_id', userId)
    .eq('type', 'github')
    .maybeSingle();
  if (!data || !data.is_active) return null;
  return data.credentials as GithubIntegrationRow;
}

export async function upsertGithubIntegration(
  userId: string,
  patch: Partial<GithubIntegrationRow> & { pat?: string; login?: string },
): Promise<void> {
  const sb = serverAdmin();
  const existing = await getGithubIntegration(userId);
  const merged: GithubIntegrationRow = {
    pat: patch.pat ?? existing?.pat ?? '',
    login: patch.login ?? existing?.login ?? '',
    active_repo: patch.active_repo ?? existing?.active_repo,
    active_branch: patch.active_branch ?? existing?.active_branch,
  };
  if (!merged.pat) throw new Error('Cannot upsert without PAT');

  const { error } = await sb
    .from('integrations')
    .upsert(
      {
        user_id: userId,
        type: 'github',
        credentials: merged,
        is_active: true,
      },
      { onConflict: 'user_id,type' },
    );
  if (error) throw new Error(error.message);
}

export async function deleteGithubIntegration(userId: string): Promise<void> {
  const sb = serverAdmin();
  await sb
    .from('integrations')
    .delete()
    .eq('user_id', userId)
    .eq('type', 'github');
}
