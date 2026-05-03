'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Github,
  Loader2,
  Check,
  AlertCircle,
  Search,
  Lock,
  GitBranch,
  Star,
  Unplug,
} from 'lucide-react';
import { Button } from '@/components/shared/Button';
import { Field } from '@/components/shared/Field';
import { cn } from '@/lib/cn';

interface Status {
  connected: boolean;
  login?: string;
  active_repo?: string | null;
  active_branch?: string | null;
}

interface RepoRow {
  full_name: string;
  description: string | null;
  private: boolean;
  language: string | null;
  default_branch: string;
  pushed_at: string;
  stargazers_count: number;
}

export function GithubManager() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [pat, setPat] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repos, setRepos] = useState<RepoRow[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [query, setQuery] = useState('');

  // Initial status fetch.
  useEffect(() => {
    refreshStatus();
  }, []);

  // When connected, pull repo list.
  useEffect(() => {
    if (status?.connected && repos.length === 0 && !reposLoading) {
      void loadRepos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.connected]);

  async function refreshStatus() {
    const r = await fetch('/api/integrations/github/status');
    if (!r.ok) return;
    const d = (await r.json()) as Status;
    setStatus(d);
  }

  async function loadRepos() {
    setReposLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/integrations/github/repos');
      const d = await r.json();
      if (!r.ok) {
        setError(d?.error ?? 'Failed to list repos');
        setReposLoading(false);
        return;
      }
      setRepos(d.repos ?? []);
    } finally {
      setReposLoading(false);
    }
  }

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setWorking(true);
    try {
      const r = await fetch('/api/integrations/github/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pat }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d?.error ?? 'Connect failed');
        return;
      }
      setPat('');
      await refreshStatus();
      await loadRepos();
    } finally {
      setWorking(false);
    }
  }

  async function selectRepo(full_name: string, branch: string) {
    setWorking(true);
    setError(null);
    try {
      const r = await fetch('/api/integrations/github/select-repo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name, branch }),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d?.error ?? 'Select failed');
        return;
      }
      await refreshStatus();
      router.refresh();
    } finally {
      setWorking(false);
    }
  }

  async function disconnect() {
    if (!confirm('Disconnect GitHub? Your PAT will be removed.')) return;
    setWorking(true);
    setError(null);
    try {
      await fetch('/api/integrations/github/disconnect', { method: 'POST' });
      setStatus({ connected: false });
      setRepos([]);
      router.refresh();
    } finally {
      setWorking(false);
    }
  }

  const filteredRepos = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return repos;
    return repos.filter(
      (r) =>
        r.full_name.toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q),
    );
  }, [repos, query]);

  if (status === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-fg-secondary">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  if (!status.connected) {
    return (
      <ConnectForm
        pat={pat}
        setPat={setPat}
        onSubmit={connect}
        working={working}
        error={error}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <ActiveBanner status={status} onDisconnect={disconnect} working={working} />

      {error ? (
        <div className="rounded-lg border border-accent-error/40 bg-accent-error/10 px-3 py-2 text-xs text-accent-error">
          {error}
        </div>
      ) : null}

      <div>
        <div className="mb-2 flex items-center gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wider text-fg-secondary">
            Pick a repo
          </h3>
          <span className="text-xs text-fg-secondary">
            ({repos.length} accessible)
          </span>
        </div>
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-bg-primary px-3 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30">
          <Search className="h-4 w-4 shrink-0 text-fg-secondary" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter repos…"
            className="h-9 w-full bg-transparent text-sm outline-none"
          />
        </div>
        {reposLoading ? (
          <div className="flex items-center gap-2 text-sm text-fg-secondary">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading repos…
          </div>
        ) : (
          <ul className="flex max-h-[28rem] flex-col gap-1 overflow-y-auto rounded-2xl border border-border bg-bg-secondary p-1">
            {filteredRepos.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-fg-secondary">
                No repos match.
              </li>
            ) : (
              filteredRepos.map((r) => {
                const active = status.active_repo === r.full_name;
                return (
                  <li key={r.full_name}>
                    <button
                      type="button"
                      onClick={() => selectRepo(r.full_name, r.default_branch)}
                      disabled={working || active}
                      className={cn(
                        'group flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                        active
                          ? 'bg-accent/10'
                          : 'hover:bg-bg-tertiary',
                      )}
                    >
                      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded text-fg-secondary">
                        {r.private ? (
                          <Lock className="h-3.5 w-3.5" />
                        ) : (
                          <Github className="h-3.5 w-3.5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-mono text-sm font-medium">
                            {r.full_name}
                          </span>
                          {active ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-accent">
                              <Check className="h-2.5 w-2.5" /> active
                            </span>
                          ) : null}
                        </div>
                        {r.description ? (
                          <p className="truncate text-xs text-fg-secondary">
                            {r.description}
                          </p>
                        ) : null}
                        <div className="mt-1 flex items-center gap-3 text-[11px] text-fg-secondary">
                          <span className="inline-flex items-center gap-1">
                            <GitBranch className="h-3 w-3" /> {r.default_branch}
                          </span>
                          {r.language ? <span>{r.language}</span> : null}
                          <span className="inline-flex items-center gap-1">
                            <Star className="h-3 w-3" />
                            {r.stargazers_count}
                          </span>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

function ConnectForm({
  pat,
  setPat,
  onSubmit,
  working,
  error,
}: {
  pat: string;
  setPat: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  working: boolean;
  error: string | null;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4 rounded-2xl border border-border bg-bg-secondary p-5"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-tertiary">
          <Github className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-display text-base font-semibold">Connect GitHub</h3>
          <p className="mt-1 text-sm text-fg-secondary">
            Paste a Personal Access Token with{' '}
            <code className="font-mono text-xs">repo</code> (or{' '}
            <code className="font-mono text-xs">public_repo</code>) scope. Once
            connected, you'll pick a repo and chat can read files on demand
            via tool calls.
          </p>
          <p className="mt-1 text-xs text-fg-secondary">
            Generate one at{' '}
            <a
              href="https://github.com/settings/tokens?type=beta"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              github.com/settings/tokens
            </a>
            .
          </p>
        </div>
      </div>

      <Field
        label="Personal Access Token"
        type="password"
        autoComplete="off"
        spellCheck={false}
        required
        value={pat}
        onChange={(e) => setPat(e.target.value)}
        placeholder="github_pat_… or ghp_…"
      />

      {error ? (
        <div className="rounded-lg border border-accent-error/40 bg-accent-error/10 px-3 py-2 text-xs text-accent-error">
          {error}
        </div>
      ) : null}

      <Button type="submit" disabled={working || pat.trim().length < 20}>
        {working ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Verifying…
          </>
        ) : (
          'Connect'
        )}
      </Button>
    </form>
  );
}

function ActiveBanner({
  status,
  onDisconnect,
  working,
}: {
  status: Status;
  onDisconnect: () => void;
  working: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent/5 p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-tertiary text-accent">
        <Github className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm">
          <Check className="h-4 w-4 shrink-0 text-accent-success" />
          <span>
            Connected as{' '}
            <span className="font-mono">{status.login}</span>
          </span>
        </div>
        <p className="mt-0.5 text-xs text-fg-secondary">
          {status.active_repo
            ? `Active repo: ${status.active_repo} (branch ${status.active_branch ?? 'default'})`
            : 'No repo selected — pick one below to start chatting against it.'}
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onDisconnect}
        disabled={working}
      >
        <Unplug className="h-3.5 w-3.5" /> Disconnect
      </Button>
    </div>
  );
}
