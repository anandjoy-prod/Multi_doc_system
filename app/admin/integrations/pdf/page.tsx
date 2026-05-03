import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { readSessionFromCookies } from '@/lib/auth';
import { serverAdmin } from '@/lib/supabase';
import { PdfUploader } from '@/components/admin/rag/PdfUploader';
import { UrlIngest } from '@/components/admin/rag/UrlIngest';
import { PdfList, type PdfRow } from '@/components/admin/rag/PdfList';

export const dynamic = 'force-dynamic';

export default async function DocumentsIntegrationPage() {
  const session = await readSessionFromCookies();
  if (!session) redirect('/login?next=/admin/integrations/pdf');

  const sb = serverAdmin();
  const { data } = await sb
    .from('rag_documents')
    .select(
      'id, source, filename, file_size, total_pages, status, chunks_count, error, created_at',
    )
    .eq('user_id', session.sub)
    .order('created_at', { ascending: false });

  const documents = (data ?? []) as PdfRow[];
  const ready = documents.filter((d) => d.status === 'ready').length;
  const totalChunks = documents.reduce((acc, d) => acc + d.chunks_count, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/integrations"
          className="inline-flex items-center gap-1 text-xs text-fg-secondary hover:text-fg-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Integrations
        </Link>
        <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight">
          Documents
        </h2>
        <p className="text-sm text-fg-secondary">
          Add PDFs, Excel files, or web pages to ground assistant answers in
          your own knowledge base.{' '}
          {ready > 0
            ? `${ready} ready · ${totalChunks} chunks indexed`
            : 'Nothing indexed yet.'}
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-medium uppercase tracking-wider text-fg-secondary">
          Add a web page
        </h3>
        <UrlIngest />
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-medium uppercase tracking-wider text-fg-secondary">
          Upload a document (PDF or Excel)
        </h3>
        <PdfUploader />
      </section>

      <PdfList initial={documents} />

      <details className="rounded-xl border border-border bg-bg-secondary p-4 text-sm text-fg-secondary">
        <summary className="cursor-pointer font-medium text-fg-primary">
          How retrieval works
        </summary>
        <ol className="mt-3 list-decimal space-y-1 pl-5 leading-relaxed">
          <li>
            <span className="font-medium text-fg-primary">Extract</span> — PDFs
            via <code className="font-mono text-xs">unpdf</code>; Excel via{' '}
            <code className="font-mono text-xs">exceljs</code> (each sheet
            rendered as header + key:value rows for embedding-friendly text);
            web pages via{' '}
            <code className="font-mono text-xs">@mozilla/readability</code>{' '}
            (drops nav, ads, footers).
          </li>
          <li>
            <span className="font-medium text-fg-primary">Chunk</span> —
            sentence-aware ~800-character chunks with 100-character overlap.
          </li>
          <li>
            <span className="font-medium text-fg-primary">Embed</span> — each
            chunk via{' '}
            <code className="font-mono text-xs">text-embedding-3-small</code>{' '}
            stored in Supabase pgvector.
          </li>
          <li>
            <span className="font-medium text-fg-primary">Retrieve</span> —
            hybrid search (semantic + Postgres full-text), top 5 chunks
            injected into the system prompt with citation markers.
          </li>
        </ol>
        <p className="mt-3 text-xs">
          URL fetches block private IP ranges, cap response size at 5 MB, and
          time out at 30 s.
        </p>
      </details>
    </div>
  );
}
