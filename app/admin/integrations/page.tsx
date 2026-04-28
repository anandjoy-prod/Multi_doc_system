import { FileText, Sheet, Database, Cloud } from 'lucide-react';
import { IntegrationCard } from '@/components/admin/IntegrationCard';

/**
 * Server component. We render an array of <IntegrationCard> client islands —
 * the page itself ships zero JS for layout, only the cards hydrate. When
 * we have a real DB, this is where we'd query the user's connected
 * providers and pass `initialStatus="connected"` to those cards.
 */

interface IntegrationDef {
  name: string;
  description: string;
  icon: React.ReactNode;
  // Demo-only: pre-mark one as connected so the UI shows both states.
  initialStatus?: 'available' | 'connected';
}

const INTEGRATIONS: IntegrationDef[] = [
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
    initialStatus: 'connected',
  },
  {
    name: 'PostgreSQL',
    description: 'Query a read replica through a constrained agent.',
    icon: <Database className="h-5 w-5" />,
  },
];

export default function AdminIntegrationsPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          Integrations
        </h2>
        <p className="text-sm text-fg-secondary">
          Connect external sources to ground the assistant. UI-only — clicking
          Connect simulates a successful OAuth round-trip.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {INTEGRATIONS.map((i) => (
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
