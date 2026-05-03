// =============================================================================
// GitHub agent loop — MCP-style tool calling.
//
// Yields events as the agent works:
//   { type: 'tool_call', name, args }     — agent decided to call a tool
//   { type: 'tool_result', name, brief }  — short summary of the result
//   { type: 'content', delta }            — token from the final answer
//   { type: 'done', usage }               — finished, with totals
//   { type: 'error', message }            — irrecoverable error
//
// The route handler turns each event into an NDJSON line on the response.
// The client renders tool_call/tool_result inline as italic gray lines,
// streams content like normal chat.
//
// Token budget:
//   - Up to MAX_ITERATIONS tool-calling rounds
//   - Tool result content is capped at the tool layer (FILE_CHAR_CAP, etc.)
//   - One final non-tool LLM call streams the answer
// =============================================================================

import { llm, DEFAULT_MODEL } from '@/lib/llm';
import { recordLlmCall } from '@/lib/observability/track';
import { TOOLS, executeTool, type GithubContext } from './tools';
import type {
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
} from 'openai/resources/chat/completions';

const MAX_ITERATIONS = 5;

const SYSTEM_PROMPT = (fullName: string, branch: string) => `You are a helpful AI assistant connected to a GitHub repository: ${fullName} (branch: ${branch}).

You can call tools to read the repo's structure, list directories, read individual files, and search code. Before answering, gather enough context — typically 1–3 tool calls is plenty. Do NOT call the same tool twice with the same arguments.

When you cite code, reference the file path. When you write code suggestions, be specific about which file they go in. Be concise. If a question is not about the repo at all, answer from general knowledge without calling tools.`;

export interface AgentEvent {
  type: 'tool_call' | 'tool_result' | 'content' | 'done' | 'error';
  name?: string;
  args?: Record<string, unknown>;
  brief?: string;
  delta?: string;
  message?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    iterations: number;
  };
}

export async function* runGithubAgent(args: {
  userId: string;
  sessionId: string;
  ctx: GithubContext;
  history: { role: 'user' | 'assistant' | 'system'; content: string }[];
  question: string;
}): AsyncGenerator<AgentEvent> {
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT(args.ctx.fullName, args.ctx.branch) },
    ...args.history.map((m) => ({ role: m.role, content: m.content })) as ChatCompletionMessageParam[],
    { role: 'user', content: args.question },
  ];

  let totalPrompt = 0;
  let totalCompletion = 0;
  let iteration = 0;
  let finalContent = '';

  try {
    for (iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      const start = Date.now();
      const completion = await llm().chat.completions.create({
        model: DEFAULT_MODEL,
        messages,
        tools: TOOLS,
        tool_choice: 'auto',
        temperature: 0.2,
      });
      const usage = completion.usage;
      if (usage) {
        totalPrompt += usage.prompt_tokens ?? 0;
        totalCompletion += usage.completion_tokens ?? 0;
      }
      void recordLlmCall({
        userId: args.userId,
        sessionId: args.sessionId,
        kind: 'chat',
        model: DEFAULT_MODEL,
        promptTokens: usage?.prompt_tokens,
        completionTokens: usage?.completion_tokens,
        latencyMs: Date.now() - start,
        ragChunks: 0,
        status: 'ok',
      });

      const choice = completion.choices[0];
      const msg = choice?.message;
      if (!msg) {
        yield { type: 'error', message: 'Empty completion' };
        return;
      }

      const toolCalls = msg.tool_calls ?? [];
      if (toolCalls.length === 0) {
        // No tools wanted — this iteration's content is the final answer.
        // Re-stream it token-by-token for nicer UX.
        finalContent = msg.content ?? '';
        for (const ch of chunkForStreaming(finalContent)) {
          yield { type: 'content', delta: ch };
        }
        yield {
          type: 'done',
          usage: {
            promptTokens: totalPrompt,
            completionTokens: totalCompletion,
            iterations: iteration + 1,
          },
        };
        return;
      }

      // Push the assistant's tool-call message back into the conversation.
      messages.push({
        role: 'assistant',
        content: msg.content ?? '',
        tool_calls: toolCalls,
      });

      for (const call of toolCalls) {
        const parsed = safeParseArgs(call);
        yield {
          type: 'tool_call',
          name: call.function.name,
          args: parsed,
        };
        const { result, cached } = await executeTool(args.ctx, call.function.name, parsed);
        yield {
          type: 'tool_result',
          name: call.function.name,
          brief: makeBrief(call.function.name, parsed, result, cached),
        };
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: result.slice(0, 12_000), // last-resort cap on what gets fed back
        });
      }
    }

    // Iteration cap hit without a final answer — make one more call
    // forbidding tools so we get text back.
    const final = await llm().chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        ...messages,
        {
          role: 'system',
          content:
            'You have used the maximum number of tool calls. Answer now using only what you already know.',
        },
      ],
      temperature: 0.2,
    });
    const usage = final.usage;
    if (usage) {
      totalPrompt += usage.prompt_tokens ?? 0;
      totalCompletion += usage.completion_tokens ?? 0;
    }
    finalContent = final.choices[0]?.message?.content ?? '';
    for (const ch of chunkForStreaming(finalContent)) {
      yield { type: 'content', delta: ch };
    }
    yield {
      type: 'done',
      usage: {
        promptTokens: totalPrompt,
        completionTokens: totalCompletion,
        iterations: iteration + 1,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Agent error';
    yield { type: 'error', message };
  }
}

function safeParseArgs(call: ChatCompletionMessageToolCall): Record<string, unknown> {
  try {
    return JSON.parse(call.function.arguments) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function makeBrief(
  name: string,
  args: Record<string, unknown>,
  result: string,
  cached: boolean,
): string {
  const tag = cached ? ' (cached)' : '';
  if (name === 'github_read_file') {
    const path = String(args.path ?? '');
    const lineCount = result.split('\n').length;
    return `Read ${path} · ${lineCount} lines${tag}`;
  }
  if (name === 'github_list_directory') {
    return `Listed ${args.path || '(root)'}${tag}`;
  }
  if (name === 'github_search_code') {
    const matches = (result.match(/^\[\d+\]/gm) ?? []).length;
    return `Searched "${args.query}" · ${matches} match${matches === 1 ? '' : 'es'}${tag}`;
  }
  if (name === 'github_get_repo_info') {
    return `Read repo overview${tag}`;
  }
  return `${name}${tag}`;
}

/**
 * Re-stream the final content in word-sized chunks for nicer typing-effect UX
 * (since the LLM call already finished). Real token streaming on the final
 * answer is doable but adds complexity; this is good enough.
 */
function* chunkForStreaming(text: string): Generator<string> {
  let buf = '';
  for (const ch of text) {
    buf += ch;
    if (/\s/.test(ch) && buf.length >= 4) {
      yield buf;
      buf = '';
    }
  }
  if (buf) yield buf;
}
