import { TopBar } from '@/components/shared/TopBar';
import { AdminSidebar } from '@/components/admin/AdminSidebar';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-full">
      <AdminSidebar />
      <div className="flex h-full flex-1 flex-col">
        <TopBar heading="Admin" />
        <main className="flex-1 overflow-y-auto bg-bg-primary px-6 py-6">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
