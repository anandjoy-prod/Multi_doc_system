import Link from 'next/link';
import { ArrowRight, FileText, Sheet, Database, Cloud, Github } from 'lucide-react';
import { IntegrationCard } from '@/components/admin/IntegrationCard';
import { serverAdmin } from '@/lib/supabase';
import { readSessionFromCookies } from '@/lib/auth';
import { getGithubIntegration } from '@/lib/github/integration';

export const dynamic = 'force-dynamic';

interface IntegrationDef {
  name: string;
  description: string;
  icon: React.ReactNode;
  initialStatus?: 'available' | 'connected';
}

const STATIC_INTEGRATIONS: IntegrationDef[] = [
  {
    name: 'Google Docs',
    description:
      'Read documents to ground assistant answers in your team\'s knowledge.',
    icon: <FileText className="h-5 w-5" />,
  },
  {
    name: 'Google Sheets',
    description: 'Pull tabular data into chat with read-only access.',
    icon: <Sheet className="h-5 w-5" />,
  },
  {
    name: 'Confluence',
    description: 'Index space pages for retrieval-augmented chat.',
    icon: <Cloud className="h-5 w-5" />,
  },
  {
    name: 'PostgreSQL',
    description: 'Query a read replica through a constrained agent.',
    icon: <Database className="h-5 w-5" />,
  },
];

/**
 * The PDF tile is a real working integration — it links to /admin/integrations/pdf
 * for management. The other tiles are placeholders that simulate connection.
 */
export default async function AdminIntegrationsPage() {
  const session = await readSessionFromCookies();
  let pdfCount = 0;
  let githubStatus: { login: string; active_repo: string | null } | null = null;
  if (session) {
    const sb = serverAdmin();
    const { count } = await sb
      .from('rag_documents')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', session.sub)
      .eq('status', 'ready');
    pdfCount = count ?? 0;

    const integ = await getGithubIntegration(session.sub);
    if (integ) {
      githubStatus = {
        login: integ.login,
        active_repo: integ.active_repo ?? null,
      };
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          Integrations
        </h2>
        <p className="text-sm text-fg-secondary">
          Connect external sources to ground the assistant.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Documents — real working integration */}
        <Link
          href="/admin/integrations/pdf"
          className="group flex items-start gap-4 rounded-2xl border border-accent/30 bg-bg-secondary p-5 transition hover:border-accent/60"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <FileText className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-base font-semibold">
                Documents
              </h3>
              <span className="rounded-full border border-accent/40 px-2 py-0.5 text-[11px] capitalize text-accent">
                {pdfCount > 0 ? `${pdfCount} indexed` : 'available'}
              </span>
            </div>
            <p className="mt-1 text-sm text-fg-secondary">
              Upload PDFs or Excel files, or paste a URL. Hybrid semantic +
              keyword search with cited sources, deep-linked back to the
              original page.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent group-hover:underline">
              Manage <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </Link>

        {/* GitHub — real working integration (MCP-style tool calling) */}
        <Link
          href="/admin/integrations/github"
          className="group flex items-start gap-4 rounded-2xl border border-accent/30 bg-bg-secondary p-5 transition hover:border-accent/60"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <Github className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-display text-base font-semibold">GitHub</h3>
              <span className="rounded-full border border-accent/40 px-2 py-0.5 text-[11px] text-accent">
                {githubStatus
                  ? githubStatus.active_repo
                    ? githubStatus.active_repo
                    : `connected as ${githubStatus.login}`
                  : 'available'}
              </span>
            </div>
            <p className="mt-1 text-sm text-fg-secondary">
              Connect a repo and chat against its code. The agent reads files
              on demand via tool calls — MCP-shape, no pre-indexing, always
              fresh.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent group-hover:underline">
              Manage <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </Link>

        {/* Placeholder integrations */}
        {STATIC_INTEGRATIONS.map((i) => (
          <IntegrationCard
            key={i.name}
            name={i.name}
            description={i.description}
            icon={i.icon}
            initialStatus={i.initialStatus}
          />
        ))}
      </div>
    </div>
  );
}
