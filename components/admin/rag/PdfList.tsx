'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Globe,
  Sheet as SheetIcon,
  Trash2,
  Loader2,
  Check,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/shared/Button';
import { cn } from '@/lib/cn';
import type { DocumentStatus } from '@/lib/rag/types';

export interface PdfRow {
  id: string;
  source?: 'pdf' | 'url' | 'excel' | string;
  filename: string;
  file_size: number;
  total_pages: number | null;
  status: DocumentStatus;
  chunks_count: number;
  error: string | null;
  created_at: string;
}

const STATUS_LABEL: Record<DocumentStatus, string> = {
  pending: 'Queued',
  extracting: 'Extracting',
  chunking: 'Chunking',
  embedding: 'Embedding',
  ready: 'Ready',
  failed: 'Failed',
};

function fmtSize(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function StatusPill({ status }: { status: DocumentStatus }) {
  const cls =
    status === 'ready'
      ? 'border-accent-success/40 text-accent-success'
      : status === 'failed'
        ? 'border-accent-error/40 text-accent-error'
        : 'border-border text-fg-secondary';
  const Icon =
    status === 'ready'
      ? Check
      : status === 'failed'
        ? AlertCircle
        : Loader2;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]',
        cls,
      )}
    >
      <Icon
        className={cn(
          'h-3 w-3',
          status !== 'ready' && status !== 'failed' && 'animate-spin',
        )}
      />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function PdfList({ initial }: { initial: PdfRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<PdfRow[]>(initial);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Stay in sync if the server component re-renders with new initial data.
  useEffect(() => {
    setRows(initial);
  }, [initial]);

  // Live status polling for any non-terminal docs (cheap; one query/2s).
  useEffect(() => {
    const inFlight = rows.some(
      (r) => r.status !== 'ready' && r.status !== 'failed',
    );
    if (!inFlight) return;

    const t = setInterval(async () => {
      const res = await fetch('/api/rag/documents');
      if (!res.ok) return;
      const data = await res.json();
      setRows((data.documents ?? []) as PdfRow[]);
    }, 2000);
    return () => clearInterval(t);
  }, [rows]);

  async function remove(id: string) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/rag/documents/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        setDeleting(null);
        return;
      }
      setRows((prev) => prev.filter((r) => r.id !== id));
      router.refresh();
    } finally {
      setDeleting(null);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-fg-secondary">
        No PDFs yet — upload one above to enable retrieval-augmented chat.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-bg-secondary">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-fg-secondary">
            <th className="px-4 py-3 font-medium">File</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="hidden px-4 py-3 font-medium sm:table-cell">Pages</th>
            <th className="hidden px-4 py-3 font-medium sm:table-cell">Chunks</th>
            <th className="hidden px-4 py-3 font-medium md:table-cell">Size</th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.id} className="transition hover:bg-bg-tertiary">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  {r.source === 'url' ? (
                    <Globe className="h-4 w-4 shrink-0 text-fg-secondary" />
                  ) : r.source === 'excel' ? (
                    <SheetIcon className="h-4 w-4 shrink-0 text-fg-secondary" />
                  ) : (
                    <FileText className="h-4 w-4 shrink-0 text-fg-secondary" />
                  )}
                  <span className="truncate font-medium">{r.filename}</span>
                </div>
                {r.error ? (
                  <p className="mt-0.5 text-xs text-accent-error">
                    {r.error}
                  </p>
                ) : null}
              </td>
              <td className="px-4 py-3">
                <StatusPill status={r.status} />
              </td>
              <td className="hidden px-4 py-3 text-fg-secondary sm:table-cell">
                {r.total_pages ?? '—'}
              </td>
              <td className="hidden px-4 py-3 text-fg-secondary sm:table-cell">
                {r.chunks_count}
              </td>
              <td className="hidden px-4 py-3 text-fg-secondary md:table-cell">
                {fmtSize(r.file_size)}
              </td>
              <td className="px-2 py-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(r.id)}
                  disabled={deleting === r.id}
                  aria-label={`Delete ${r.filename}`}
                >
                  {deleting === r.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
