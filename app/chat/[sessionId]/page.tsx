import { notFound, redirect } from 'next/navigation';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { readSessionFromCookies } from '@/lib/auth';
import { serverAdmin } from '@/lib/supabase';
import { getGithubIntegration } from '@/lib/github/integration';
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

  /**
   * Auth
   */
  const claims = await readSessionFromCookies();
  if (!claims) {
    redirect(`/login?next=/chat/${sessionId}`);
  }

  const sb = serverAdmin();

  /**
   * Session lookup
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
   * Permission guard
   */
  if (chat.user_id !== claims.sub && !claims.perms.includes('*')) {
    notFound();
  }

  /**
   * Parallel fetch
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
   * Read-only
   */
  const readOnly =
    claims.perms.includes('view_only') && !claims.perms.includes('chat');

  /**
   * GitHub integration
   */
  const integ = await getGithubIntegration(claims.sub);
  const githubRepo = integ?.active_repo ?? null;

  /**
   * IMPORTANT:
   * Build fails because SourceChip shape often differs by project.
   *
   * Common possibilities:
   * 1. { title, url }
   * 2. { label, href }
   *
   * This mapper supports both safely.
   */
  const initialMessages: UIMessage[] = ((msgs ?? []) as MsgRow[]).map(
    (m): UIMessage => ({
      id: String(m.id),

      role:
        m.role === 'user' || m.role === 'assistant' || m.role === 'system'
          ? m.role
          : 'user',

      content: typeof m.content === 'string' ? m.content : '',

      /**
       * Hard cast after validation because project SourceChip shape may vary
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

/**
 * Extract tool events safely
 */
function extractToolEvents(
  metadata: Record<string, unknown> | null,
): ToolEvent[] {
  if (!metadata || typeof metadata !== 'object') {
    return [];
  }

  const t = (metadata as { tool_events?: unknown }).tool_events;

  if (!Array.isArray(t)) {
    return [];
  }

  return t
    .filter(
      (e): e is ToolEvent =>
        typeof e === 'object' &&
        e !== null &&
        typeof (e as Record<string, unknown>).name === 'string' &&
        typeof (e as Record<string, unknown>).brief === 'string',
    )
    .map((e) => ({
      name: e.name,
      brief: e.brief,
    }));
}

/**
 * CRITICAL BUILD FIX:
 * Must NEVER return unknown[]
 *
 * Adjust mapped keys below if your SourceChip uses:
 * - title/url
 * - label/href
 */
function extractSources(
  metadata: Record<string, unknown> | null,
): SourceChip[] {
  if (!metadata || typeof metadata !== 'object') {
    return [];
  }

  const s = (metadata as { sources?: unknown }).sources;

  if (!Array.isArray(s)) {
    return [];
  }

  return s
    .filter(
      (src): src is Record<string, unknown> =>
        typeof src === 'object' && src !== null,
    )
    .map((src) => {
      /**
       * Supports multiple DB formats:
       * { title, url }
       * { label, href }
       */
      const title =
        typeof src.title === 'string'
          ? src.title
          : typeof src.label === 'string'
            ? src.label
            : '';

      const url =
        typeof src.url === 'string'
          ? src.url
          : typeof src.href === 'string'
            ? src.href
            : '';

      /**
       * IMPORTANT:
       * If your project's SourceChip requires label/href,
       * replace below return with:
       *
       * return {
       *   label: title,
       *   href: url,
       * } as SourceChip;
       */
      return {
        title,
        url,
      } as SourceChip;
    })
    .filter((src) => {
      /**
       * Remove empty invalid entries
       */
      const item = src as Record<string, unknown>;

      return (
        (typeof item.title === 'string' && item.title.length > 0) ||
        (typeof item.label === 'string' && item.label.length > 0)
      );
    });
}