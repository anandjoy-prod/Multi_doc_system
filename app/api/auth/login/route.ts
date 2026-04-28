import { NextResponse } from 'next/server';
import { z } from 'zod';
import { signSession, setSessionCookie } from '@/lib/auth';
import { findUserByEmail, findRoleById } from '@/lib/dummy-data';

export const runtime = 'nodejs';

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * POST /api/auth/login
 * Validates dummy credentials, signs a JWT, sets it in an httpOnly cookie,
 * returns the user shape (including their role + theme).
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const user = findUserByEmail(email);
  if (!user || user.password !== password) {
    return NextResponse.json(
      { error: 'Invalid email or password' },
      { status: 401 },
    );
  }

  const role = findRoleById(user.role_id);

  const token = await signSession({
    sub: user.id,
    role: (role?.name ?? 'user') as never,
    perms: role?.permissions ?? [],
  });
  await setSessionCookie(token);

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
