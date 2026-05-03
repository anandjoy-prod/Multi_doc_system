'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/shared/Button';
import { RoleBadge } from '@/components/shared/RoleBadge';
import {
  UserFormDialog,
  type EditableUser,
  type RoleOption,
} from './UserFormDialog';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import { UserActions } from './UserActions';

interface Row {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'viewer' | string;
  theme_preference: string;
  created_at: string;
  last_login: string | null;
}

function fmt(d: string | null) {
  if (!d) return 'never';
  return new Date(d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

type DialogState =
  | { kind: 'create' }
  | { kind: 'edit'; user: EditableUser }
  | { kind: 'delete'; id: string; email: string }
  | null;

export function UserTable({
  users,
  roles,
}: {
  users: Row[];
  roles: RoleOption[];
}) {
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState<DialogState>(null);

  const filtered = users.filter((u) =>
    `${u.name} ${u.email} ${u.role}`.toLowerCase().includes(query.toLowerCase()),
  );

  function close() {
    setDialog(null);
  }

  return (
    <>
      <div className="rounded-2xl border border-border bg-bg-secondary">
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, or role…"
            className="h-9 flex-1 rounded-lg border border-border bg-bg-primary px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
          <Button onClick={() => setDialog({ kind: 'create' })} size="md">
            <Plus className="h-4 w-4" /> Invite user
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-fg-secondary">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Theme</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Last login</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((u) => (
                <tr key={u.id} className="transition hover:bg-bg-tertiary">
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-fg-secondary">
                    {u.email}
                  </td>
                  <td className="px-4 py-3">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="px-4 py-3 capitalize text-fg-secondary">
                    {u.theme_preference}
                  </td>
                  <td className="px-4 py-3 text-fg-secondary">
                    {fmt(u.created_at)}
                  </td>
                  <td className="px-4 py-3 text-fg-secondary">
                    {fmt(u.last_login)}
                  </td>
                  <td className="px-2 py-3">
                    <UserActions
                      onEdit={() =>
                        setDialog({
                          kind: 'edit',
                          user: {
                            id: u.id,
                            email: u.email,
                            role: u.role,
                            theme_preference: u.theme_preference,
                          },
                        })
                      }
                      onDelete={() =>
                        setDialog({
                          kind: 'delete',
                          id: u.id,
                          email: u.email,
                        })
                      }
                    />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-sm text-fg-secondary"
                  >
                    {users.length === 0
                      ? 'No users yet — click Invite user to add one.'
                      : `No users match "${query}".`}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <UserFormDialog
        open={dialog?.kind === 'create' || dialog?.kind === 'edit'}
        onClose={close}
        mode={dialog?.kind === 'edit' ? 'edit' : 'create'}
        roles={roles}
        user={dialog?.kind === 'edit' ? dialog.user : undefined}
      />

      <DeleteConfirmDialog
        open={dialog?.kind === 'delete'}
        onClose={close}
        userId={dialog?.kind === 'delete' ? dialog.id : null}
        userEmail={dialog?.kind === 'delete' ? dialog.email : null}
      />
    </>
  );
}
