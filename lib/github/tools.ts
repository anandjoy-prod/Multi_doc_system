// =============================================================================
// MCP-shape tool definitions + executor.
//
// These match the OpenAI / GitHub Models tool-calling schema, which is also
// what the MCP TypeScript SDK uses. If you ever swap to the real GitHub MCP
// server, the tool *names* and *parameter shapes* below stay valid — only
// `executeTool` changes (it would dispatch to the MCP client instead of
// calling fetch directly).
//
// All four tools are READ-ONLY. The PAT can be `repo`-scoped without the
// agent ever being able to mutate.
// =============================================================================

import type { ChatCompletionTool } from 'openai/resources/chat/completions';
import {
  getRepo,
  getRepoTree,
  getFileContents,
  searchCode,
  GitHubError,
  type GhRepoSummary,
} from './client';

export interface GithubContext {
  token: string;
  fullName: string;
  branch: string;
  /** Per-request cache keyed by tool name + JSON args. */
  cache: Map<string, string>;
}

export const TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'github_get_repo_info',
      description:
        'Get high-level info about the connected repo: name, description, default branch, primary language, top-level files and directories. Use this FIRST when answering broad questions about the codebase.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'github_list_directory',
      description:
        'List files and subdirectories at a given path within the repo. Use this to navigate the codebase structure. Empty path lists the repo root.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Directory path within the repo. Use "" for the root.',
          },
        },
        required: ['path'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'github_read_file',
      description:
        'Read the full contents of a file in the repo. Use this when you need to look at specific source code or docs to answer the question. Files are truncated at 8000 characters.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path within the repo (e.g. "src/auth.ts").',
          },
        },
        required: ['path'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'github_search_code',
      description:
        'Search the repo for code matching a keyword or short phrase. Returns up to 10 file paths with snippets. Useful when you need to find where something is defined or used.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query — keyword, function name, or short phrase.',
          },
        },
        required: ['query'],
        additionalProperties: false,
      },
    },
  },
];

const FILE_CHAR_CAP = 8000;
const TREE_LISTING_CAP = 200;

/**
 * Run a single tool call. Cached per request — if the same tool is called
 * with the same args twice, the second hit is served from memory.
 */
export async function executeTool(
  ctx: GithubContext,
  name: string,
  args: Record<string, unknown>,
): Promise<{ result: string; cached: boolean }> {
  const key = `${name}:${JSON.stringify(args)}`;
  const cached = ctx.cache.get(key);
  if (cached !== undefined) return { result: cached, cached: true };

  let result: string;
  try {
    result = await dispatch(ctx, name, args);
  } catch (err) {
    result =
      err instanceof GitHubError
        ? `(error: ${err.userMessage})`
        : `(error: ${err instanceof Error ? err.message : 'unknown'})`;
  }

  ctx.cache.set(key, result);
  return { result, cached: false };
}

async function dispatch(
  ctx: GithubContext,
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  switch (name) {
    case 'github_get_repo_info': {
      const repo = await getRepo(ctx.token, ctx.fullName);
      const tree = await getRepoTree(ctx.token, ctx.fullName, ctx.branch);
      return formatRepoInfo(repo, tree.tree);
    }
    case 'github_list_directory': {
      const path = String(args.path ?? '');
      const tree = await getRepoTree(ctx.token, ctx.fullName, ctx.branch);
      return formatDirListing(tree.tree, path);
    }
    case 'github_read_file': {
      const path = String(args.path ?? '');
      if (!path) return '(error: path required)';
      const text = await getFileContents(ctx.token, ctx.fullName, path, ctx.branch);
      if (text == null) return `(file not found or binary: ${path})`;
      const truncated = text.length > FILE_CHAR_CAP;
      return [
        `# ${path}`,
        truncated ? `(truncated to ${FILE_CHAR_CAP} chars; full size ${text.length})` : '',
        '',
        truncated ? text.slice(0, FILE_CHAR_CAP) : text,
      ]
        .filter(Boolean)
        .join('\n');
    }
    case 'github_search_code': {
      const q = String(args.query ?? '');
      if (!q.trim()) return '(error: query required)';
      const hits = await searchCode(ctx.token, ctx.fullName, q);
      if (hits.length === 0) return `(no matches for "${q}")`;
      return hits
        .slice(0, 10)
        .map((h, i) => {
          const frag = h.text_matches?.[0]?.fragment?.replace(/\s+/g, ' ').slice(0, 200);
          return `[${i + 1}] ${h.path}${frag ? `\n    …${frag}…` : ''}`;
        })
        .join('\n');
    }
    default:
      return `(error: unknown tool ${name})`;
  }
}

// ---- formatters ------------------------------------------------------------

function formatRepoInfo(
  repo: GhRepoSummary,
  tree: { path: string; type: 'blob' | 'tree' | 'commit' }[],
): string {
  const topLevel = new Set<string>();
  for (const e of tree) {
    const seg = e.path.split('/')[0];
    if (seg) topLevel.add(seg);
  }
  const langCounts = new Map<string, number>();
  for (const e of tree) {
    if (e.type !== 'blob') continue;
    const ext = (e.path.match(/\.([^./]+)$/)?.[1] ?? 'other').toLowerCase();
    langCounts.set(ext, (langCounts.get(ext) ?? 0) + 1);
  }
  const topLangs = [...langCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([ext, n]) => `${ext}:${n}`)
    .join(', ');

  const lines = [
    `Repo: ${repo.full_name}`,
    repo.description ? `Description: ${repo.description}` : '',
    `Default branch: ${repo.default_branch}`,
    repo.language ? `Primary language: ${repo.language}` : '',
    `File-type counts: ${topLangs}`,
    `Top-level entries: ${[...topLevel].sort().join(', ')}`,
  ].filter(Boolean);
  return lines.join('\n');
}

function formatDirListing(
  tree: { path: string; type: 'blob' | 'tree' | 'commit' }[],
  path: string,
): string {
  const prefix = path === '' ? '' : path.replace(/\/$/, '') + '/';
  const depth = prefix === '' ? 0 : prefix.split('/').length - 1;
  const seenAtThisLevel = new Set<string>();
  const items: { name: string; type: 'file' | 'dir' }[] = [];

  for (const e of tree) {
    if (!e.path.startsWith(prefix)) continue;
    const rest = e.path.slice(prefix.length);
    if (rest === '') continue;
    const segs = rest.split('/');
    const isDirEntry = segs.length > 1 || e.type === 'tree';
    const name = segs[0]!;
    if (seenAtThisLevel.has(name)) continue;
    seenAtThisLevel.add(name);
    items.push({ name, type: isDirEntry ? 'dir' : 'file' });
    if (items.length >= TREE_LISTING_CAP) break;
  }

  if (items.length === 0) {
    return `(empty or path not found: "${path}")`;
  }
  items.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  const lines = items.map((i) => (i.type === 'dir' ? `${i.name}/` : i.name));
  return `Contents of "${path || '(root)'}":\n${lines.join('\n')}` +
    (items.length === TREE_LISTING_CAP ? `\n(truncated at ${TREE_LISTING_CAP})` : '');
}
