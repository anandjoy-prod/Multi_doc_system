import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/shared/ThemeProvider';

export const metadata: Metadata = {
  title: 'AI Chat CMS',
  description: 'Smart, simple chat interface with admin control panel.',
};

// Tiny inline script to set the dark class before React hydrates, so the
// page does not flash light-on-dark for users who have stored a 'dark'
// preference. Keep this small and side-effect-only.
const noFlashScript = `(()=>{
  try {
    var s = localStorage.getItem('theme-preference');
    var sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = s === 'dark' || ((s === 'system' || !s) && sysDark);
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashScript }} />
      </head>
      <body className="min-h-screen bg-bg-primary text-fg-primary antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
