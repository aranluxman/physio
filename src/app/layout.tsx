import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/hooks/useAuth';
import { ThemeProvider } from '@/hooks/useTheme';
import { AppShell } from '@/components/AppShell';

export const metadata: Metadata = {
  title: 'Physio Tracker',
  description: 'Daily hip rehab checklist, schedule and pain log.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Physio', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f7f7' },
    { media: '(prefers-color-scheme: dark)', color: '#0a1211' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

/**
 * Runs before the first paint, so a dark-mode user never gets a white flash.
 * Kept tiny and dependency-free on purpose — it duplicates a few lines of
 * useTheme rather than waiting for React to hydrate.
 */
const themeBootScript = `
(function () {
  try {
    var saved = localStorage.getItem('physio-theme');
    var dark = saved === 'dark' ||
      ((!saved || saved === 'system') &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <AppShell>{children}</AppShell>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
