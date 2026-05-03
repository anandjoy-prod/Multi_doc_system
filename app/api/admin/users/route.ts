import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hashPassword, readSessionFromCookies } from '@/lib/auth';
import { hasPermission } from '@/lib/types';
import { serverAdmin } from '@/lib/supabase';
import { writeAudit } from '@/lib/audit';

export const runtime = 'nodejs';

interface UserRow {
  id: string;
  email: string;
  theme_preference: string;
  created_at: string;
  last_login: string | null;
  roles: { name: string } | null;
}

interface RoleRow {
  id: string;
  name: string;
  permissions: string[];
  theme_override: string | null;
}

const CreateBody = z.object({
  email: z.string().email().max(254).transform((v) => v.toLowerCase()),
  password: z.string().min(8, 'Password must be at least 8 characters').max(72),
  roleId: z.string().uuid(),
  themePreference: z.enum(['light', 'dark', 'system']).default('system'),
});

async function requireAdmin() {
  const s = await readSessionFromCookies();
  if (!s || !hasPermission(s.perms, '*')) return null;
  return s;
}

/**
 * GET /api/admin/users — admin-only listing of users + the role catalog.
 */
export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const sb = serverAdmin();
  const [usersRes, rolesRes] = await Promise.all([
    sb
      .from('users')
      .select('id, email, theme_preference, created_at, last_login, roles ( name )')
      .order('created_at', { ascending: false })
      .returns<UserRow[]>(),
    sb
      .from('roles')
      .select('id, name, permissions, theme_override')
      .order('name')
      .returns<RoleRow[]>(),
  ]);

  if (usersRes.error) {
    return NextResponse.json({ error: usersRes.error.message }, { status: 500 });
  }
  if (rolesRes.error) {
    return NextResponse.json({ error: rolesRes.error.message }, { status: 500 });
  }

  return NextResponse.json({
    users: (usersRes.data ?? []).map((u) => ({
      id: u.id,
      email: u.email,
      role: u.roles?.name ?? 'user',
      theme_preference: u.theme_preference,
      created_at: u.created_at,
      last_login: u.last_login,
    })),
    roles: rolesRes.data ?? [],
  });
}

/**
 * POST /api/admin/users — create a user. Admin-only.
 *
 * Body: { email, password, roleId, themePreference? }
 *
 * Returns 201 on success; 409 if the email already exists.
 */
export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const parsed = CreateBody.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid body' },
      { status: 400 },
    );
  }
  const { email, password, roleId, themePreference } = parsed.data;

  const sb = serverAdmin();
  const password_hash = await hashPassword(password);

  const { data, error } = await sb
    .from('users')
    .insert({
      email,
      password_hash,
      role_id: roleId,
      theme_preference: themePreference,
    })
    .select('id, email, role_id, theme_preference, created_at')
    .single();

  if (error) {
    // 23505 = unique_violation
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'A user with this email already exists.' },
        { status: 409 },
      );
    }
    // 23503 = foreign_key_violation (bad roleId)
    if (error.code === '23503') {
      return NextResponse.json(
        { error: 'Selected role no longer exists.' },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await writeAudit(session.sub, 'user.create', data.id, { email, roleId });

  return NextResponse.json({ user: data }, { status: 201 });
}
