'use client';

import { useEffect, useState } from 'react';
import type { Appointment } from '@/lib/types';
import { countdownTo, formatDateTime } from '@/lib/date';

export function AppointmentCard({ appointment }: { appointment: Appointment | null }) {
  // Tick once a minute so the countdown stays honest on a page left open.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  if (!appointment) {
    return (
      <section className="card p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-faint">
          Next appointment
        </h2>
        <p className="mt-2 text-sm text-muted">No appointment scheduled.</p>
      </section>
    );
  }

  // `now` is null on the very first render so the server-rendered HTML and the
  // first client render match; the countdown fills in a tick later.
  const countdown = now ? countdownTo(appointment.scheduled_at, now) : null;
  const soon = countdown ? !countdown.isPast && countdown.days <= 7 : false;

  return (
    <section
      className={`card overflow-hidden ${soon ? 'border-accent/40 ring-1 ring-accent/20' : ''}`}
    >
      <div className="bg-accent px-5 py-3.5 text-accent-fg dark:bg-accent-soft dark:text-accent-soft-fg">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-accent-fg/75 dark:text-accent-soft-fg/75">
          Next appointment
        </h2>
        <p className="mt-1 text-lg font-semibold">{appointment.title}</p>
      </div>

      <div className="px-5 py-4">
        <p className="text-base font-semibold text-ink">
          {formatDateTime(appointment.scheduled_at, appointment.timezone)}
        </p>
        {appointment.location && (
          <p className="mt-1 text-sm text-muted">{appointment.location}</p>
        )}

        {countdown && (
          <div className="mt-4">
            {countdown.isPast ? (
              <p className="text-sm font-medium text-muted">
                This appointment has passed — book the next one.
              </p>
            ) : (
              <div className="flex gap-2">
                <CountUnit value={countdown.days} label={countdown.days === 1 ? 'day' : 'days'} />
                <CountUnit value={countdown.hours} label="hrs" />
                <CountUnit value={countdown.minutes} label="min" />
              </div>
            )}
          </div>
        )}

        {appointment.notes && (
          <p className="mt-4 border-t border-line pt-3.5 text-sm text-muted">
            {appointment.notes}
          </p>
        )}
      </div>
    </section>
  );
}

function CountUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex-1 rounded-xl bg-panel px-3 py-2.5 text-center">
      <div className="text-2xl font-bold tabular-nums text-ink">{value}</div>
      <div className="text-[11px] font-medium uppercase tracking-wider text-faint">{label}</div>
    </div>
  );
}
