'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePhysio } from '@/hooks/usePhysio';
import { profileStats } from '@/lib/stats';
import { displayName } from '@/lib/user';
import { errorMessage } from '@/lib/errors';
import { Avatar } from '@/components/Avatar';
import { StatTile } from '@/components/StatTile';
import { ThemeSegmented } from '@/components/ThemeToggle';
import { PushCard } from '@/components/PushCard';
import { FlameIcon, CheckIcon, CalendarIcon, ChartIcon, LogOutIcon } from '@/components/icons';

type Feedback = { kind: 'ok' | 'error'; text: string } | null;

export default function ProfilePage() {
  const { user, signOut, updateProfile, updatePassword } = useAuth();
  const { exercises, logs, today, loading } = usePhysio();

  const name = displayName(user);
  const stats = useMemo(
    () => profileStats(exercises, logs, today),
    [exercises, logs, today],
  );

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, {
        month: 'short',
        year: 'numeric',
      })
    : '—';

  return (
    <div className="space-y-6">
      <header className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        <Avatar name={name} seed={user?.id} size="lg" />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-ink">{name}</h1>
          <p className="truncate text-sm text-muted">{user?.email}</p>
          <p className="mt-1 text-xs text-faint">Member since {memberSince}</p>
        </div>
      </header>

      <section aria-labelledby="stats-heading">
        <h2
          id="stats-heading"
          className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-faint"
        >
          Your progress
        </h2>
        {loading ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[104px] animate-pulse rounded-2xl bg-panel" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              tone="accent"
              label="Current streak"
              value={`${stats.currentStreak} ${stats.currentStreak === 1 ? 'day' : 'days'}`}
              hint="Rest days don't break it"
              icon={<FlameIcon className="h-3.5 w-3.5" />}
            />
            <StatTile
              label="Longest streak"
              value={`${stats.longestStreak} ${stats.longestStreak === 1 ? 'day' : 'days'}`}
              hint="Your personal best"
              icon={<ChartIcon className="h-3.5 w-3.5" />}
            />
            <StatTile
              label="Sessions logged"
              value={stats.totalSessions}
              hint={`Across ${stats.activeDays} ${stats.activeDays === 1 ? 'day' : 'days'}`}
              icon={<CheckIcon className="h-3.5 w-3.5" />}
            />
            <StatTile
              label="Average pain"
              value={stats.averagePain === null ? '—' : `${stats.averagePain}/10`}
              hint={stats.averagePain === null ? 'None recorded yet' : 'Where recorded'}
              icon={<CalendarIcon className="h-3.5 w-3.5" />}
            />
          </div>
        )}
      </section>

      <PushCard />

      <DisplayNameCard
        current={(user?.user_metadata?.display_name as string) ?? ''}
        fallback={name}
        onSave={updateProfile}
      />

      <PasswordCard onSave={updatePassword} />

      <EmailPreferencesCard
        current={(user?.user_metadata?.email_prefs as EmailPrefs) ?? undefined}
        onSave={updateProfile}
      />

      <section className="card p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-faint">Appearance</h2>
        <p className="mt-1.5 text-sm text-muted">
          Choose a theme, or follow your device setting.
        </p>
        <ThemeSegmented className="mt-3 max-w-xs" />
      </section>

      <section className="card p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-faint">Account</h2>
        <button
          type="button"
          onClick={() => void signOut()}
          className="btn-secondary mt-3 text-danger hover:border-danger/40 hover:bg-danger-soft"
        >
          <LogOutIcon className="h-4 w-4" />
          Sign out
        </button>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ cards */

function FeedbackLine({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null;
  return (
    <p
      role={feedback.kind === 'error' ? 'alert' : 'status'}
      className={`mt-3 rounded-xl px-3.5 py-2.5 text-sm ${
        feedback.kind === 'error'
          ? 'bg-danger-soft text-danger-soft-fg'
          : 'bg-ok-soft text-ok-soft-fg'
      }`}
    >
      {feedback.text}
    </p>
  );
}

function DisplayNameCard({
  current,
  fallback,
  onSave,
}: {
  current: string;
  fallback: string;
  onSave: (patch: Record<string, unknown>) => Promise<void>;
}) {
  const [value, setValue] = useState(current);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => setValue(current), [current]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      await onSave({ display_name: value.trim() || null });
      setFeedback({ kind: 'ok', text: 'Display name saved.' });
    } catch (err) {
      setFeedback({ kind: 'error', text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-faint">
        Display name
      </h2>
      <p className="mt-1.5 text-sm text-muted">
        Shown in the header and on this page. Leave it blank to fall back to{' '}
        <span className="font-medium text-ink">{fallback}</span>.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="display-name" className="sr-only">
          Display name
        </label>
        <input
          id="display-name"
          className="input sm:flex-1"
          value={value}
          maxLength={60}
          placeholder={fallback}
          onChange={(e) => setValue(e.target.value)}
        />
        <button type="submit" className="btn-primary shrink-0" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
      <FeedbackLine feedback={feedback} />
    </form>
  );
}

function PasswordCard({ onSave }: { onSave: (password: string) => Promise<void> }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password !== confirm) {
      setFeedback({ kind: 'error', text: 'Those two passwords do not match.' });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      await onSave(password);
      setPassword('');
      setConfirm('');
      setFeedback({ kind: 'ok', text: 'Password changed.' });
    } catch (err) {
      setFeedback({ kind: 'error', text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-faint">
        Change password
      </h2>
      <p className="mt-1.5 text-sm text-muted">
        At least 6 characters. You stay signed in on this device.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div>
          <label htmlFor="new-password" className="sr-only">
            New password
          </label>
          <input
            id="new-password"
            type="password"
            className="input"
            autoComplete="new-password"
            minLength={6}
            required
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="confirm-password" className="sr-only">
            Confirm new password
          </label>
          <input
            id="confirm-password"
            type="password"
            className="input"
            autoComplete="new-password"
            minLength={6}
            required
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
      </div>
      <button type="submit" className="btn-primary mt-3" disabled={busy || !password}>
        {busy ? 'Saving…' : 'Update password'}
      </button>
      <FeedbackLine feedback={feedback} />
    </form>
  );
}

interface EmailPrefs {
  appointment_reminders?: boolean;
  weekly_summary?: boolean;
}

const PREFS: { key: keyof EmailPrefs; label: string; hint: string }[] = [
  {
    key: 'appointment_reminders',
    label: 'Appointment reminders',
    hint: 'A nudge the day before a physio appointment.',
  },
  {
    key: 'weekly_summary',
    label: 'Weekly summary',
    hint: 'Sessions completed and pain trend for the week.',
  },
];

function EmailPreferencesCard({
  current,
  onSave,
}: {
  current?: EmailPrefs;
  onSave: (patch: Record<string, unknown>) => Promise<void>;
}) {
  const [prefs, setPrefs] = useState<EmailPrefs>(current ?? {});
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => setPrefs(current ?? {}), [current]);

  const toggle = async (key: keyof EmailPrefs) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setBusy(true);
    setFeedback(null);
    try {
      await onSave({ email_prefs: next });
      setFeedback({ kind: 'ok', text: 'Preferences saved.' });
    } catch (err) {
      setPrefs(prefs);
      setFeedback({ kind: 'error', text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-faint">
        Email preferences
      </h2>
      <p className="mt-1.5 text-sm text-muted">
        Saved to your account. Nothing sends mail yet — wire up a scheduled job when you
        want these to fire.
      </p>
      <ul className="mt-3 divide-y divide-line">
        {PREFS.map(({ key, label, hint }) => {
          const on = Boolean(prefs[key]);
          return (
            <li key={key} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{label}</p>
                <p className="text-xs text-muted">{hint}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={label}
                disabled={busy}
                onClick={() => void toggle(key)}
                className={`focus-ring relative h-6 w-11 shrink-0 rounded-full transition
                  disabled:opacity-60 ${on ? 'bg-accent' : 'bg-line'}`}
              >
                <span
                  aria-hidden="true"
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-card
                    transition-transform duration-200 ${on ? 'translate-x-[22px]' : 'translate-x-0.5'}`}
                />
              </button>
            </li>
          );
        })}
      </ul>
      <FeedbackLine feedback={feedback} />
    </section>
  );
}
