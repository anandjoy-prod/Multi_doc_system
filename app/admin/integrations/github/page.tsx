import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { GithubManager } from '@/components/admin/integrations/GithubManager';

export const dynamic = 'force-dynamic';

export default function GithubIntegrationPage() {
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
          GitHub
        </h2>
        <p className="text-sm text-fg-secondary">
          Connect a repo and chat against its code. The agent reads files on
          demand via tool calls — no pre-indexing, always fresh.
        </p>
      </div>

      <GithubManager />

      <details className="rounded-xl border border-border bg-bg-secondary p-4 text-sm text-fg-secondary">
        <summary className="cursor-pointer font-medium text-fg-primary">
          How GitHub mode works
        </summary>
        <ol className="mt-3 list-decimal space-y-1 pl-5 leading-relaxed">
          <li>
            <span className="font-medium text-fg-primary">Tools, not RAG</span>{' '}
            — the assistant has four read-only tools:{' '}
            <code className="font-mono text-xs">get_repo_info</code>,{' '}
            <code className="font-mono text-xs">list_directory</code>,{' '}
            <code className="font-mono text-xs">read_file</code>,{' '}
            <code className="font-mono text-xs">search_code</code>.
          </li>
          <li>
            <span className="font-medium text-fg-primary">Agent loop</span> — for
            each question, the LLM picks which tools to call (up to 5 rounds),
            sees the results, and generates an answer.
          </li>
          <li>
            <span className="font-medium text-fg-primary">Tool calls show in chat</span>{' '}
            — you'll see "Reading lib/auth.ts…" and similar lines as the agent
            works, so you can trace its reasoning.
          </li>
          <li>
            <span className="font-medium text-fg-primary">Schema-compatible with MCP</span>{' '}
            — tool definitions match the Model Context Protocol spec. Swapping
            to a real MCP server later is one file.
          </li>
        </ol>
        <p className="mt-3 text-xs">
          Token cost note: tool-calling chats use ~5–10× more tokens than
          regular RAG because the conversation grows with each tool result.
          Track it on the Observability dashboard.
        </p>
      </details>
    </div>
  );
}
