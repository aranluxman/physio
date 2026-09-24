'use client';

import { useMemo } from 'react';
import { usePhysio } from '@/hooks/usePhysio';
import { Heatmap, type HeatmapDay } from '@/components/Heatmap';
import { StatTile } from '@/components/StatTile';
import { CategoryIcon } from '@/components/CategoryIcon';
import { FlameIcon, ChartIcon, CheckIcon } from '@/components/icons';
import { addDays, daysBetween, formatShortDate } from '@/lib/date';
import { dayCompletion } from '@/lib/schedule';
import { profileStats } from '@/lib/stats';

const MAX_WINDOW_DAYS = 84; // twelve weeks reads well as a grid
const MIN_WINDOW_DAYS = 21; // ...but twelve weeks of blanks reads as broken

export default function HistoryPage() {
  const { exercises, logs, today, loading } = usePhysio();

  /*
   * Scale the window to how long there has actually been something to show.
   * A brand-new account otherwise gets twelve weeks of empty squares, which
   * looks like a bug rather than a blank slate.
   */
  const windowDays = useMemo(() => {
    let earliest: string | null = null;
    for (const log of logs) {
      if (earliest === null || log.completed_on < earliest) earliest = log.completed_on;
    }
    if (earliest === null) return MIN_WINDOW_DAYS;
    const span = daysBetween(earliest, today) + 7;
    return Math.max(MIN_WINDOW_DAYS, Math.min(MAX_WINDOW_DAYS, span));
  }, [logs, today]);

  const days = useMemo<HeatmapDay[]>(
    () =>
      Array.from({ length: windowDays }, (_, i) => {
        const iso = addDays(today, -(windowDays - 1 - i));
        return { iso, ...dayCompletion(exercises, logs, iso) };
      }),
    [exercises, logs, today, windowDays],
  );

  const stats = useMemo(
    () => profileStats(exercises, logs, today),
    [exercises, logs, today],
  );

  const painPoints = useMemo(
    () =>
      logs
        .filter((l) => l.pain_level != null || (l.notes && l.notes.trim() !== ''))
        .sort((a, b) => (a.completed_on < b.completed_on ? 1 : -1))
        .slice(0, 15),
    [logs],
  );

  const exerciseFor = (id: string) => exercises.find((e) => e.id === id);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-32 animate-pulse rounded-lg bg-panel" />
        <div className="h-64 animate-pulse rounded-2xl bg-panel" />
      </div>
    );
  }

  const scheduled = days.filter((d) => d.required > 0);
  const perfect = scheduled.filter((d) => d.completed >= d.required).length;
  const hasHistory = stats.activeDays > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">History</h1>
        <p className="mt-0.5 text-sm text-muted">
          {hasHistory
            ? `The last ${windowDays} days — ${perfect} of ${scheduled.length} scheduled ` +
              `${scheduled.length === 1 ? 'day' : 'days'} fully completed.`
            : 'Nothing logged yet. Tick a few sessions on Today and this fills in.'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          tone="accent"
          label="Current streak"
          value={`${stats.currentStreak} ${stats.currentStreak === 1 ? 'day' : 'days'}`}
          icon={<FlameIcon className="h-3.5 w-3.5" />}
        />
        <StatTile
          label="Longest streak"
          value={`${stats.longestStreak} ${stats.longestStreak === 1 ? 'day' : 'days'}`}
          icon={<ChartIcon className="h-3.5 w-3.5" />}
        />
        <StatTile
          label="Sessions"
          value={stats.totalSessions}
          hint={`${stats.activeDays} active days`}
          icon={<CheckIcon className="h-3.5 w-3.5" />}
        />
        <StatTile
          label="Average pain"
          value={stats.averagePain === null ? '—' : `${stats.averagePain}/10`}
        />
      </div>

      <section className="card p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-faint">
          Daily completion
        </h2>
        {hasHistory ? (
          <div className="mt-4">
            <Heatmap days={days} today={today} />
          </div>
        ) : (
          <p className="mt-2.5 text-sm text-muted">
            Your completion grid appears here once you have logged a session. Each
            square is one day, shaded by how much of that day you finished.
          </p>
        )}
      </section>

      <section className="card p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-faint">
          Recent pain &amp; notes
        </h2>
        {painPoints.length === 0 ? (
          <p className="mt-2.5 text-sm text-muted">
            Nothing logged yet. Add a pain level from any exercise card on the Today page.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {painPoints.map((log) => {
              const exercise = exerciseFor(log.exercise_id);
              return (
                <li key={log.id} className="flex items-start gap-3 py-3.5">
                  <CategoryIcon
                    category={exercise?.category ?? 'General'}
                    size="sm"
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate font-medium text-ink">
                        {exercise?.name ?? 'Exercise'}
                      </span>
                      <span className="shrink-0 text-xs text-faint">
                        {formatShortDate(log.completed_on)}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {log.pain_level != null && (
                        <span
                          className={
                            log.pain_level >= 5
                              ? 'chip-danger'
                              : log.pain_level >= 2
                                ? 'chip-warn'
                                : 'chip-ok'
                          }
                        >
                          Pain {log.pain_level}/10
                        </span>
                      )}
                      {log.notes && <span className="text-sm text-muted">{log.notes}</span>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
