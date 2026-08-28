'use client';

import { useMemo } from 'react';
import { usePhysio } from '@/hooks/usePhysio';
import { ProgressBar } from '@/components/ProgressBar';
import { ExerciseCard } from '@/components/ExerciseCard';
import { AppointmentCard } from '@/components/AppointmentCard';
import { NotesPanel } from '@/components/NotesPanel';
import { EmptyRegimen } from '@/components/EmptyRegimen';
import { DayComplete } from '@/components/DayComplete';
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
  const rest = plan.items.filter((i) => i.status !== 'due');
  const allDone = plan.totalRequired > 0 && plan.totalCompleted >= plan.totalRequired;

  if (loading) return <SkeletonList />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Today</h1>
        <p className="mt-0.5 text-sm text-muted">{formatLongDate(today)}</p>
      </div>

      {error && (
        <p
          className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger-soft-fg"
          role="alert"
        >
          {error}
        </p>
      )}

      {exercises.length === 0 ? (
        <EmptyRegimen onSeed={seedRegimen} />
      ) : (
        <>
          {allDone ? (
            <DayComplete sessions={plan.totalRequired} />
          ) : (
            <section className="card p-5">
              <ProgressBar
                percent={plan.percent}
                completed={plan.totalCompleted}
                required={plan.totalRequired}
              />
            </section>
          )}

          {dueNow.length > 0 && (
            <Section title="Due today" count={dueNow.length}>
              <CardList
                items={dueNow}
                today={today}
                busyKeys={busyKeys}
                logsFor={todaysLogsByExercise}
                onToggle={toggle}
                onAnnotate={annotateToday}
              />
            </Section>
          )}

          {rest.length > 0 && (
            <Section
              title={dueNow.length === 0 ? 'Your exercises' : 'Completed & not scheduled'}
              count={rest.length}
            >
              <CardList
                items={rest}
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
      <h2 className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-faint">
        {title}
        <span className="chip-muted !px-2 !py-0.5 tabular-nums">{count}</span>
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
    <div className="space-y-4">
      <div className="h-8 w-32 animate-pulse rounded-lg bg-panel" />
      <div className="h-32 animate-pulse rounded-2xl bg-panel" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-28 animate-pulse rounded-2xl bg-panel" />
      ))}
    </div>
  );
}
