import { NextResponse } from 'next/server';
import { readSessionFromCookies } from '@/lib/auth';
import { serverAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

/**
 * GET    /api/chat/sessions          — list mine
 * POST   /api/chat/sessions          — create a new chat
 * DELETE /api/chat/sessions?id=xxx   — delete one (owner-only)
 */

export async function GET() {
  const session = await readSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = serverAdmin();
  const { data, error } = await sb
    .from('chat_sessions')
    .select('id, title, updated_at')
    .eq('user_id', session.sub)
    .order('updated_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    sessions: (data ?? []).map((s) => ({
      id: s.id,
      title: s.title ?? 'New chat',
      updated_at: s.updated_at,
    })),
  });
}

export async function POST() {
  const session = await readSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = serverAdmin();
  const { data, error } = await sb
    .from('chat_sessions')
    .insert({ user_id: session.sub, title: 'New chat' })
    .select('id')
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? 'Failed to create' },
      { status: 500 },
    );
  }
  return NextResponse.json({ id: data.id });
}

export async function DELETE(req: Request) {
  const session = await readSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const sb = serverAdmin();
  // Owner check: only delete if user_id matches (admins delete via dashboard).
  const { error } = await sb
    .from('chat_sessions')
    .delete()
    .eq('id', id)
    .eq('user_id', session.sub);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
