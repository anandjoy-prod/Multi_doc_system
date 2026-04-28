import { notFound, redirect } from 'next/navigation';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { readSessionFromCookies } from '@/lib/auth';
import { getSession } from '@/lib/dummy-store';

export default async function ChatSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const claims = await readSessionFromCookies();
  if (!claims) redirect(`/login?next=/chat/${sessionId}`);

  const chat = getSession(sessionId);
  if (!chat) notFound();

  if (chat.user_id !== claims.sub && !claims.perms.includes('*')) {
    notFound();
  }

  const readOnly =
    claims.perms.includes('view_only') && !claims.perms.includes('chat');

  return (
    <ChatInterface
      sessionId={chat.id}
      readOnly={readOnly}
      initialMessages={chat.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
      }))}
    />
  );
}
