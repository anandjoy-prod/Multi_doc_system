import { NextResponse } from 'next/server';
import { readSessionFromCookies } from '@/lib/auth';
import { serverAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

interface SessionRow {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

interface MsgRow {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ sessionId: string }> },
) {
  const session = await readSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { sessionId } = await ctx.params;

  const sb = serverAdmin();
  const { data: chat, error: sErr } = await sb
    .from('chat_sessions')
    .select('id, user_id, title, created_at, updated_at')
    .eq('id', sessionId)
    .maybeSingle<SessionRow>();

  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
  if (!chat) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (chat.user_id !== session.sub && !session.perms.includes('*')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: messages } = await sb
    .from('messages')
    .select('id, role, content, metadata, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  return NextResponse.json({
    session: {
      id: chat.id,
      title: chat.title ?? 'New chat',
      created_at: chat.created_at,
      updated_at: chat.updated_at,
    },
    messages: (messages ?? []) as MsgRow[],
  });
}
