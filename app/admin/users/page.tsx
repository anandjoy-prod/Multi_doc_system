import { UserTable } from '@/components/admin/UserTable';
import { serverAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

interface UserRow {
  id: string;
  email: string;
  theme_preference: string;
  created_at: string;
  last_login: string | null;
  roles: { name: string } | null;
}

interface RoleRow {
  id: string;
  name: string;
}

function emailToName(email: string): string {
  const local = email.split('@')[0] ?? email;
  return local.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function AdminUsersPage() {
  const sb = serverAdmin();
  const [usersRes, rolesRes] = await Promise.all([
    sb
      .from('users')
      .select(
        'id, email, theme_preference, created_at, last_login, roles ( name )',
      )
      .order('created_at', { ascending: false })
      .returns<UserRow[]>(),
    sb.from('roles').select('id, name').order('name').returns<RoleRow[]>(),
  ]);

  const rows = (usersRes.data ?? []).map((u) => ({
    id: u.id,
    name: emailToName(u.email),
    email: u.email,
    role: u.roles?.name ?? 'user',
    theme_preference: u.theme_preference,
    created_at: u.created_at,
    last_login: u.last_login,
  }));

  const roles = rolesRes.data ?? [];
  const error = usersRes.error ?? rolesRes.error;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="font-display text-2xl font-semibold tracking-tight">
          Users
        </h2>
        <p className="text-sm text-fg-secondary">
          {rows.length} {rows.length === 1 ? 'account' : 'accounts'}
          {error ? ' · failed to load' : ''}
        </p>
      </header>

      {error ? (
        <div className="rounded-lg border border-accent-error/40 bg-accent-error/10 px-4 py-3 text-sm text-accent-error">
          {error.message}
        </div>
      ) : null}

      <UserTable users={rows} roles={roles} />
    </div>
  );
}
