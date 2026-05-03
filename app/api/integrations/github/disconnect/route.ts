import { NextResponse } from 'next/server';
import { readSessionFromCookies } from '@/lib/auth';
import { deleteGithubIntegration } from '@/lib/github/integration';

export const runtime = 'nodejs';

export async function POST() {
  const session = await readSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await deleteGithubIntegration(session.sub);
  return NextResponse.json({ ok: true });
}
