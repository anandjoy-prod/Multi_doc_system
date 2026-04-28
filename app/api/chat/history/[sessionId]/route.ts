import { NextResponse } from 'next/server';
import { readSessionFromCookies } from '@/lib/auth';
import { getSession } from '@/lib/dummy-store';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ sessionId: string }> },
) {
  const session = await readSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { sessionId } = await ctx.params;

  const chat = getSession(sessionId);
  if (!chat) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (chat.user_id !== session.sub && !session.perms.includes('*')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({
    session: {
      id: chat.id,
      title: chat.title,
      created_at: chat.created_at,
      updated_at: chat.updated_at,
    },
    messages: chat.messages,
  });
}
