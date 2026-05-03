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

function extractToolEvents(
  metadata: Record<string, unknown> | null,
): { name: string; brief: string }[] {
  if (!metadata || typeof metadata !== 'object') return [];
  const t = (metadata as { tool_events?: unknown[] }).tool_events;
  if (!Array.isArray(t)) return [];
  return t
    .filter(
      (e): e is { name: string; brief: string } =>
        typeof e === 'object' &&
        e !== null &&
        typeof (e as { name?: unknown }).name === 'string' &&
        typeof (e as { brief?: unknown }).brief === 'string',
    )
    .map((e) => ({ name: e.name, brief: e.brief }));
}

function extractSources(metadata: Record<string, unknown> | null): unknown[] {
  if (!metadata || typeof metadata !== 'object') return [];
  const s = (metadata as { sources?: unknown[] }).sources;
  return Array.isArray(s) ? s : [];
}
