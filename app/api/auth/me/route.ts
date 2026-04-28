import { NextResponse } from 'next/server';
import { readSessionFromCookies } from '@/lib/auth';
import { findUserById, findRoleById } from '@/lib/dummy-data';

export const runtime = 'nodejs';

/**
 * GET /api/auth/me — used by the client to render "who am I" in the header.
 */
export async function GET() {
  const session = await readSessionFromCookies();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 200 });
  }
  const user = findUserById(session.sub);
  if (!user) return NextResponse.json({ user: null });

  const role = findRoleById(user.role_id);
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: role?.name ?? 'user',
      theme_preference: user.theme_preference,
      theme_override: role?.theme_override ?? null,
    },
  });
}
