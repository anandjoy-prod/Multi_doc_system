import { NextResponse } from 'next/server';
import { z } from 'zod';
import { llm, DEFAULT_MODEL } from '@/lib/llm';
import { readSessionFromCookies } from '@/lib/auth';
import { serverAdmin } from '@/lib/supabase';
import { retrieve } from '@/lib/rag/registry';
import { recordLlmCall } from '@/lib/observability/track';
import { getGithubIntegration } from '@/lib/github/integration';
import { runGithubAgent } from '@/lib/github/agent';
import type { GithubContext } from '@/lib/github/tools';
import type { RetrievedChunk } from '@/lib/rag/types';

export const runtime = 'nodejs';
export const maxDuration = 300; // agent loops can take longer than plain RAG

const Body = z.object({
  sessionId: z.string().uuid().optional(),
  message: z.string().min(1).max(8000),
});

interface SessionRow {
  id: string;
  user_id: string;
  title: string | null;
}

interface MsgRow {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const BASE_SYSTEM = `You are a helpful AI assistant in an enterprise chat application.
Be concise, accurate, and friendly. If you are uncertain, say so.`;

const RAG_SYSTEM_TEMPLATE = (sources: string) =>
  `You are a helpful AI assistant. The user has indexed the documents below — treat them as reference material they care about.

How to use the context:
- When the user's question is about this material (or clearly related), answer from it and cite the chunks inline as [1], [2], [3] — the numbers map to the Sources list.
- When the question is unrelated to the context, answer from your general knowledge without forcing citations. Do not say "the documents don't cover this" unless the user is explicitly asking about the documents.
- Never fabricate citations and never invent facts about the documents. If a document-specific question isn't answered by the context, say so honestly.

CONTEXT:
${sources}

Be concise.`;

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

  if (session.perms.includes('view_only') && !session.perms.includes('chat')) {
    return NextResponse.json({ error: 'Your role is read-only.' }, { status: 403 });
  }

  const sb = serverAdmin();

  // 1. Load or create the session.
  let chat: SessionRow;
  if (incomingId) {
    const { data, error } = await sb
      .from('chat_sessions')
      .select('id, user_id, title')
      .eq('id', incomingId)
      .maybeSingle<SessionRow>();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    if (data.user_id !== session.sub) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    chat = data;
  } else {
    const title = message.slice(0, 60).trim() || 'New chat';
    const { data, error } = await sb
      .from('chat_sessions')
      .insert({ user_id: session.sub, title })
      .select('id, user_id, title')
      .single<SessionRow>();
    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? 'Failed to create' },
        { status: 500 },
      );
    }
    chat = data;
  }

  // 2. Persist the user message.
  await sb.from('messages').insert({
    session_id: chat.id,
    role: 'user',
    content: message,
  });

  // 3. Auto-title.
  if (!chat.title || chat.title === 'New chat') {
    const newTitle = message.slice(0, 60).trim();
    if (newTitle) {
      await sb.from('chat_sessions').update({ title: newTitle }).eq('id', chat.id);
    }
  }

  // 4. Branch on mode: github agent if a repo is active, else regular RAG.
  const integ = await getGithubIntegration(session.sub);
  const githubModeActive = !!integ && !!integ.active_repo;

  if (githubModeActive) {
    return streamGithubAgent({
      userId: session.sub,
      sessionId: chat.id,
      sb,
      message,
      pat: integ!.pat,
      fullName: integ!.active_repo!,
      branch: integ!.active_branch ?? 'main',
    });
  }

  // ---- RAG / general path (unchanged) ---------------------------------------
  let sources: RetrievedChunk[] = [];
  try {
    sources = await retrieve(session.sub, message, 5);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[rag] retrieval failed', err);
  }

  const systemPrompt = sources.length > 0 ? buildRagSystem(sources) : BASE_SYSTEM;

  const { data: history } = await sb
    .from('messages')
    .select('role, content')
    .eq('session_id', chat.id)
    .order('created_at', { ascending: false })
    .limit(10);

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...(((history ?? []) as MsgRow[]).reverse()),
  ];

  let completion;
  const llmStart = Date.now();
  try {
    completion = await llm().chat.completions.create({
      model: DEFAULT_MODEL,
      stream: true,
      messages,
      temperature: 0.2,
      stream_options: { include_usage: true },
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Unknown LLM error';
    void recordLlmCall({
      userId: session.sub,
      sessionId: chat.id,
      kind: 'chat',
      model: DEFAULT_MODEL,
      latencyMs: Date.now() - llmStart,
      ragChunks: sources.length,
      status: 'error',
      error: reason,
    });
    await sb.from('messages').insert({
      session_id: chat.id,
      role: 'assistant',
      content: `(Model error: ${reason})`,
    });
    return NextResponse.json({ error: reason }, { status: 502 });
  }

  const encoder = new TextEncoder();
  const sessionIdForCapture = chat.id;
  const sourcesForCapture = sources;
  const userIdForCapture = session.sub;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let assistantContent = '';
      let promptTokens = 0;
      let completionTokens = 0;
      try {
        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content ?? '';
          if (delta) {
            assistantContent += delta;
            controller.enqueue(encoder.encode(delta));
          }
          if (chunk.usage) {
            promptTokens = chunk.usage.prompt_tokens ?? 0;
            completionTokens = chunk.usage.completion_tokens ?? 0;
          }
        }
      } catch (err) {
        controller.error(err);
        void recordLlmCall({
          userId: userIdForCapture,
          sessionId: sessionIdForCapture,
          kind: 'chat',
          model: DEFAULT_MODEL,
          promptTokens,
          completionTokens,
          latencyMs: Date.now() - llmStart,
          ragChunks: sourcesForCapture.length,
          status: 'error',
          error: err instanceof Error ? err.message : 'stream failed',
        });
        return;
      } finally {
        if (assistantContent) {
          await sb.from('messages').insert({
            session_id: sessionIdForCapture,
            role: 'assistant',
            content: assistantContent,
            metadata: sourcesForCapture.length
              ? { sources: serialiseSources(sourcesForCapture) }
              : null,
          });
          await sb
            .from('chat_sessions')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', sessionIdForCapture);
          void recordLlmCall({
            userId: userIdForCapture,
            sessionId: sessionIdForCapture,
            kind: 'chat',
            model: DEFAULT_MODEL,
            promptTokens,
            completionTokens,
            latencyMs: Date.now() - llmStart,
            ragChunks: sourcesForCapture.length,
            status: 'ok',
          });
        }
        controller.close();
      }
    },
  });

  const headers: Record<string, string> = {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Session-Id': chat.id,
    'X-Chat-Mode': 'rag',
  };
  if (sources.length > 0) {
    headers['X-Sources'] = encodeURIComponent(
      JSON.stringify(serialiseSources(sources)),
    );
  }
  return new Response(stream, { headers });
}

// ---------------------------------------------------------------------------
// GitHub-agent streaming path.
// ---------------------------------------------------------------------------

interface GithubStreamArgs {
  userId: string;
  sessionId: string;
  sb: ReturnType<typeof serverAdmin>;
  message: string;
  pat: string;
  fullName: string;
  branch: string;
}

async function streamGithubAgent(args: GithubStreamArgs): Promise<Response> {
  const { sb, sessionId, userId, message, pat, fullName, branch } = args;

  const { data: history } = await sb
    .from('messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(10);
  const ordered = ((history ?? []) as MsgRow[]).reverse();
  // Drop the just-appended user message from history so we don't duplicate.
  const trimmed = ordered.length > 0 && ordered[ordered.length - 1]!.role === 'user'
    ? ordered.slice(0, -1)
    : ordered;

  const ctx: GithubContext = {
    token: pat,
    fullName,
    branch,
    cache: new Map(),
  };

  const encoder = new TextEncoder();
  const toolEvents: { name: string; brief: string }[] = [];
  let assistantContent = '';

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const ev of runGithubAgent({
          userId,
          sessionId,
          ctx,
          history: trimmed,
          question: message,
        })) {
          if (ev.type === 'content' && ev.delta) {
            assistantContent += ev.delta;
          }
          if (ev.type === 'tool_result' && ev.name && ev.brief) {
            toolEvents.push({ name: ev.name, brief: ev.brief });
          }
          controller.enqueue(encoder.encode(JSON.stringify(ev) + '\n'));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'agent failed';
        controller.enqueue(
          encoder.encode(JSON.stringify({ type: 'error', message }) + '\n'),
        );
      } finally {
        if (assistantContent) {
          await sb.from('messages').insert({
            session_id: sessionId,
            role: 'assistant',
            content: assistantContent,
            metadata: {
              github_repo: fullName,
              tool_events: toolEvents,
            },
          });
          await sb
            .from('chat_sessions')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', sessionId);
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Session-Id': sessionId,
      'X-Chat-Mode': 'github-agent',
      'X-Github-Repo': fullName,
    },
  });
}

// ---- helpers --------------------------------------------------------------

interface SerialisedSource {
  n: number;
  filename: string;
  page: number | null;
  sheet?: string | null;
  url?: string | null;
  snippet: string;
}

function serialiseSources(chunks: RetrievedChunk[]): SerialisedSource[] {
  return chunks.map((c, i) => ({
    n: i + 1,
    filename: c.filename,
    page: c.page,
    sheet: c.sheet ?? null,
    url: c.sourceUri ?? null,
    snippet: c.content.slice(0, 220),
  }));
}

function locationFor(c: RetrievedChunk): string {
  if (c.sourceUri) return c.filename;
  if (c.page) return `${c.filename} (p. ${c.page})`;
  if (c.sheet) return `${c.filename} (Sheet: ${c.sheet})`;
  return c.filename;
}

function buildRagSystem(chunks: RetrievedChunk[]): string {
  const ctx = chunks
    .map(
      (c, i) =>
        `[${i + 1}] ${locationFor(c)}\n${c.content.slice(0, 800)}`,
    )
    .join('\n\n');
  return RAG_SYSTEM_TEMPLATE(ctx);
}
