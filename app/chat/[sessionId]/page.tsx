import { notFound, redirect } from 'next/navigation';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { readSessionFromCookies } from '@/lib/auth';
import { serverAdmin } from '@/lib/supabase';
import { getGithubIntegration } from '@/lib/github/integration';

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

/**
 * Must match the exact shape expected by ChatInterface / UIMessage
 */
interface SourceChip {
  title: string;
  url: string;
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

  /**
   * Load chat session
   */
  const { data: chat } = await sb
    .from('chat_sessions')
    .select('id, user_id, title')
    .eq('id', sessionId)
    .maybeSingle<SessionRow>();

  if (!chat) {
    notFound();
  }

  /**
   * Permission check
   */
  if (chat.user_id !== claims.sub && !claims.perms.includes('*')) {
    notFound();
  }

  /**
   * Load messages + indexed docs count in parallel
   */
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

  /**
   * Read-only mode
   */
  const readOnly =
    claims.perms.includes('view_only') && !claims.perms.includes('chat');

  /**
   * GitHub integration
   */
  const integ = await getGithubIntegration(claims.sub);
  const githubRepo = integ?.active_repo ?? null;

  /**
   * Normalize DB messages -> UI-safe messages
   */
  const initialMessages = ((msgs ?? []) as MsgRow[]).map((m) => ({
    id: m.id,

    /**
     * Safety fallback in case DB contains unexpected role
     */
    role:
      m.role === 'user' || m.role === 'assistant' || m.role === 'system'
        ? m.role
        : 'user',

    content: typeof m.content === 'string' ? m.content : '',

    /**
     * Strict typed arrays for Vercel build
     */
    sources: extractSources(m.metadata),
    toolEvents: extractToolEvents(m.metadata),
  }));

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

/**
 * Extract tool events safely from metadata
 */
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
 * Extract sources safely from metadata
 * Ensures compatibility with ChatInterface SourceChip[]
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
        typeof (src as { title?: unknown }).title === 'string' &&
        typeof (src as { url?: unknown }).url === 'string',
    )
    .map((src) => ({
      title: src.title,
      url: src.url,
    }));
}