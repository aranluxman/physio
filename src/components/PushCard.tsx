'use client';

import { usePush } from '@/hooks/usePush';
import { FlameIcon } from './icons';

/**
 * Opt-in for the daily reminder. The browser only grants notification
 * permission from a user gesture, so this has to be a button the person
 * actually presses — it can't be switched on for them.
 */
export function PushCard() {
  const { state, busy, error, enable, disable } = usePush();
  const on = state === 'on';

  return (
    <section className="card p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-soft-fg">
          <FlameIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-faint">
            Daily reminder
          </h2>
          <p className="mt-1.5 text-sm text-muted">
            A notification at 7pm your time, but only on days you still have something
            due and haven&rsquo;t logged anything. Nothing arrives once the day is done.
          </p>

          {state === 'unsupported' && (
            <p className="mt-3 rounded-xl bg-panel px-3.5 py-2.5 text-sm text-muted">
              This browser can&rsquo;t do notifications. On iPhone you need to add the app
              to your Home Screen first; on Android, Chrome works as-is.
            </p>
          )}

          {state === 'blocked' && (
            <p className="mt-3 rounded-xl bg-warn-soft px-3.5 py-2.5 text-sm text-warn-soft-fg">
              Notifications are blocked for this site. Turn them back on in your browser&rsquo;s
              site settings, then reload this page.
            </p>
          )}

          {(state === 'off' || state === 'on' || state === 'checking') && (
            <div className="mt-3.5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => (on ? void disable() : void enable())}
                disabled={busy || state === 'checking'}
                aria-pressed={on}
                className={on ? 'btn-secondary' : 'btn-primary'}
              >
                {busy
                  ? 'Working…'
                  : state === 'checking'
                    ? 'Checking…'
                    : on
                      ? 'Turn off reminders'
                      : 'Turn on reminders'}
              </button>
              {on && (
                <span className="chip-ok">On for this device</span>
              )}
            </div>
          )}

          {on && (
            <p className="mt-2.5 text-xs text-faint">
              Each device is separate — turn it on again on your phone if you set this up
              on a laptop.
            </p>
          )}

          {error && (
            <p role="alert" className="mt-3 rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger-soft-fg">
              {error}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
