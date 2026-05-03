// =============================================================================
// Tiny GitHub REST client — direct fetch, no SDK.
//
// Five operations cover everything the agent's tools need:
//   - getAuthedUser          → verify PAT, get login
//   - listAuthedRepos        → repo picker
//   - getRepo                → metadata for active repo
//   - getRepoTree            → list files (recursive)
//   - getFileContents        → read one file
//   - searchCode             → in-repo code search
//
// We don't use Octokit because it's ~600 KB and we'd use 1% of it.
// =============================================================================

const BASE = 'https://api.github.com';

const DEFAULT_HEADERS = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'AI-Chat-CMS/0.1 (mcp-style)',
};

export interface GhUser {
  login: string;
  name: string | null;
  avatar_url: string;
}

export interface GhRepoSummary {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  description: string | null;
  default_branch: string;
  language: string | null;
  pushed_at: string;
  size: number;
  stargazers_count: number;
}

export interface GhTreeEntry {
  path: string;
  type: 'blob' | 'tree' | 'commit';
  sha: string;
  size?: number;
}

export interface GhTree {
  truncated: boolean;
  tree: GhTreeEntry[];
}

export interface GhSearchHit {
  path: string;
  name: string;
  repository: { full_name: string };
  text_matches?: { fragment: string }[];
}

export class GitHubError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly userMessage = message,
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}

async function gh<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      ...DEFAULT_HEADERS,
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const friendly =
      res.status === 401
        ? 'Token rejected. Check it has the `repo` (or `public_repo`) scope and is not expired.'
        : res.status === 403
          ? 'GitHub returned 403 — rate-limited or scope insufficient. Try again in a minute.'
          : res.status === 404
            ? 'Not found. The repo may be private without the right scope, or the path/ref is wrong.'
            : `GitHub returned ${res.status}.`;
    throw new GitHubError(`${res.status} ${path}`, res.status, friendly);
  }
  return (await res.json()) as T;
}

export async function getAuthedUser(token: string): Promise<GhUser> {
  return gh('/user', token);
}

export async function listAuthedRepos(token: string): Promise<GhRepoSummary[]> {
  const out: GhRepoSummary[] = [];
  for (let page = 1; page <= 4; page++) {
    const batch = await gh<GhRepoSummary[]>(
      `/user/repos?per_page=50&page=${page}&sort=pushed&affiliation=owner,collaborator`,
      token,
    );
    out.push(...batch);
    if (batch.length < 50) break;
  }
  return out;
}

export async function getRepo(
  token: string,
  fullName: string,
): Promise<GhRepoSummary> {
  return gh(`/repos/${fullName}`, token);
}

export async function getRepoTree(
  token: string,
  fullName: string,
  branch: string,
): Promise<GhTree> {
  return gh(`/repos/${fullName}/git/trees/${branch}?recursive=1`, token);
}

/**
 * Returns file contents as UTF-8 string, or null for binary / too-large
 * blobs. Uses the raw download endpoint for files <1MB, falls back to the
 * contents API for smaller files (which gives base64).
 */
export async function getFileContents(
  token: string,
  fullName: string,
  path: string,
  ref: string,
): Promise<string | null> {
  const res = await fetch(
    `${BASE}/repos/${fullName}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref)}`,
    {
      headers: {
        ...DEFAULT_HEADERS,
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    },
  );
  if (!res.ok) return null;
  const body = (await res.json()) as {
    type?: string;
    encoding?: string;
    content?: string;
  };
  if (body.type !== 'file' || body.encoding !== 'base64' || !body.content) {
    return null;
  }
  try {
    const decoded = Buffer.from(body.content, 'base64').toString('utf-8');
    if ((decoded.match(/\0/g) ?? []).length > 5) return null; // probably binary
    return decoded;
  } catch {
    return null;
  }
}

/**
 * In-repo code search via the GitHub search API.
 * Note: GitHub's search index has a brief delay after pushes (~30s).
 */
export async function searchCode(
  token: string,
  fullName: string,
  query: string,
): Promise<GhSearchHit[]> {
  const q = `${query} repo:${fullName}`;
  const res = await fetch(
    `${BASE}/search/code?q=${encodeURIComponent(q)}&per_page=10`,
    {
      headers: {
        ...DEFAULT_HEADERS,
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.text-match+json',
      },
      cache: 'no-store',
    },
  );
  if (!res.ok) {
    if (res.status === 422) return []; // bad query / unindexed
    throw new GitHubError(`search ${res.status}`, res.status);
  }
  const body = (await res.json()) as { items?: GhSearchHit[] };
  return body.items ?? [];
}

function encodePath(path: string): string {
  return path
    .split('/')
    .map(encodeURIComponent)
    .join('/');
}
