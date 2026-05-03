import { NextResponse } from 'next/server';
import { readSessionFromCookies } from '@/lib/auth';
import { serverAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

interface MeUserRow {
  id: string;
  email: string;
  theme_preference: 'light' | 'dark' | 'system';
  roles: {
    name: string;
    theme_override: 'light' | 'dark' | 'system' | null;
  } | null;
}

/**
 * GET /api/auth/me — used by the client header to render "who am I".
 *
 * "Name" is derived from the email's local part since the dummy seed and
 * minimal schema don't store a separate display name. Once you add one,
 * select it here.
 */
export async function GET() {
  const session = await readSessionFromCookies();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 200 });
  }
  const sb = serverAdmin();
  const { data, error } = await sb
    .from('users')
    .select('id, email, theme_preference, roles ( name, theme_override )')
    .eq('id', session.sub)
    .maybeSingle<MeUserRow>();

  if (error || !data) {
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({
    user: {
      id: data.id,
      email: data.email,
      name: prettyName(data.email),
      role: data.roles?.name ?? 'user',
      theme_preference: data.theme_preference,
      theme_override: data.roles?.theme_override ?? null,
    },
  });
}

function prettyName(email: string): string {
  const local = email.split('@')[0] ?? email;
  return local
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
