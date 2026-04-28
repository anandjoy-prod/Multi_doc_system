import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';

export function TopBar({ heading }: { heading: string }) {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-bg-primary/80 px-6 backdrop-blur">
      <h1 className="font-display text-lg font-semibold tracking-tight">
        {heading}
      </h1>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
