import { NextResponse } from 'next/server';
import { readSessionFromCookies } from '@/lib/auth';
import {
  createSession,
  deleteSession,
  listSessionsForUser,
} from '@/lib/dummy-store';

export const runtime = 'nodejs';

/**
 * GET    /api/chat/sessions          — list mine
 * POST   /api/chat/sessions          — create a new chat
 * DELETE /api/chat/sessions?id=xxx   — delete one
 */

export async function GET() {
  const session = await readSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const sessions = listSessionsForUser(session.sub).map((s) => ({
    id: s.id,
    title: s.title,
    updated_at: s.updated_at,
    message_count: s.messages.length,
  }));
  return NextResponse.json({ sessions });
}

export async function POST() {
  const session = await readSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const fresh = createSession(session.sub);
  return NextResponse.json({ id: fresh.id });
}

export async function DELETE(req: Request) {
  const session = await readSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  deleteSession(id);
  return NextResponse.json({ ok: true });
}
