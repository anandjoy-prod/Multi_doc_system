import { ROLES } from '@/lib/dummy-data';
import { ShieldCheck, User as UserIcon, Eye } from 'lucide-react';

const Icon = ({ name }: { name: string }) => {
  if (name === 'admin') return <ShieldCheck className="h-5 w-5" />;
  if (name === 'viewer') return <Eye className="h-5 w-5" />;
  return <UserIcon className="h-5 w-5" />;
};

export default function AdminRolesPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          Roles
        </h2>
        <p className="text-sm text-fg-secondary">
          {ROLES.length} roles · permissions are dummy values for the demo
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {ROLES.map((r) => (
          <div
            key={r.id}
            className="rounded-2xl border border-border bg-bg-secondary p-5"
          >
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg-tertiary text-accent">
                <Icon name={r.name} />
              </div>
              <div>
                <div className="font-display text-base font-semibold capitalize">
                  {r.name}
                </div>
                <div className="text-xs text-fg-secondary">
                  {r.theme_override
                    ? `Forces ${r.theme_override} theme`
                    : 'User picks their theme'}
                </div>
              </div>
            </div>
            <p className="mb-4 text-sm text-fg-secondary">{r.description}</p>
            <div className="text-xs uppercase tracking-wider text-fg-secondary">
              Permissions
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {r.permissions.map((p) => (
                <span
                  key={p}
                  className="rounded-full border border-border bg-bg-primary px-2 py-0.5 font-mono text-[11px] text-fg-primary"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
