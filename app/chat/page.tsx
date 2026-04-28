import { ChatInterface } from '@/components/chat/ChatInterface';
import { readSessionFromCookies } from '@/lib/auth';

export default async function ChatHome() {
  const session = await readSessionFromCookies();
  const readOnly =
    !!session &&
    session.perms.includes('view_only') &&
    !session.perms.includes('chat');
  return <ChatInterface readOnly={readOnly} />;
}
