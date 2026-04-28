import { TopBar } from '@/components/shared/TopBar';
import { SessionList } from '@/components/chat/SessionList';

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-full">
      <aside className="hidden h-full w-72 shrink-0 border-r border-border bg-bg-secondary lg:block">
        <SessionList />
      </aside>
      <div className="flex h-full flex-1 flex-col">
        <TopBar heading="Chat" />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
