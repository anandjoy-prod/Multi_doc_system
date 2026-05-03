import { NextResponse } from 'next/server';
import { readSessionFromCookies } from '@/lib/auth';
import { serverAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

/**
 * GET /api/rag/documents — list this user's PDFs (any status).
 */
export async function GET() {
  const session = await readSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const sb = serverAdmin();
  const { data, error } = await sb
    .from('rag_documents')
    .select(
      'id, filename, file_size, total_pages, status, chunks_count, error, created_at, updated_at',
    )
    .eq('user_id', session.sub)
    .order('created_at', { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ documents: data ?? [] });
}
