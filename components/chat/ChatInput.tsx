'use client';

import { useEffect, useRef } from 'react';
import { ArrowUp, Loader2 } from 'lucide-react';

export function ChatInput({
  value,
  onChange,
  onSubmit,
  disabled,
  streaming,
  placeholder = 'Message the assistant…',
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  streaming?: boolean;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  // Auto-grow textarea up to ~6 lines.
  useEffect(() => {
    const t = ref.current;
    if (!t) return;
    t.style.height = 'auto';
    t.style.height = Math.min(t.scrollHeight, 180) + 'px';
  }, [value]);

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) onSubmit();
    }
  }

  const canSend = !!value.trim() && !disabled && !streaming;

  return (
    <div className="rounded-2xl border border-border bg-bg-secondary p-2 shadow-sm focus-within:ring-2 focus-within:ring-accent/30">
      <textarea
        ref={ref}
        rows={1}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKey}
        placeholder={placeholder}
        className="block w-full resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-fg-secondary"
      />
      <div className="flex items-center justify-between px-2 pb-1 pt-1">
        <span className="text-[11px] text-fg-secondary">
          Enter to send · Shift + Enter for newline
        </span>
        <button
          onClick={onSubmit}
          disabled={!canSend}
          aria-label="Send message"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white transition hover:opacity-90 disabled:opacity-40"
        >
          {streaming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowUp className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}
