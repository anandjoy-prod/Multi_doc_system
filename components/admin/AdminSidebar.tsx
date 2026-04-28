'use client';

import {
  LayoutDashboard,
  Users,
  Shield,
  Plug,
  BarChart3,
  MessageSquare,
} from 'lucide-react';
import { Sidebar, type SidebarItem } from '@/components/shared/Sidebar';

const items: SidebarItem[] = [
  { href: '/admin', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', Icon: Users },
  { href: '/admin/roles', label: 'Roles', Icon: Shield },
  { href: '/admin/integrations', label: 'Integrations', Icon: Plug },
  { href: '/admin/analytics', label: 'Analytics', Icon: BarChart3 },
  { href: '/chat', label: 'Open chat', Icon: MessageSquare },
];

export function AdminSidebar() {
  return <Sidebar title="AI Chat CMS" items={items} />;
}
