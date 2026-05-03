import { ChatInterface } from '@/components/chat/ChatInterface';
import { readSessionFromCookies } from '@/lib/auth';
import { serverAdmin } from '@/lib/supabase';
import { getGithubIntegration } from '@/lib/github/integration';

export const dynamic = 'force-dynamic';

export default async function ChatHome() {
  const session = await readSessionFromCookies();
  const readOnly =
    !!session &&
    session.perms.includes('view_only') &&
    !session.perms.includes('chat');

  let indexedDocs = 0;
  let githubRepo: string | null = null;
  if (session) {
    const sb = serverAdmin();
    const { count } = await sb
      .from('rag_documents')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'ready');
    indexedDocs = count ?? 0;

    const integ = await getGithubIntegration(session.sub);
    githubRepo = integ?.active_repo ?? null;
  }

  return (
    <ChatInterface
      readOnly={readOnly}
      indexedDocs={indexedDocs}
      githubRepo={githubRepo}
    />
  );
}
