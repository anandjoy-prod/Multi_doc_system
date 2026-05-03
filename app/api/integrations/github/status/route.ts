import { NextResponse } from 'next/server';
import { readSessionFromCookies } from '@/lib/auth';
import { getGithubIntegration } from '@/lib/github/integration';

export const runtime = 'nodejs';

export async function GET() {
  const session = await readSessionFromCookies();
  if (!session) return NextResponse.json({ connected: false });
  const integ = await getGithubIntegration(session.sub);
  if (!integ) return NextResponse.json({ connected: false });
  return NextResponse.json({
    connected: true,
    login: integ.login,
    active_repo: integ.active_repo ?? null,
    active_branch: integ.active_branch ?? null,
  });
}
