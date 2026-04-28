import { jwtVerify, SignJWT } from 'jose';
import type { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { env } from './env';
import type { SessionClaims } from './types';

/**
 * UI-only auth: dummy users with plaintext passwords (see lib/dummy-data.ts),
 * but a real signed JWT in an httpOnly cookie so middleware works the same
 * way it will once you wire a real DB back in.
 */

const SESSION_COOKIE = 'session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

const secret = new TextEncoder().encode(env.JWT_SECRET);

// ---------- JWT ----------

export async function signSession(claims: SessionClaims): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setSubject(claims.sub)
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret);
}

export async function verifySession(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
    });
    return {
      sub: payload.sub as string,
      role: (payload.role as SessionClaims['role']) ?? 'user',
      perms: (payload.perms as string[]) ?? [],
    };
  } catch {
    return null;
  }
}

// ---------- cookie helpers (route handlers) ----------

export async function setSessionCookie(token: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function readSessionFromCookies(): Promise<SessionClaims | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

// Variant for middleware (which receives a NextRequest).
export async function readSessionFromRequest(
  req: NextRequest,
): Promise<SessionClaims | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

// ---------- CSRF (Origin check on writes) ----------

export function isSafeOrigin(req: NextRequest): boolean {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return true;

  const origin = req.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(env.NEXT_PUBLIC_APP_URL).origin;
  } catch {
    return false;
  }
}
