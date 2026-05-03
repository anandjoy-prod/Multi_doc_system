import { AppShell } from '@/components/shared/AppShell';
import { AdminSidebar, ADMIN_NAV_ITEMS } from '@/components/admin/AdminSidebar';
import { SidebarBody } from '@/components/shared/Sidebar';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell
      heading="Admin"
      drawerTitle="Admin menu"
      desktopSidebar={<AdminSidebar />}
      mobileNav={<SidebarBody items={ADMIN_NAV_ITEMS} />}
    >
      {children}
    </AppShell>
  );
}
