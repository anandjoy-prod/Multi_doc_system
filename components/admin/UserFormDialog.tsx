'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/shared/Button';
import { Field, Select } from '@/components/shared/Field';

export interface RoleOption {
  id: string;
  name: string;
}

export interface EditableUser {
  id: string;
  email: string;
  role: string;
  theme_preference: string;
}

type Mode = 'create' | 'edit';

interface Props {
  open: boolean;
  onClose: () => void;
  mode: Mode;
  roles: RoleOption[];
  /** Pre-fill values when editing. */
  user?: EditableUser;
}

export function UserFormDialog({ open, onClose, mode, roles, user }: Props) {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Reset form whenever the dialog opens for a new target.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setLoading(false);
    if (mode === 'edit' && user) {
      setEmail(user.email);
      setPassword('');
      const matchedRole = roles.find((r) => r.name === user.role);
      setRoleId(matchedRole?.id ?? roles[0]?.id ?? '');
      setTheme((user.theme_preference as 'light' | 'dark' | 'system') ?? 'system');
    } else {
      setEmail('');
      setPassword('');
      const userRole = roles.find((r) => r.name === 'user') ?? roles[0];
      setRoleId(userRole?.id ?? '');
      setTheme('system');
    }
  }, [open, mode, user, roles]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const url =
        mode === 'create'
          ? '/api/admin/users'
          : `/api/admin/users/${user?.id}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';

      const body: Record<string, unknown> = {
        roleId,
        themePreference: theme,
      };
      // Email change: only send when it differs (avoids accidental
      // unique-violation when editing other fields).
      if (mode === 'create' || email !== user?.email) body.email = email;
      // Password: required on create, optional on edit.
      if (mode === 'create') body.password = password;
      else if (password.trim().length > 0) body.password = password;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? 'Request failed');
        setLoading(false);
        return;
      }

      onClose();
      router.refresh();
    } catch {
      setError('Network error');
      setLoading(false);
    }
  }

  const title = mode === 'create' ? 'Add user' : `Edit ${user?.email ?? 'user'}`;
  const description =
    mode === 'create'
      ? 'A welcome flow is not wired up — share the credentials manually for now.'
      : 'Leave password blank to keep the current one.';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button form="user-form" type="submit" disabled={loading}>
            {loading
              ? 'Saving…'
              : mode === 'create'
                ? 'Create user'
                : 'Save changes'}
          </Button>
        </>
      }
    >
      <form id="user-form" onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          label="Password"
          type="password"
          autoComplete={mode === 'create' ? 'new-password' : 'off'}
          required={mode === 'create'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint={
            mode === 'edit'
              ? 'Leave blank to keep the current password.'
              : 'Minimum 8 characters.'
          }
        />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Role"
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            options={roles.map((r) => ({
              value: r.id,
              label: r.name,
            }))}
          />
          <Select
            label="Theme"
            value={theme}
            onChange={(e) =>
              setTheme(e.target.value as 'light' | 'dark' | 'system')
            }
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </div>

        {error ? (
          <div className="rounded-lg border border-accent-error/40 bg-accent-error/10 px-3 py-2 text-xs text-accent-error">
            {error}
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
