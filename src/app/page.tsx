'use client';

import { useMemo } from 'react';
import { usePhysio } from '@/hooks/usePhysio';
import { ProgressBar } from '@/components/ProgressBar';
import { ExerciseCard } from '@/components/ExerciseCard';
import { AppointmentCard } from '@/components/AppointmentCard';
import { NotesPanel } from '@/components/NotesPanel';
import { EmptyRegimen } from '@/components/EmptyRegimen';
import { formatLongDate } from '@/lib/date';
import type { PlanItem } from '@/lib/types';

export default function DashboardPage() {
  const {
    exercises,
    logs,
    notes,
    plan,
    nextAppointment,
    today,
    loading,
    error,
    busyKeys,
    logSession,
    unlogSession,
    annotateToday,
    seedRegimen,
  } = usePhysio();

  const todaysLogsByExercise = useMemo(() => {
    const map = new Map<string, typeof logs>();
    for (const log of logs) {
      if (log.completed_on !== today) continue;
      const list = map.get(log.exercise_id) ?? [];
      list.push(log);
      map.set(log.exercise_id, list);
    }
    return map;
  }, [logs, today]);

  const toggle = (exerciseId: string, sessionIndex: number, checked: boolean) => {
    if (checked) void unlogSession(exerciseId, sessionIndex);
    else void logSession(exerciseId, sessionIndex);
  };

  const dueNow = plan.items.filter((i) => i.status === 'due');
  const laterToday = plan.items.filter((i) => i.status !== 'due');

  if (loading) return <SkeletonList />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Today</h1>
        <p className="text-sm text-slate-500">{formatLongDate(today)}</p>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {exercises.length === 0 ? (
        <EmptyRegimen onSeed={seedRegimen} />
      ) : (
        <>
          <section className="card p-5">
            <ProgressBar
              percent={plan.percent}
              completed={plan.totalCompleted}
              required={plan.totalRequired}
            />
          </section>

          <Section title="Due today" count={dueNow.length}>
            {dueNow.length === 0 ? (
              <p className="card p-5 text-sm text-slate-600">
                Everything scheduled for today is logged. 🎉
              </p>
            ) : (
              <CardList
                items={dueNow}
                today={today}
                busyKeys={busyKeys}
                logsFor={todaysLogsByExercise}
                onToggle={toggle}
                onAnnotate={annotateToday}
              />
            )}
          </Section>

          {laterToday.length > 0 && (
            <Section title="Completed & not scheduled" count={laterToday.length}>
              <CardList
                items={laterToday}
                today={today}
                busyKeys={busyKeys}
                logsFor={todaysLogsByExercise}
                onToggle={toggle}
                onAnnotate={annotateToday}
              />
            </Section>
          )}
        </>
      )}

      <AppointmentCard appointment={nextAppointment} />
      <NotesPanel notes={notes} />
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {title}
        <span className="chip bg-slate-200 text-slate-600">{count}</span>
      </h2>
      {children}
    </section>
  );
}

function CardList({
  items,
  today,
  busyKeys,
  logsFor,
  onToggle,
  onAnnotate,
}: {
  items: PlanItem[];
  today: string;
  busyKeys: Set<string>;
  logsFor: Map<string, ReturnType<typeof usePhysio>['logs']>;
  onToggle: (exerciseId: string, sessionIndex: number, checked: boolean) => void;
  onAnnotate: (exerciseId: string, painLevel: number | null, note: string | null) => void;
}) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <ExerciseCard
          key={item.exercise.id}
          item={item}
          today={today}
          todaysLogs={logsFor.get(item.exercise.id) ?? []}
          busyKeys={busyKeys}
          onToggleSession={onToggle}
          onAnnotate={onAnnotate}
        />
      ))}
    </ul>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-3">
      <div className="h-8 w-32 animate-pulse rounded-lg bg-slate-200" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200" />
      ))}
    </div>
  );
}
