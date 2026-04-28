import { redirect } from 'next/navigation';
import { readSessionFromCookies } from '@/lib/auth';
import { hasPermission } from '@/lib/types';

export default async function Home() {
  const session = await readSessionFromCookies();
  if (!session) redirect('/login');
  if (hasPermission(session.perms, '*')) redirect('/admin');
  redirect('/chat');
}
