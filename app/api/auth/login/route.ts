import { NextResponse } from 'next/server';
import { z } from 'zod';
import { signSession, setSessionCookie, verifyPassword } from '@/lib/auth';
import { serverAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

interface LoginUserRow {
  id: string;
  email: string;
  password_hash: string;
  role_id: string;
  theme_preference: 'light' | 'dark' | 'system';
  roles: {
    name: string;
    permissions: string[];
    theme_override: 'light' | 'dark' | 'system' | null;
  } | null;
}

/**
 * POST /api/auth/login
 *
 * Looks up user + role in one round-trip, verifies bcrypt hash, signs JWT,
 * sets session cookie, returns the user-shape we render in the UI.
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const sb = serverAdmin();
  const { data, error } = await sb
    .from('users')
    .select(
      'id, email, password_hash, role_id, theme_preference, roles ( name, permissions, theme_override )',
    )
    .eq('email', email.toLowerCase())
    .maybeSingle<LoginUserRow>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { error: 'Invalid email or password' },
      { status: 401 },
    );
  }

  const ok = await verifyPassword(password, data.password_hash);
  if (!ok) {
    return NextResponse.json(
      { error: 'Invalid email or password' },
      { status: 401 },
    );
  }

  // Update last_login (fire and forget — never block login on it).
  sb.from('users')
    .update({ last_login: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {});

  const roleName = data.roles?.name ?? 'user';
  const perms = data.roles?.permissions ?? [];

  const token = await signSession({
    sub: data.id,
    role: roleName as never,
    perms,
  });
  await setSessionCookie(token);

  return NextResponse.json({
    user: {
      id: data.id,
      email: data.email,
      role: roleName,
      theme_preference: data.theme_preference,
      theme_override: data.roles?.theme_override ?? null,
    },
  });
}
