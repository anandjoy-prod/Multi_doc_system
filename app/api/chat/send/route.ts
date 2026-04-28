import { NextResponse } from 'next/server';
import { z } from 'zod';
import { llm, DEFAULT_MODEL } from '@/lib/llm';
import { readSessionFromCookies } from '@/lib/auth';
import {
  appendMessage,
  createSession,
  getSession,
} from '@/lib/dummy-store';

export const runtime = 'nodejs';

const Body = z.object({
  // sessionId is optional — when missing we create a new one.
  sessionId: z.string().optional(),
  message: z.string().min(1).max(8000),
});

/**
 * POST /api/chat/send
 *
 * Streams a GitHub Models completion back as plain text chunks. The browser
 * reads it with `fetch().body.getReader()` — no SDK on the client.
 *
 * We send the new sessionId in a custom response header on the first chunk
 * so the UI can navigate to /chat/[sessionId] after the first turn.
 */
export async function POST(req: Request) {
  const session = await readSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const { sessionId: incomingId, message } = parsed.data;

  // Look up or create the session.
  let chat = incomingId ? getSession(incomingId) : undefined;
  if (incomingId && !chat) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }
  if (!chat) chat = createSession(session.sub);
  if (chat.user_id !== session.sub) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Block viewers (read-only) from sending.
  if (session.perms.includes('view_only') && !session.perms.includes('chat')) {
    return NextResponse.json(
      { error: 'Your role is read-only.' },
      { status: 403 },
    );
  }

  appendMessage(chat.id, 'user', message);

  // Build the prompt: system + last 10 messages, oldest first.
  const recent = chat.messages.slice(-10);
  const messages = [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    ...recent.map((m) => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    })),
  ];

  let completion;
  try {
    completion = await llm().chat.completions.create({
      model: DEFAULT_MODEL,
      stream: true,
      messages,
      temperature: 0.4,
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Unknown LLM error';
    appendMessage(chat.id, 'assistant', `(Model error: ${reason})`);
    return NextResponse.json({ error: reason }, { status: 502 });
  }

  const encoder = new TextEncoder();
  const sessionIdForCapture = chat.id;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let assistantContent = '';
      try {
        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content ?? '';
          if (delta) {
            assistantContent += delta;
            controller.enqueue(encoder.encode(delta));
          }
        }
      } catch (err) {
        controller.error(err);
        return;
      } finally {
        if (assistantContent) {
          appendMessage(sessionIdForCapture, 'assistant', assistantContent);
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Session-Id': chat.id,
    },
  });
}

const SYSTEM_PROMPT = `You are a helpful AI assistant in an enterprise chat application.
Be concise, accurate, and friendly. If you are uncertain, say so.`;
