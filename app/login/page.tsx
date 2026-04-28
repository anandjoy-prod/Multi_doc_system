import { Suspense } from 'react';
import { LoginForm } from './LoginForm';
import { Sparkles } from 'lucide-react';

export const metadata = { title: 'Sign in · AI Chat CMS' };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-primary px-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="font-display text-lg font-semibold tracking-tight">
              AI Chat CMS
            </div>
            <div className="text-xs text-fg-secondary">
              Sign in to continue
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-bg-secondary p-6 shadow-sm">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>

        <DummyCredsCard />

        <p className="mt-6 text-center text-xs text-fg-secondary">
          UI-only demo · no real database
        </p>
      </div>
    </main>
  );
}

function DummyCredsCard() {
  const creds = [
    { role: 'Admin', email: 'admin@test.com', password: 'admin123' },
    { role: 'User', email: 'user@test.com', password: 'user123' },
    { role: 'Viewer', email: 'viewer@test.com', password: 'viewer123' },
  ];
  return (
    <div className="mt-6 rounded-xl border border-border bg-bg-tertiary p-4">
      <div className="mb-2 text-xs font-medium uppercase tracking-wider text-fg-secondary">
        Dummy credentials
      </div>
      <div className="grid grid-cols-3 gap-3 text-xs">
        {creds.map((c) => (
          <div key={c.email} className="rounded-lg border border-border bg-bg-secondary p-2">
            <div className="font-medium text-fg-primary">{c.role}</div>
            <div className="truncate font-mono text-[11px] text-fg-secondary">{c.email}</div>
            <div className="font-mono text-[11px] text-fg-secondary">{c.password}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
