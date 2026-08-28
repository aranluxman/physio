'use client';

import { useState, type FormEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { errorMessage } from '@/lib/errors';

type Mode = 'signin' | 'signup' | 'magic';

export function LoginForm() {
  const { signInWithPassword, signUp, signInWithMagicLink } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === 'signin') {
        await signInWithPassword(email.trim(), password);
      } else if (mode === 'signup') {
        const { needsConfirmation } = await signUp(email.trim(), password);
        setNotice(
          needsConfirmation
            ? 'Account created. Check your email for the confirmation link, then sign in.'
            : 'Account created — loading your regimen.',
        );
      } else {
        await signInWithMagicLink(email.trim());
        setNotice('Magic link sent. Open it on this device to sign in.');
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-6 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-lg font-bold text-accent-fg">
          PT
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink">Physio Tracker</h1>
        <p className="mt-1 text-sm text-muted">
          Your hip rehab checklist, schedule and pain log.
        </p>
      </div>

      <form onSubmit={submit} className="card space-y-4 p-5">
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-panel p-1">
          {(
            [
              ['signin', 'Sign in'],
              ['signup', 'Sign up'],
              ['magic', 'Magic link'],
            ] as [Mode, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setMode(value);
                setError(null);
                setNotice(null);
              }}
              className={`focus-ring rounded-lg px-2 py-2 text-sm font-medium transition ${
                mode === value ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div>
          <label htmlFor="email" className="text-sm font-medium text-ink">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input mt-1"
            placeholder="you@example.com"
          />
        </div>

        {mode !== 'magic' && (
          <div>
            <label htmlFor="password" className="text-sm font-medium text-ink">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input mt-1"
              placeholder="At least 6 characters"
            />
          </div>
        )}

        {error && (
          <p className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger-soft-fg" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="rounded-xl bg-ok-soft px-3.5 py-2.5 text-sm text-ok-soft-fg">{notice}</p>
        )}

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy
            ? 'Working…'
            : mode === 'signin'
              ? 'Sign in'
              : mode === 'signup'
                ? 'Create account'
                : 'Send magic link'}
        </button>
      </form>

      <p className="mt-4 text-center text-xs text-faint">
        Private to you — every row is protected by Supabase row level security.
      </p>
    </div>
  );
}
