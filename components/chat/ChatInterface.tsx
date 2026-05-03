'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Github } from 'lucide-react';
import { ChatInput } from './ChatInput';
import { MessageBubble } from './MessageBubble';
import type { SourceChip } from './Sources';
import type { ToolEvent } from './ToolTrace';
import { STARTER_SUGGESTIONS } from '@/lib/constants';

interface UIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: SourceChip[];
  toolEvents?: ToolEvent[];
}

interface Props {
  sessionId?: string;
  initialMessages?: UIMessage[];
  readOnly?: boolean;
  indexedDocs?: number;
  /** Active GitHub repo, if any — surfaces as a banner. */
  githubRepo?: string | null;
}

export function ChatInterface({
  sessionId,
  initialMessages = [],
  readOnly = false,
  indexedDocs = 0,
  githubRepo = null,
}: Props) {
  const router = useRouter();
  const [messages, setMessages] = useState<UIMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

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
      toolEvents: [],
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
    const mode = res.headers.get('X-Chat-Mode') ?? 'rag';

    if (mode === 'github-agent') {
      await consumeNdjsonStream(res, assistantMsg);
    } else {
      const sourcesHeader = res.headers.get('X-Sources');
      let sources: SourceChip[] = [];
      if (sourcesHeader) {
        try {
          sources = JSON.parse(decodeURIComponent(sourcesHeader)) as SourceChip[];
        } catch {
          // header wasn't valid JSON — leave empty
        }
      }
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { ...assistantMsg, sources };
        return copy;
      });
      await consumeTextStream(res, assistantMsg, sources);
    }

    setStreaming(false);

    if (!sessionId && newSessionId) {
      router.push(`/chat/${newSessionId}`);
      router.refresh();
    }
  }

  // ---- consumers ----------------------------------------------------------

  async function consumeTextStream(
    res: Response,
    placeholder: UIMessage,
    sources: SourceChip[],
  ) {
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let acc = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      acc += decoder.decode(value, { stream: true });
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { ...placeholder, content: acc, sources };
        return copy;
      });
    }
  }

  async function consumeNdjsonStream(res: Response, placeholder: UIMessage) {
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let content = '';
    const toolEvents: ToolEvent[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl = buffer.indexOf('\n');
      while (nl !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        nl = buffer.indexOf('\n');
        if (!line) continue;
        try {
          const ev = JSON.parse(line) as {
            type: string;
            delta?: string;
            name?: string;
            brief?: string;
            message?: string;
          };
          if (ev.type === 'content' && typeof ev.delta === 'string') {
            content += ev.delta;
            setMessages((m) => {
              const copy = [...m];
              copy[copy.length - 1] = {
                ...placeholder,
                content,
                toolEvents: [...toolEvents],
              };
              return copy;
            });
          } else if (ev.type === 'tool_result' && ev.name && ev.brief) {
            toolEvents.push({ name: ev.name, brief: ev.brief });
            setMessages((m) => {
              const copy = [...m];
              copy[copy.length - 1] = {
                ...placeholder,
                content,
                toolEvents: [...toolEvents],
              };
              return copy;
            });
          } else if (ev.type === 'error') {
            setError(ev.message ?? 'Agent error');
          }
        } catch {
          // Ignore malformed lines.
        }
      }
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="flex h-full flex-col">
      {githubRepo ? (
        <div className="flex items-center justify-center gap-2 border-b border-accent/20 bg-accent/5 px-4 py-2 text-xs text-accent">
          <Github className="h-3.5 w-3.5" />
          Chatting about <span className="font-mono font-medium">{githubRepo}</span>
          <span className="text-fg-secondary">· agent reads files via tool calls</span>
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-6 py-8">
          {empty ? (
            <EmptyState
              onPick={(s) => send(s)}
              disabled={readOnly}
              indexedDocs={indexedDocs}
              githubRepo={githubRepo}
            />
          ) : (
            messages.map((m) => (
              <MessageBubble
                key={m.id}
                role={m.role}
                content={m.content}
                sources={m.sources}
                toolEvents={m.toolEvents}
              />
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
              placeholder={
                githubRepo
                  ? `Ask about ${githubRepo}…`
                  : 'Message the assistant…'
              }
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
  indexedDocs,
  githubRepo,
}: {
  onPick: (s: string) => void;
  disabled: boolean;
  indexedDocs: number;
  githubRepo: string | null;
}) {
  return (
    <div className="flex flex-col items-center gap-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
        {githubRepo ? (
          <Github className="h-6 w-6" />
        ) : (
          <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
            <path
              d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          {githubRepo ? `Ask about ${githubRepo}` : 'What can I help with?'}
        </h2>

        {githubRepo ? (
          <p className="mt-1 text-sm text-fg-secondary">
            The agent will read files in this repo on demand. Try{' '}
            <span className="italic">"explain the auth flow"</span> or{' '}
            <span className="italic">"how is X tested?"</span>
          </p>
        ) : indexedDocs > 0 ? (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/5 px-3 py-1 text-xs text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            {indexedDocs} {indexedDocs === 1 ? 'document' : 'documents'} indexed
            — your questions can pull from them automatically
          </div>
        ) : (
          <p className="mt-1 text-sm text-fg-secondary">
            Pick a suggestion or type a message below. Upload PDFs or paste a
            URL at{' '}
            <a
              className="text-accent hover:underline"
              href="/admin/integrations/pdf"
            >
              /admin/integrations/pdf
            </a>
            , or connect GitHub at{' '}
            <a
              className="text-accent hover:underline"
              href="/admin/integrations/github"
            >
              /admin/integrations/github
            </a>
            .
          </p>
        )}
      </div>
      {!githubRepo ? (
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
      ) : null}
    </div>
  );
}
