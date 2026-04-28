'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChatInput } from './ChatInput';
import { MessageBubble } from './MessageBubble';
import { STARTER_SUGGESTIONS } from '@/lib/dummy-data';

interface UIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface Props {
  sessionId?: string;            // undefined for the empty / "/chat" view
  initialMessages?: UIMessage[];
  readOnly?: boolean;
}

export function ChatInterface({
  sessionId,
  initialMessages = [],
  readOnly = false,
}: Props) {
  const router = useRouter();
  const [messages, setMessages] = useState<UIMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // keep view scrolled to the latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || streaming) return;
    setError(null);
    setInput('');

    const userMsg: UIMessage = {
      id: `tmp-u-${Date.now()}`,
      role: 'user',
      content,
    };
    const assistantMsg: UIMessage = {
      id: `tmp-a-${Date.now()}`,
      role: 'assistant',
      content: '',
    };
    setMessages((m) => [...m, userMsg, assistantMsg]);
    setStreaming(true);

    let res: Response;
    try {
      res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: content }),
      });
    } catch {
      setError('Network error');
      setStreaming(false);
      return;
    }

    if (!res.ok || !res.body) {
      const body = await res.json().catch(() => ({}));
      setError(body?.error ?? `Request failed (${res.status})`);
      setStreaming(false);
      return;
    }

    const newSessionId = res.headers.get('X-Session-Id') ?? sessionId;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let acc = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      acc += decoder.decode(value, { stream: true });
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { ...assistantMsg, content: acc };
        return copy;
      });
    }
    setStreaming(false);

    // First-turn case: server created a session — navigate to it.
    if (!sessionId && newSessionId) {
      router.push(`/chat/${newSessionId}`);
      router.refresh();
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-6 py-8">
          {empty ? (
            <EmptyState onPick={(s) => send(s)} disabled={readOnly} />
          ) : (
            messages.map((m) => (
              <MessageBubble key={m.id} role={m.role} content={m.content} />
            ))
          )}
          {error ? (
            <div className="rounded-lg border border-accent-error/40 bg-accent-error/10 px-3 py-2 text-xs text-accent-error">
              {error}
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t border-border bg-bg-primary/80 px-6 py-4 backdrop-blur">
        <div className="mx-auto w-full max-w-3xl">
          {readOnly ? (
            <div className="rounded-lg border border-border bg-bg-secondary px-4 py-3 text-center text-sm text-fg-secondary">
              Your role is read-only — sending messages is disabled.
            </div>
          ) : (
            <ChatInput
              value={input}
              onChange={setInput}
              onSubmit={() => send()}
              streaming={streaming}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  onPick,
  disabled,
}: {
  onPick: (s: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
          <path
            d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          What can I help with?
        </h2>
        <p className="mt-1 text-sm text-fg-secondary">
          Pick a suggestion or type a message below.
        </p>
      </div>
      <div className="grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
        {STARTER_SUGGESTIONS.map((s) => (
          <button
            key={s}
            disabled={disabled}
            onClick={() => onPick(s)}
            className="rounded-xl border border-border bg-bg-secondary px-4 py-3 text-left text-sm text-fg-primary transition hover:border-accent hover:bg-bg-tertiary disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
