'use client';

import type { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { isSupabaseConfigured } from '@/lib/supabase';
import { LoginForm } from './LoginForm';
import { NavBar } from './NavBar';

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (!isSupabaseConfigured) return <ConfigNotice />;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-accent"
          role="status"
          aria-label="Loading"
        />
      </div>
    );
  }

  if (!user) return <LoginForm />;

  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="mx-auto max-w-4xl px-4 pb-28 pt-6 sm:pb-12">{children}</main>
    </div>
  );
}

function ConfigNotice() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5">
      <div className="card p-6">
        <h1 className="text-lg font-bold text-ink">Supabase is not configured</h1>
        <p className="mt-2 text-sm text-muted">
          This build was created without the Supabase environment variables, so it cannot
          reach your database. Set both of these and rebuild:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-ink p-3 text-xs text-canvas">
          {`NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...`}
        </pre>
        <p className="mt-3 text-sm text-muted">
          Locally they go in <code className="rounded bg-panel px-1">.env.local</code>. For
          the deployed site they go in GitHub → Settings → Secrets and variables → Actions,
          because they are baked in at build time.
        </p>
      </div>
    </div>
  );
}
