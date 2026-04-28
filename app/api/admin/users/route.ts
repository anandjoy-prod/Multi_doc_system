import { NextResponse } from 'next/server';
import { readSessionFromCookies } from '@/lib/auth';
import { hasPermission } from '@/lib/types';
import { USERS, ROLES, findRoleById } from '@/lib/dummy-data';

export const runtime = 'nodejs';

/**
 * GET /api/admin/users — admin-only listing of dummy users.
 */
export async function GET() {
  const session = await readSessionFromCookies();
  if (!session || !hasPermission(session.perms, '*')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const users = USERS.map((u) => {
    const role = findRoleById(u.role_id);
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: role?.name ?? 'user',
      theme_preference: u.theme_preference,
      created_at: u.created_at,
      last_login: u.last_login,
    };
  });

  return NextResponse.json({ users, roles: ROLES });
}
