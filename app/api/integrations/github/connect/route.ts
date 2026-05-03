import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readSessionFromCookies } from '@/lib/auth';
import { getAuthedUser, GitHubError } from '@/lib/github/client';
import { upsertGithubIntegration } from '@/lib/github/integration';

export const runtime = 'nodejs';

const Body = z.object({
  pat: z.string().min(20).max(500),
});

/**
 * POST /api/integrations/github/connect
 * Verifies the PAT against GitHub, stores it for this user.
 */
export async function POST(req: Request) {
  const session = await readSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  try {
    const user = await getAuthedUser(parsed.data.pat);
    await upsertGithubIntegration(session.sub, {
      pat: parsed.data.pat,
      login: user.login,
    });
    return NextResponse.json({
      ok: true,
      user: { login: user.login, name: user.name, avatar_url: user.avatar_url },
    });
  } catch (err) {
    const message =
      err instanceof GitHubError
        ? err.userMessage
        : err instanceof Error
          ? err.message
          : 'Failed to verify PAT';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
