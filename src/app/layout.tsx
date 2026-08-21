import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/hooks/useAuth';
import { AppShell } from '@/components/AppShell';

export const metadata: Metadata = {
  title: 'Physio Tracker',
  description: 'Daily hip rehab checklist, schedule and pain log.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Physio', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#246865',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
