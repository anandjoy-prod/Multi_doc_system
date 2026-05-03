import { AppShell } from '@/components/shared/AppShell';
import { SessionList } from '@/components/chat/SessionList';

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell
      heading="Chat"
      drawerTitle="Conversations"
      scrollable={false}
      desktopSidebar={
        <aside className="hidden h-full w-72 shrink-0 border-r border-border bg-bg-secondary lg:block">
          <SessionList />
        </aside>
      }
      mobileNav={<SessionList embedded />}
    >
      {children}
    </AppShell>
  );
}
