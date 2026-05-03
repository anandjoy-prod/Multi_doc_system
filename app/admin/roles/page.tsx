import { ShieldCheck, User as UserIcon, Eye } from 'lucide-react';
import { serverAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface RoleRow {
  id: string;
  name: string;
  permissions: string[];
  theme_override: string | null;
}

const Icon = ({ name }: { name: string }) => {
  if (name === 'admin') return <ShieldCheck className="h-5 w-5" />;
  if (name === 'viewer') return <Eye className="h-5 w-5" />;
  return <UserIcon className="h-5 w-5" />;
};

const DESCRIPTIONS: Record<string, string> = {
  admin: 'Full access — manage users, roles, integrations.',
  user: 'Standard chat user with full conversation access.',
  viewer: 'Read-only — can view chats but not send messages.',
};

export default async function AdminRolesPage() {
  const sb = serverAdmin();
  const { data, error } = await sb
    .from('roles')
    .select('id, name, permissions, theme_override')
    .order('name')
    .returns<RoleRow[]>();

  const roles = data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          Roles
        </h2>
        <p className="text-sm text-fg-secondary">
          {roles.length} {roles.length === 1 ? 'role' : 'roles'} from your Supabase project
        </p>
      </header>

      {error ? (
        <div className="rounded-lg border border-accent-error/40 bg-accent-error/10 px-4 py-3 text-sm text-accent-error">
          {error.message}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {roles.map((r) => (
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
            <p className="mb-4 text-sm text-fg-secondary">
              {DESCRIPTIONS[r.name] ?? '—'}
            </p>
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
