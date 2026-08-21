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
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Next appointment
        </h2>
        <p className="mt-2 text-sm text-slate-600">No appointment scheduled.</p>
      </section>
    );
  }

  // `now` is null on the very first render so the server-rendered HTML and the
  // first client render match; the countdown fills in a tick later.
  const countdown = now ? countdownTo(appointment.scheduled_at, now) : null;
  const soon = countdown ? !countdown.isPast && countdown.days <= 7 : false;

  return (
    <section
      className={`card overflow-hidden ${soon ? 'border-brand-300 ring-1 ring-brand-200' : ''}`}
    >
      <div className="bg-brand-600 px-5 py-3 text-white">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-100">
          Next appointment
        </h2>
        <p className="mt-0.5 text-lg font-semibold">{appointment.title}</p>
      </div>

      <div className="px-5 py-4">
        <p className="text-base font-semibold text-slate-900">
          {formatDateTime(appointment.scheduled_at, appointment.timezone)}
        </p>
        {appointment.location && (
          <p className="mt-1 text-sm text-slate-600">{appointment.location}</p>
        )}

        {countdown && (
          <div className="mt-4">
            {countdown.isPast ? (
              <p className="text-sm font-medium text-slate-500">
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
          <p className="mt-4 border-t border-slate-200 pt-3 text-sm text-slate-600">
            {appointment.notes}
          </p>
        )}
      </div>
    </section>
  );
}

function CountUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex-1 rounded-xl bg-slate-100 px-3 py-2 text-center">
      <div className="text-2xl font-bold tabular-nums text-slate-900">{value}</div>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}
