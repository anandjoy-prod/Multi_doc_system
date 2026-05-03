import { NextResponse } from 'next/server';
import { readSessionFromCookies } from '@/lib/auth';
import { ingestPdf } from '@/lib/rag/pdf/ingest';
import { ingestExcel } from '@/lib/rag/excel/ingest';
import type { IngestEvent } from '@/lib/rag/types';

export const runtime = 'nodejs';
// Long-running pipeline — large workbook ingestion can take ≥30s.
export const maxDuration = 300;

/** Per-format size caps. */
const SIZE_LIMITS = {
  pdf: 20 * 1024 * 1024,
  excel: 10 * 1024 * 1024,
} as const;

/**
 * POST /api/rag/upload
 *
 * multipart/form-data with `file`. The handler picks the right ingestion
 * pipeline based on extension/MIME:
 *
 *   .pdf                 → ingestPdf
 *   .xlsx, .xls          → ingestExcel
 *
 * Streams NDJSON progress events back regardless of format. Adding a new
 * file type means: write a new ingest async generator and add one case here.
 */
export async function POST(req: Request) {
  const session = await readSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }

  const kind = detectKind(file);
  if (!kind) {
    return NextResponse.json(
      { error: 'Unsupported file type. Allowed: .pdf, .xlsx, .xls' },
      { status: 400 },
    );
  }

  const maxBytes = SIZE_LIMITS[kind];
  if (file.size > maxBytes) {
    return NextResponse.json(
      { error: `File too large (max ${maxBytes / 1024 / 1024}MB for ${kind.toUpperCase()})` },
      { status: 413 },
    );
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'Empty file' }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const encoder = new TextEncoder();

  const generator: AsyncGenerator<IngestEvent> =
    kind === 'pdf'
      ? ingestPdf({
          userId: session.sub,
          filename: file.name,
          fileSize: file.size,
          buffer,
        })
      : ingestExcel({
          userId: session.sub,
          filename: file.name,
          fileSize: file.size,
          buffer,
        });

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const ev of generator) {
          controller.enqueue(encoder.encode(JSON.stringify(ev) + '\n'));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        controller.enqueue(
          encoder.encode(JSON.stringify({ event: 'error', message }) + '\n'),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function detectKind(file: File): 'pdf' | 'excel' | null {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return 'pdf';
  if (
    name.endsWith('.xlsx') ||
    name.endsWith('.xls') ||
    file.type ===
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    file.type === 'application/vnd.ms-excel'
  ) {
    return 'excel';
  }
  return null;
}
