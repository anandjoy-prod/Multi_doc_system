import { notFound, redirect } from 'next/navigation';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { readSessionFromCookies } from '@/lib/auth';
import { serverAdmin } from '@/lib/supabase';
import { getGithubIntegration } from '@/lib/github/integration';
import type { SourceChip } from '@/components/chat/Sources';
import type { ToolEvent } from '@/components/chat/ToolTrace';

export const dynamic = 'force-dynamic';

interface SessionRow {
  id: string;
  user_id: string;
  title: string | null;
}

interface MsgRow {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata: Record<string, unknown> | null;
}

export default async function ChatSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  const claims = await readSessionFromCookies();
  if (!claims) redirect(`/login?next=/chat/${sessionId}`);

  const sb = serverAdmin();

  const { data: chat } = await sb
    .from('chat_sessions')
    .select('id, user_id, title')
    .eq('id', sessionId)
    .maybeSingle<SessionRow>();

  if (!chat) notFound();
  if (chat.user_id !== claims.sub && !claims.perms.includes('*')) {
    notFound();
  }

  const [{ data: msgs }, { count: docsCount }] = await Promise.all([
    sb
      .from('messages')
      .select('id, role, content, metadata')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true }),
    sb
      .from('rag_documents')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'ready'),
  ]);

  const readOnly =
    claims.perms.includes('view_only') && !claims.perms.includes('chat');

  const integ = await getGithubIntegration(claims.sub);
  const githubRepo = integ?.active_repo ?? null;

  return (
    <ChatInterface
      sessionId={chat.id}
      readOnly={readOnly}
      indexedDocs={docsCount ?? 0}
      githubRepo={githubRepo}
      initialMessages={((msgs ?? []) as MsgRow[]).map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        sources: extractSources(m.metadata),
        toolEvents: extractToolEvents(m.metadata),
      }))}
    />
  );
}

// ----- type-narrowed metadata extractors ----------------------------------

function isSourceChip(value: unknown): value is SourceChip {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.n === 'number' &&
    typeof v.filename === 'string' &&
    typeof v.snippet === 'string' &&
    (v.page === null || typeof v.page === 'number' || v.page === undefined)
  );
}

function extractSources(metadata: Record<string, unknown> | null): SourceChip[] {
  if (!metadata) return [];
  const raw = (metadata as { sources?: unknown }).sources;
  if (!Array.isArray(raw)) return [];
  const out: SourceChip[] = [];
  for (const item of raw) {
    if (isSourceChip(item)) out.push(item);
  }
  return out;
}

function isToolEvent(value: unknown): value is ToolEvent {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.name === 'string' && typeof v.brief === 'string';
}

function extractToolEvents(
  metadata: Record<string, unknown> | null,
): ToolEvent[] {
  if (!metadata) return [];
  const raw = (metadata as { tool_events?: unknown }).tool_events;
  if (!Array.isArray(raw)) return [];
  const out: ToolEvent[] = [];
  for (const item of raw) {
    if (isToolEvent(item)) out.push(item);
  }
  return out;
}