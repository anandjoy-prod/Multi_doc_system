import { FileText, FolderTree, Search, Info } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface ToolEvent {
  name: string;
  brief: string;
}

const ICON_FOR: Record<string, React.ComponentType<{ className?: string }>> = {
  github_read_file: FileText,
  github_list_directory: FolderTree,
  github_search_code: Search,
  github_get_repo_info: Info,
};

/**
 * Renders the agent's tool calls as a compact bulleted list under the
 * assistant message. Lets the user audit what the agent looked at.
 */
export function ToolTrace({ events }: { events: ToolEvent[] }) {
  if (!events || events.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-col gap-0.5 rounded-lg border border-border bg-bg-tertiary/50 px-3 py-2">
      {events.map((e, i) => {
        const Icon = ICON_FOR[e.name] ?? Info;
        return (
          <li
            key={i}
            className={cn(
              'flex items-center gap-2 text-[11px] text-fg-secondary',
            )}
          >
            <Icon className="h-3 w-3 shrink-0" />
            <span>{e.brief}</span>
          </li>
        );
      })}
    </ul>
  );
}
