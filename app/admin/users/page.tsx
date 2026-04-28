import { UserTable } from '@/components/admin/UserTable';
import { USERS, findRoleById } from '@/lib/dummy-data';

export default function AdminUsersPage() {
  const rows = USERS.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: findRoleById(u.role_id)?.name ?? 'user',
    theme_preference: u.theme_preference,
    created_at: u.created_at,
    last_login: u.last_login,
  }));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-end justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            Users
          </h2>
          <p className="text-sm text-fg-secondary">
            {rows.length} accounts · UI-only demo
          </p>
        </div>
      </header>
      <UserTable users={rows} />
    </div>
  );
}
