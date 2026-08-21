'use client';

import { useMemo } from 'react';
import { usePhysio } from '@/hooks/usePhysio';
import { addDays, formatShortDate } from '@/lib/date';
import { dayCompletion } from '@/lib/schedule';

const WINDOW_DAYS = 28;

export default function HistoryPage() {
  const { exercises, logs, today, loading } = usePhysio();

  const days = useMemo(() => {
    return Array.from({ length: WINDOW_DAYS }, (_, i) => {
      const iso = addDays(today, -(WINDOW_DAYS - 1 - i));
      return { iso, ...dayCompletion(exercises, logs, iso) };
    });
  }, [exercises, logs, today]);

  const painPoints = useMemo(
    () =>
      logs
        .filter((l) => l.pain_level != null || (l.notes && l.notes.trim() !== ''))
        .sort((a, b) => (a.completed_on < b.completed_on ? 1 : -1))
        .slice(0, 15),
    [logs],
  );

  const exerciseName = (id: string) =>
    exercises.find((e) => e.id === id)?.name ?? 'Exercise';

  if (loading) {
    return <div className="h-64 animate-pulse rounded-2xl bg-slate-200" />;
  }

  const completedDays = days.filter((d) => d.required > 0 && d.completed >= d.required).length;
  const activeDays = days.filter((d) => d.required > 0).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">History</h1>
        <p className="text-sm text-slate-500">
          Last {WINDOW_DAYS} days · {completedDays} of {activeDays} scheduled days fully
          completed.
        </p>
      </div>

      <section className="card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Daily completion
        </h2>
        <div className="mt-4 grid grid-cols-7 gap-1.5">
          {days.map((day) => (
            <div
              key={day.iso}
              title={`${formatShortDate(day.iso)} — ${day.completed}/${day.required} sessions`}
              className={`aspect-square rounded-md ${cellColour(day.percent, day.required)}`}
            />
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <span>Less</span>
          <span className="h-3 w-3 rounded bg-slate-200" />
          <span className="h-3 w-3 rounded bg-brand-200" />
          <span className="h-3 w-3 rounded bg-brand-400" />
          <span className="h-3 w-3 rounded bg-emerald-500" />
          <span>Complete</span>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Recent pain &amp; notes
        </h2>
        {painPoints.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">
            Nothing logged yet. Add a pain level from any exercise card on the Today page.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-200">
            {painPoints.map((log) => (
              <li key={log.id} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-slate-900">
                    {exerciseName(log.exercise_id)}
                  </span>
                  <span className="text-xs text-slate-500">
                    {formatShortDate(log.completed_on)}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {log.pain_level != null && (
                    <span
                      className={`chip ${
                        log.pain_level >= 5
                          ? 'bg-red-100 text-red-700'
                          : log.pain_level >= 2
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      Pain {log.pain_level}/10
                    </span>
                  )}
                  {log.notes && <span className="text-sm text-slate-600">{log.notes}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function cellColour(percent: number, required: number): string {
  if (required === 0) return 'bg-slate-100';
  if (percent >= 100) return 'bg-emerald-500';
  if (percent >= 60) return 'bg-brand-400';
  if (percent > 0) return 'bg-brand-200';
  return 'bg-slate-200';
}
