import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readSessionFromCookies } from '@/lib/auth';
import { ingestUrl } from '@/lib/rag/url/ingest';

export const runtime = 'nodejs';
export const maxDuration = 120;

const Body = z.object({
  url: z.string().url().max(2000),
});

/**
 * POST /api/rag/url — JSON { url }, streams NDJSON progress like
 * /api/rag/upload. SSRF-safe (see lib/rag/url/fetch.ts).
 */
export async function POST(req: Request) {
  const session = await readSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid body' },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const ev of ingestUrl({
          userId: session.sub,
          url: parsed.data.url,
        })) {
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
