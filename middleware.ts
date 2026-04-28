import { NextResponse, type NextRequest } from 'next/server';
import { readSessionFromRequest, isSafeOrigin } from '@/lib/auth';
import { hasPermission } from '@/lib/types';

/**
 * Route-level guards:
 *
 *   - /admin/**         requires the '*' permission (admin role).
 *   - /chat/**          requires any logged-in user.
 *   - /api/admin/**     requires '*'.
 *   - /api/chat/**      requires logged-in user; CSRF check on writes.
 *   - /api/auth/**      public.
 *
 * Auth is verified from the `session` httpOnly cookie. CSRF is enforced via
 * an Origin check on state-changing methods (see CRITIQUE.md #16).
 */

export const config = {
  matcher: [
    '/admin/:path*',
    '/chat/:path*',
    '/api/admin/:path*',
    '/api/chat/:path*',
  ],
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await readSessionFromRequest(req);

  // 1. CSRF — block cross-site write attempts before we even look at auth.
  if (pathname.startsWith('/api/') && !isSafeOrigin(req)) {
    return NextResponse.json({ error: 'Bad Origin' }, { status: 403 });
  }

  // 2. Authn — must have a valid session for any matched route.
  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // 3. Authz — admin gates.
  const isAdminRoute =
    pathname.startsWith('/admin') || pathname.startsWith('/api/admin');
  if (isAdminRoute && !hasPermission(session.perms, '*')) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.redirect(new URL('/chat', req.url));
  }

  return NextResponse.next();
}
