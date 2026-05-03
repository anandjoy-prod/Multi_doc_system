'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Loader2, FileText, AlertCircle, Check } from 'lucide-react';
import { Button } from '@/components/shared/Button';
import { cn } from '@/lib/cn';

type Stage =
  | { kind: 'idle' }
  | { kind: 'extracting' }
  | { kind: 'chunking'; chunks: number }
  | { kind: 'embedding'; progress: number; chunks: number }
  | { kind: 'done'; chunks: number }
  | { kind: 'error'; message: string };

interface NdjsonEvent {
  event: 'started' | 'extracted' | 'chunking' | 'embedding' | 'done' | 'error';
  documentId?: string;
  pages?: number;
  chunks?: number;
  progress?: number;
  message?: string;
}

const PDF_MAX = 20 * 1024 * 1024;
const EXCEL_MAX = 10 * 1024 * 1024;
const ACCEPT = '.pdf,.xlsx,.xls,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel';

function detectKind(file: File): 'pdf' | 'excel' | null {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return 'pdf';
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return 'excel';
  if (file.type === 'application/pdf') return 'pdf';
  if (
    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    file.type === 'application/vnd.ms-excel'
  ) {
    return 'excel';
  }
  return null;
}

/**
 * Drag-and-drop PDF uploader. Streams NDJSON progress events from
 * /api/rag/upload and renders a live progress bar across the four stages
 * (extracting → chunking → embedding → done).
 */
export function PdfUploader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [stage, setStage] = useState<Stage>({ kind: 'idle' });
  const [filename, setFilename] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(file: File) {
    const kind = detectKind(file);
    if (!kind) {
      setStage({
        kind: 'error',
        message: 'Unsupported file type. Use .pdf, .xlsx, or .xls.',
      });
      return;
    }
    const max = kind === 'pdf' ? PDF_MAX : EXCEL_MAX;
    if (file.size > max) {
      setStage({
        kind: 'error',
        message: `File too large (max ${max / 1024 / 1024}MB for ${kind.toUpperCase()}).`,
      });
      return;
    }
    setFilename(file.name);
    setStage({ kind: 'extracting' });

    const fd = new FormData();
    fd.append('file', file);

    let res: Response;
    try {
      res = await fetch('/api/rag/upload', { method: 'POST', body: fd });
    } catch {
      setStage({ kind: 'error', message: 'Network error.' });
      return;
    }

    if (!res.ok || !res.body) {
      const body = await res.json().catch(() => ({}));
      setStage({
        kind: 'error',
        message: body?.error ?? `Upload failed (${res.status})`,
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

      // Parse each complete NDJSON line.
      let nl = buffer.indexOf('\n');
      while (nl !== -1) {
        const raw = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        nl = buffer.indexOf('\n');
        if (!raw) continue;
        try {
          const ev: NdjsonEvent = JSON.parse(raw);
          applyEvent(ev);
        } catch {
          // Ignore malformed lines.
        }
      }
    }

    // Refresh the server-rendered list once we're done so the new doc shows.
    router.refresh();

    function applyEvent(ev: NdjsonEvent) {
      switch (ev.event) {
        case 'started':
          break;
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
          // Auto-clear after a moment so the dropzone is ready again.
          setTimeout(() => {
            setStage({ kind: 'idle' });
            setFilename(null);
            router.refresh();
          }, 1500);
          break;
        case 'error':
          setStage({ kind: 'error', message: ev.message ?? 'Failed' });
          break;
      }
    }
  }

  function onPick() {
    inputRef.current?.click();
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  }

  const busy = !['idle', 'done', 'error'].includes(stage.kind);

  return (
    <div className="flex flex-col gap-3">
      <div
        role="button"
        tabIndex={0}
        onClick={busy ? undefined : onPick}
        onKeyDown={(e) => {
          if (!busy && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onPick();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          'flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          dragOver
            ? 'border-accent bg-accent/5'
            : 'border-border bg-bg-secondary hover:border-accent/50 hover:bg-bg-tertiary',
          busy ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
        )}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-bg-tertiary text-accent">
          <Upload className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-medium">
            Drop a PDF or Excel file here, or click to choose
          </p>
          <p className="mt-0.5 text-xs text-fg-secondary">
            PDF up to 20 MB · Excel (.xlsx/.xls) up to 10 MB · extraction and embedding happen automatically
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />
      </div>

      {stage.kind !== 'idle' ? (
        <ProgressCard stage={stage} filename={filename} />
      ) : null}
    </div>
  );
}

function ProgressCard({
  stage,
  filename,
}: {
  stage: Stage;
  filename: string | null;
}) {
  const stageLabel: Record<Stage['kind'], string> = {
    idle: '',
    extracting: 'Extracting text…',
    chunking: 'Splitting into chunks…',
    embedding: 'Embedding chunks…',
    done: 'Done',
    error: 'Failed',
  };

  // Compose a 0-to-1 progress that crosses all four stages.
  const overall =
    stage.kind === 'extracting'
      ? 0.15
      : stage.kind === 'chunking'
        ? 0.3
        : stage.kind === 'embedding'
          ? 0.3 + 0.7 * stage.progress
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
            <FileText className="h-3.5 w-3.5 shrink-0 text-fg-secondary" />
            <span className="truncate font-mono text-xs text-fg-primary">
              {filename ?? 'PDF'}
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
