'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { MessageSquare, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';

interface SessionRow {
  id: string;
  title: string;
  updated_at: string;
  message_count: number;
}

/**
 * Session list. When `embedded` (rendered inside the mobile drawer that
 * already has its own header), we drop the redundant title bar and show
 * a slimmer "+ New" row instead.
 */
export function SessionList({ embedded = false }: { embedded?: boolean } = {}) {
  const router = useRouter();
  const params = useParams<{ sessionId?: string }>();
  const activeId = params?.sessionId;

  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const r = await fetch('/api/chat/sessions');
    const d = await r.json();
    setSessions(d.sessions ?? []);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function newChat() {
    const r = await fetch('/api/chat/sessions', { method: 'POST' });
    const d = await r.json();
    if (d.id) {
      await refresh();
      router.push(`/chat/${d.id}`);
    }
  }

  async function remove(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    await fetch(`/api/chat/sessions?id=${id}`, { method: 'DELETE' });
    if (activeId === id) router.push('/chat');
    refresh();
  }

  return (
    <div className="flex h-full flex-col">
      {embedded ? (
        <div className="border-b border-border px-3 py-2">
          <button
            onClick={newChat}
            className="flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-accent text-sm font-medium text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Plus className="h-4 w-4" /> New chat
          </button>
        </div>
      ) : (
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <span className="font-display text-sm font-semibold tracking-tight">
            Conversations
          </span>
          <button
            onClick={newChat}
            className="flex h-7 items-center gap-1 rounded-md bg-accent px-2 text-xs font-medium text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Plus className="h-3.5 w-3.5" /> New
          </button>
        </div>
      )}

      <nav aria-label="Conversations" className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="space-y-2 p-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-10 animate-pulse rounded-md bg-bg-tertiary"
              />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-fg-secondary">
            No conversations yet. Click <span className="font-medium">New</span> to start one.
          </div>
        ) : (
          sessions.map((s) => {
            const active = s.id === activeId;
            return (
              <Link
                key={s.id}
                href={`/chat/${s.id}`}
                className={cn(
                  'group mb-1 flex items-start gap-2 rounded-md px-2 py-2 text-sm transition',
                  active
                    ? 'bg-bg-tertiary text-fg-primary'
                    : 'text-fg-secondary hover:bg-bg-tertiary hover:text-fg-primary',
                )}
              >
                <MessageSquare className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{s.title}</span>
                <button
                  onClick={(e) => remove(s.id, e)}
                  className="opacity-0 transition group-hover:opacity-100"
                  aria-label="Delete chat"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </Link>
            );
          })
        )}
      </nav>
    </div>
  );
}
