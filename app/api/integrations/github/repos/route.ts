import { NextResponse } from 'next/server';
import { readSessionFromCookies } from '@/lib/auth';
import { listAuthedRepos, GitHubError } from '@/lib/github/client';
import { getGithubIntegration } from '@/lib/github/integration';

export const runtime = 'nodejs';

export async function GET() {
  const session = await readSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const integ = await getGithubIntegration(session.sub);
  if (!integ) {
    return NextResponse.json({ error: 'Not connected' }, { status: 400 });
  }
  try {
    const repos = await listAuthedRepos(integ.pat);
    return NextResponse.json({
      repos: repos.map((r) => ({
        full_name: r.full_name,
        description: r.description,
        private: r.private,
        language: r.language,
        default_branch: r.default_branch,
        pushed_at: r.pushed_at,
        stargazers_count: r.stargazers_count,
      })),
    });
  } catch (err) {
    const message =
      err instanceof GitHubError
        ? err.userMessage
        : err instanceof Error
          ? err.message
          : 'Failed to list repos';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
