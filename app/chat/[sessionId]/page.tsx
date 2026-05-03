import { notFound, redirect } from 'next/navigation';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { readSessionFromCookies } from '@/lib/auth';
import { serverAdmin } from '@/lib/supabase';
import { getGithubIntegration } from '@/lib/github/integration';

/**
 * IMPORTANT:
 * Replace this import path with wherever UIMessage / SourceChip are actually defined
 * If ChatInterface exports them, use:
 *
 * import type { UIMessage, SourceChip } from '@/components/chat/ChatInterface';
 */
import type { UIMessage, SourceChip } from '@/components/chat/types';

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

interface ToolEvent {
  name: string;
  brief: string;
}

export default async function ChatSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  const claims = await readSessionFromCookies();
  if (!claims) {
    redirect(`/login?next=/chat/${sessionId}`);
  }

  const sb = serverAdmin();

  const { data: chat } = await sb
    .from('chat_sessions')
    .select('id, user_id, title')
    .eq('id', sessionId)
    .maybeSingle<SessionRow>();

  if (!chat) {
    notFound();
  }

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

  /**
   * EXPLICITLY TYPE THIS AS UIMessage[]
   * This forces TypeScript to validate exact shape
   */
  const initialMessages: UIMessage[] = ((msgs ?? []) as MsgRow[]).map(
    (m): UIMessage => ({
      id: m.id,

      role:
        m.role === 'user' || m.role === 'assistant' || m.role === 'system'
          ? m.role
          : 'user',

      content: typeof m.content === 'string' ? m.content : '',

      /**
       * CRITICAL:
       * Must return SourceChip[] EXACTLY
       */
      sources: extractSources(m.metadata),

      toolEvents: extractToolEvents(m.metadata),
    }),
  );

  return (
    <ChatInterface
      sessionId={chat.id}
      readOnly={readOnly}
      indexedDocs={docsCount ?? 0}
      githubRepo={githubRepo}
      initialMessages={initialMessages}
    />
  );
}

function extractToolEvents(
  metadata: Record<string, unknown> | null,
): ToolEvent[] {
  if (!metadata || typeof metadata !== 'object') {
    return [];
  }

  const t = (metadata as { tool_events?: unknown[] }).tool_events;

  if (!Array.isArray(t)) {
    return [];
  }

  return t
    .filter(
      (e): e is ToolEvent =>
        typeof e === 'object' &&
        e !== null &&
        typeof (e as { name?: unknown }).name === 'string' &&
        typeof (e as { brief?: unknown }).brief === 'string',
    )
    .map((e) => ({
      name: e.name,
      brief: e.brief,
    }));
}

/**
 * THIS IS THE BUILD FIX
 * Return type MUST be SourceChip[]
 */
function extractSources(
  metadata: Record<string, unknown> | null,
): SourceChip[] {
  if (!metadata || typeof metadata !== 'object') {
    return [];
  }

  const s = (metadata as { sources?: unknown[] }).sources;

  if (!Array.isArray(s)) {
    return [];
  }

  return s
    .filter(
      (src): src is SourceChip =>
        typeof src === 'object' &&
        src !== null &&
        'title' in src &&
        'url' in src &&
        typeof (src as { title?: unknown }).title === 'string' &&
        typeof (src as { url?: unknown }).url === 'string',
    )
    .map((src) => ({
      title: src.title,
      url: src.url,
    }));
}