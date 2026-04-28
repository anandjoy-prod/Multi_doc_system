'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Pretty <pre><code> with a header bar (language pill + copy button).
 *
 * Used as the `pre` renderer for react-markdown — react-markdown gives us a
 * <pre> wrapping a single <code class="language-xxx"> child. We pull the
 * language out of the className and the raw text out of children.
 */
export function CodeBlock({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  // The <code> child carries the actual language class.
  const codeEl = extractCodeElement(children);
  const language = readLanguage(codeEl?.props?.className) ?? 'text';
  const raw = readText(codeEl?.props?.children);

  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(raw);
      setCopied(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // Older browsers / iframe sandboxing — fall back to a transient text area.
      const ta = document.createElement('textarea');
      ta.value = raw;
      ta.setAttribute('readonly', '');
      ta.style.position = 'absolute';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        timeoutRef.current = setTimeout(() => setCopied(false), 1500);
      } finally {
        document.body.removeChild(ta);
      }
    }
  }

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-border bg-bg-tertiary text-sm">
      <div className="flex items-center justify-between border-b border-border bg-bg-secondary/60 px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wider text-fg-secondary">
          {language}
        </span>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy code"
          className={cn(
            'flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium transition',
            copied
              ? 'bg-accent-success/15 text-accent-success'
              : 'text-fg-secondary hover:bg-bg-tertiary hover:text-fg-primary',
          )}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" /> Copy
            </>
          )}
        </button>
      </div>
      <pre className={cn('overflow-x-auto px-4 py-3 font-mono text-[13px] leading-relaxed', className)}>
        {children}
      </pre>
    </div>
  );
}

// ----- helpers --------------------------------------------------------------

function extractCodeElement(
  children: React.ReactNode,
): { props: { className?: string; children?: React.ReactNode } } | null {
  // children is usually a single <code> element.
  if (Array.isArray(children)) {
    const found = children.find(
      (c): c is React.ReactElement<{ className?: string; children?: React.ReactNode }> =>
        typeof c === 'object' && c !== null && 'props' in c,
    );
    return found ?? null;
  }
  if (typeof children === 'object' && children !== null && 'props' in children) {
    return children as never;
  }
  return null;
}

function readLanguage(className?: string): string | null {
  if (!className) return null;
  const match = className.match(/language-([^\s]+)/);
  return match?.[1] ?? null;
}

function readText(node: React.ReactNode): string {
  if (node == null || node === false) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(readText).join('');
  if (typeof node === 'object' && 'props' in node) {
    return readText((node as { props: { children?: React.ReactNode } }).props.children);
  }
  return '';
}
