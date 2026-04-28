'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { RoleBadge } from './RoleBadge';

interface Me {
  id: string;
  email: string;
  name: string;
  role: string;
}

export function UserMenu() {
  const [me, setMe] = useState<Me | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => setMe(d.user));
  }, []);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  if (!me) {
    return <div className="h-9 w-32 animate-pulse rounded-full bg-bg-tertiary" />;
  }

  return (
    <div className="flex items-center gap-3">
      <div className="hidden flex-col items-end leading-tight sm:flex">
        <span className="text-sm font-medium text-fg-primary">{me.name}</span>
        <RoleBadge role={me.role} variant="inline" />
      </div>
      <button
        onClick={logout}
        className="flex h-9 items-center gap-2 rounded-full border border-border bg-bg-secondary px-3 text-sm text-fg-secondary transition hover:text-fg-primary"
        aria-label="Log out"
      >
        <LogOut className="h-4 w-4" /> Logout
      </button>
    </div>
  );
}
