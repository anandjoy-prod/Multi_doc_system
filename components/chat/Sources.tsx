'use client';

import { useState } from 'react';
import {
  FileText,
  Globe,
  Sheet as SheetIcon,
  ChevronDown,
  ExternalLink,
  BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/cn';

export interface SourceChip {
  n: number;
  filename: string;
  page: number | null;
  sheet?: string | null;
  url?: string | null;
  snippet: string;
}

/**
 * Source citations rendered under an assistant message.
 *
 * The label and chip group together announce that this answer was grounded
 * in indexed documents, so users can tell at a glance whether the model
 * answered from their material vs. general knowledge.
 *
 * Click any chip to expand its snippet inline. URL-source chips also get
 * an external-link icon that opens the original page in a new tab.
 */
export function Sources({ sources }: { sources: SourceChip[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  if (!sources?.length) return null;

  // Distinct documents (chips can come from the same file).
  const distinctDocs = new Set(sources.map((s) => s.filename)).size;

  return (
    <div className="mt-3 rounded-xl border border-accent/20 bg-accent/5 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-accent">
        <BookOpen className="h-3.5 w-3.5" />
        Grounded in {sources.length}{' '}
        {sources.length === 1 ? 'source' : 'sources'} from{' '}
        {distinctDocs === 1
          ? 'your document'
          : `${distinctDocs} of your documents`}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {sources.map((s, i) => {
          const isOpen = openIdx === i;
          const Icon = s.url ? Globe : s.sheet ? SheetIcon : FileText;
          const locationLabel = s.url
            ? null
            : s.page
              ? `p.${s.page}`
              : s.sheet
                ? `Sheet: ${s.sheet}`
                : null;
          return (
            <span
              key={`${s.filename}-${s.n}-${i}`}
              className={cn(
                'inline-flex max-w-full items-center gap-1.5 rounded-full border bg-bg-primary px-2.5 py-1 text-[11px] transition',
                isOpen
                  ? 'border-accent text-fg-primary'
                  : 'border-border text-fg-secondary hover:border-accent/40 hover:text-fg-primary',
              )}
            >
              <button
                type="button"
                onClick={() => setOpenIdx(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="inline-flex items-center gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span className="font-mono text-[10px] text-fg-secondary">
                  [{s.n}]
                </span>
                <Icon className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {s.filename}
                  {locationLabel ? ` · ${locationLabel}` : ''}
                </span>
                <ChevronDown
                  className={cn(
                    'h-3 w-3 shrink-0 transition',
                    isOpen && 'rotate-180',
                  )}
                />
              </button>
              {s.url ? (
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${s.filename} in a new tab`}
                  className="ml-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-fg-secondary transition hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </span>
          );
        })}
      </div>

      {openIdx !== null && sources[openIdx] ? (
        <blockquote className="mt-3 rounded-lg border border-border bg-bg-secondary px-3 py-2 font-mono text-[11px] leading-relaxed text-fg-secondary">
          {sources[openIdx]!.snippet}
          {sources[openIdx]!.snippet.length >= 220 ? '…' : ''}
        </blockquote>
      ) : null}
    </div>
  );
}
