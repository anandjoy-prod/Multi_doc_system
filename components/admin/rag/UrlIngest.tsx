'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, Loader2, AlertCircle, Check } from 'lucide-react';
import { Button } from '@/components/shared/Button';
import { cn } from '@/lib/cn';

type Stage =
  | { kind: 'idle' }
  | { kind: 'fetching' }
  | { kind: 'chunking'; chunks: number }
  | { kind: 'embedding'; progress: number; chunks: number }
  | { kind: 'done'; chunks: number; title?: string }
  | { kind: 'error'; message: string };

interface NdjsonEvent {
  event: 'started' | 'extracted' | 'chunking' | 'embedding' | 'done' | 'error';
  documentId?: string;
  pages?: number;
  chunks?: number;
  progress?: number;
  message?: string;
}

/**
 * Pull a public URL into the RAG index. Same NDJSON-progress pattern as the
 * PDF uploader.
 */
export function UrlIngest() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [stage, setStage] = useState<Stage>({ kind: 'idle' });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;

    setStage({ kind: 'fetching' });

    let res: Response;
    try {
      res = await fetch('/api/rag/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });
    } catch {
      setStage({ kind: 'error', message: 'Network error.' });
      return;
    }

    if (!res.ok || !res.body) {
      const body = await res.json().catch(() => ({}));
      setStage({
        kind: 'error',
        message: body?.error ?? `Request failed (${res.status})`,
      });
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl = buffer.indexOf('\n');
      while (nl !== -1) {
        const raw = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        nl = buffer.indexOf('\n');
        if (!raw) continue;
        try {
          applyEvent(JSON.parse(raw) as NdjsonEvent);
        } catch {
          // Ignore malformed lines.
        }
      }
    }

    router.refresh();

    function applyEvent(ev: NdjsonEvent) {
      switch (ev.event) {
        case 'started':
        case 'extracted':
          setStage({ kind: 'chunking', chunks: 0 });
          break;
        case 'chunking':
          setStage({ kind: 'chunking', chunks: ev.chunks ?? 0 });
          break;
        case 'embedding':
          setStage({
            kind: 'embedding',
            progress: ev.progress ?? 0,
            chunks: ev.chunks ?? 0,
          });
          break;
        case 'done':
          setStage({ kind: 'done', chunks: ev.chunks ?? 0 });
          setTimeout(() => {
            setStage({ kind: 'idle' });
            setUrl('');
            router.refresh();
          }, 1500);
          break;
        case 'error':
          setStage({ kind: 'error', message: ev.message ?? 'Failed' });
          break;
      }
    }
  }

  const busy = !['idle', 'done', 'error'].includes(stage.kind);

  return (
    <div className="flex flex-col gap-3">
      <form
        onSubmit={submit}
        className="flex flex-col gap-2 rounded-2xl border border-border bg-bg-secondary p-4 sm:flex-row sm:items-center"
      >
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-bg-primary px-3 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30">
          <Globe className="h-4 w-4 shrink-0 text-fg-secondary" />
          <input
            type="url"
            inputMode="url"
            placeholder="https://example.com/article"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={busy}
            className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-fg-secondary"
            required
          />
        </div>
        <Button
          type="submit"
          disabled={busy || !url.trim()}
          className="shrink-0"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Ingesting…
            </>
          ) : (
            'Ingest URL'
          )}
        </Button>
      </form>

      {stage.kind !== 'idle' ? <ProgressCard stage={stage} url={url} /> : null}
    </div>
  );
}

function ProgressCard({ stage, url }: { stage: Stage; url: string }) {
  const stageLabel: Record<Stage['kind'], string> = {
    idle: '',
    fetching: 'Fetching page…',
    chunking: 'Splitting into chunks…',
    embedding: 'Embedding chunks…',
    done: 'Done',
    error: 'Failed',
  };

  const overall =
    stage.kind === 'fetching'
      ? 0.2
      : stage.kind === 'chunking'
        ? 0.35
        : stage.kind === 'embedding'
          ? 0.35 + 0.65 * stage.progress
          : stage.kind === 'done'
            ? 1
            : 0;

  const color =
    stage.kind === 'error'
      ? 'bg-accent-error'
      : stage.kind === 'done'
        ? 'bg-accent-success'
        : 'bg-accent';

  return (
    <div className="rounded-xl border border-border bg-bg-secondary p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-tertiary">
          {stage.kind === 'done' ? (
            <Check className="h-4 w-4 text-accent-success" />
          ) : stage.kind === 'error' ? (
            <AlertCircle className="h-4 w-4 text-accent-error" />
          ) : (
            <Loader2 className="h-4 w-4 animate-spin text-accent" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Globe className="h-3.5 w-3.5 shrink-0 text-fg-secondary" />
            <span className="truncate font-mono text-xs text-fg-primary">
              {url || '—'}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-fg-secondary">
            {stage.kind === 'error' ? stage.message : stageLabel[stage.kind]}
            {stage.kind === 'embedding'
              ? ` · ${Math.round(stage.progress * 100)}%`
              : ''}
            {stage.kind === 'done' ? ` · ${stage.chunks} chunks ready` : ''}
          </p>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-bg-tertiary">
        <div
          className={cn('h-full rounded-full transition-all duration-300', color)}
          style={{ width: `${Math.round(overall * 100)}%` }}
        />
      </div>
    </div>
  );
}
