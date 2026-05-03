import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readSessionFromCookies } from '@/lib/auth';
import {
  getGithubIntegration,
  upsertGithubIntegration,
} from '@/lib/github/integration';

export const runtime = 'nodejs';

const Body = z.object({
  full_name: z.string().regex(/^[^/]+\/[^/]+$/, 'Expected owner/repo'),
  branch: z.string().optional(),
});

/**
 * POST /api/integrations/github/select-repo
 * Sets which repo the agent will use for this user's chats.
 */
export async function POST(req: Request) {
  const session = await readSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const integ = await getGithubIntegration(session.sub);
  if (!integ) {
    return NextResponse.json({ error: 'Not connected' }, { status: 400 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid body' },
      { status: 400 },
    );
  }
  await upsertGithubIntegration(session.sub, {
    active_repo: parsed.data.full_name,
    active_branch: parsed.data.branch,
  });
  return NextResponse.json({
    ok: true,
    active_repo: parsed.data.full_name,
    active_branch: parsed.data.branch ?? null,
  });
}
