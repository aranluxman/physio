'use client';

import type { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { isSupabaseConfigured } from '@/lib/supabase';
import { LoginForm } from './LoginForm';
import { NavBar } from './NavBar';

/**
 * Wraps every page: blocks on the Supabase env check, then on auth, then
 * renders the page inside the app chrome.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (!isSupabaseConfigured) return <ConfigNotice />;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600"
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
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-5 sm:pb-10">{children}</main>
    </div>
  );
}

function ConfigNotice() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5">
      <div className="card p-6">
        <h1 className="text-lg font-bold text-slate-900">Supabase is not configured</h1>
        <p className="mt-2 text-sm text-slate-600">
          This build was created without the Supabase environment variables, so it cannot
          reach your database. Set both of these and rebuild:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-900 p-3 text-xs text-slate-100">
          {`NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>`}
        </pre>
        <p className="mt-3 text-sm text-slate-600">
          Locally they go in <code className="rounded bg-slate-100 px-1">.env.local</code>. For
          the deployed site they go in GitHub → Settings → Secrets and variables → Actions,
          because they are baked in at build time.
        </p>
      </div>
    </div>
  );
}
