'use client';

import { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { RoleBadge } from '@/components/shared/RoleBadge';

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

export function UserTable({ users }: { users: Row[] }) {
  const [query, setQuery] = useState('');
  const filtered = users.filter((u) =>
    `${u.name} ${u.email} ${u.role}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="rounded-2xl border border-border bg-bg-secondary">
      <div className="flex items-center justify-between gap-3 border-b border-border p-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, email, or role…"
          className="h-9 flex-1 rounded-lg border border-border bg-bg-primary px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
        <button
          className="h-9 rounded-lg bg-accent px-4 text-sm font-medium text-white transition hover:opacity-90"
          onClick={() => alert('UI-only demo — wire this to your API.')}
        >
          Invite user
        </button>
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
                  <button
                    className="text-fg-secondary transition hover:text-fg-primary"
                    aria-label="More actions"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-12 text-center text-sm text-fg-secondary"
                >
                  No users match “{query}”.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
