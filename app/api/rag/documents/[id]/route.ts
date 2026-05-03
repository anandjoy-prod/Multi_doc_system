import { NextResponse } from 'next/server';
import { readSessionFromCookies } from '@/lib/auth';
import { serverAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

/**
 * DELETE /api/rag/documents/:id — owner-only delete. The ON DELETE CASCADE
 * on rag_chunks.document_id removes all chunks too.
 */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await readSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await ctx.params;
  const sb = serverAdmin();
  const { error } = await sb
    .from('rag_documents')
    .delete()
    .eq('id', id)
    .eq('user_id', session.sub);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
