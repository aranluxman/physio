/**
 * The scheduling engine: given the prescribed exercises and everything logged
 * so far, work out what is actually due today.
 *
 * Pure functions only — no Supabase, no React — so the rules stay easy to
 * reason about and to test.
 */
import type { DailyPlan, Exercise, LogEntry, PlanItem, PlanStatus } from './types';
import { addDays, daysBetween, daysLeftInWeek, formatShortDate, startOfWeek } from './date';

/** Human-readable dosage, e.g. "3 sets x 8 reps" or "30s hold". */
export function dosageLabel(exercise: Exercise): string {
  const parts: string[] = [];
  if (exercise.target_sets && exercise.target_sets > 1) parts.push(`${exercise.target_sets} sets`);
  if (exercise.target_reps) parts.push(`${exercise.target_reps} reps`);
  if (exercise.hold_seconds) parts.push(`${exercise.hold_seconds}s hold`);
  if (exercise.load_lbs) parts.push(`${Number(exercise.load_lbs)} lbs`);
  return parts.join(' · ') || 'As prescribed';
}

/** Human-readable schedule rule, e.g. "3x per day" or "Every 2 days". */
export function scheduleLabel(exercise: Exercise): string {
  switch (exercise.frequency) {
    case 'daily':
      return 'Daily';
    case 'times_per_day':
      return `${exercise.sessions_per_day}x per day`;
    case 'every_n_days':
      return exercise.interval_days === 2
        ? 'Every 2 days'
        : `Every ${exercise.interval_days} days`;
    case 'times_per_week': {
      const min = exercise.weekly_target_min ?? 1;
      const max = exercise.weekly_target_max ?? min;
      return max > min ? `${min}-${max}x per week` : `${min}x per week`;
    }
  }
}

/** Grouping key used by the schedule view. */
export function frequencyGroup(exercise: Exercise): string {
  switch (exercise.frequency) {
    case 'daily':
    case 'times_per_day':
      return 'Daily / Multiple times per day';
    case 'every_n_days':
      return 'Every 2 days';
    case 'times_per_week':
      return '2-3 times per week';
  }
}

export const GROUP_ORDER = [
  'Daily / Multiple times per day',
  'Every 2 days',
  '2-3 times per week',
];

function countOn(logs: LogEntry[], exerciseId: string, iso: string): number {
  return logs.filter((l) => l.exercise_id === exerciseId && l.completed_on === iso).length;
}

/** Most recent day this exercise was logged, on or before `iso`. */
function lastCompletedOnOrBefore(
  logs: LogEntry[],
  exerciseId: string,
  iso: string,
): string | null {
  let latest: string | null = null;
  for (const log of logs) {
    if (log.exercise_id !== exerciseId) continue;
    if (log.completed_on > iso) continue;
    if (latest === null || log.completed_on > latest) latest = log.completed_on;
  }
  return latest;
}

function countInWeek(logs: LogEntry[], exerciseId: string, iso: string): number {
  const weekStart = startOfWeek(iso);
  const days = new Set<string>();
  for (const log of logs) {
    if (log.exercise_id !== exerciseId) continue;
    if (log.completed_on >= weekStart && log.completed_on <= iso) days.add(log.completed_on);
  }
  // A weekly exercise counts once per day no matter how many times it is ticked.
  return days.size;
}

function planForExercise(exercise: Exercise, logs: LogEntry[], today: string): PlanItem {
  const doneToday = countOn(logs, exercise.id, today);
  const base = {
    exercise,
    completedSessions: doneToday,
    scheduleLabel: scheduleLabel(exercise),
    urgent: false,
  };

  switch (exercise.frequency) {
    case 'daily':
    case 'times_per_day': {
      const required = exercise.frequency === 'daily' ? 1 : exercise.sessions_per_day;
      const status: PlanStatus = doneToday >= required ? 'done' : 'due';
      const statusLabel =
        required === 1
          ? doneToday >= 1
            ? 'Done today'
            : 'Due today'
          : `${Math.min(doneToday, required)} of ${required} sessions done today`;
      return { ...base, requiredSessions: required, status, statusLabel };
    }

    case 'every_n_days': {
      const interval = exercise.interval_days ?? 1;
      if (doneToday > 0) {
        return {
          ...base,
          requiredSessions: 1,
          status: 'done',
          statusLabel: `Done today · next due ${formatShortDate(addDays(today, interval))}`,
        };
      }
      const last = lastCompletedOnOrBefore(logs, exercise.id, today);
      if (last === null) {
        return {
          ...base,
          requiredSessions: 1,
          status: 'due',
          statusLabel: 'Due today · not logged yet',
        };
      }
      const elapsed = daysBetween(last, today);
      if (elapsed >= interval) {
        const overdue = elapsed - interval;
        return {
          ...base,
          requiredSessions: 1,
          status: 'due',
          urgent: overdue > 0,
          statusLabel:
            overdue > 0
              ? `Overdue by ${overdue} day${overdue === 1 ? '' : 's'} · last done ${formatShortDate(last)}`
              : `Due today · last done ${formatShortDate(last)}`,
        };
      }
      return {
        ...base,
        requiredSessions: 0,
        status: 'resting',
        statusLabel: `Rest day · next due ${formatShortDate(addDays(last, interval))}`,
      };
    }

    case 'times_per_week': {
      const min = exercise.weekly_target_min ?? 1;
      const max = exercise.weekly_target_max ?? min;
      const doneThisWeek = countInWeek(logs, exercise.id, today);
      const daysLeft = daysLeftInWeek(today);
      const weekly = { done: doneThisWeek, min, max, daysLeftInWeek: daysLeft };

      if (doneToday > 0) {
        return {
          ...base,
          requiredSessions: 1,
          status: 'done',
          statusLabel: `Done today · ${doneThisWeek} of ${min} this week`,
          weekly,
        };
      }
      if (doneThisWeek >= max) {
        return {
          ...base,
          requiredSessions: 0,
          status: 'resting',
          statusLabel: `Weekly target met (${doneThisWeek}/${max}) · resumes Monday`,
          weekly,
        };
      }
      if (doneThisWeek >= min) {
        return {
          ...base,
          requiredSessions: 0,
          status: 'optional',
          statusLabel: `Minimum met (${doneThisWeek}/${min}) · optional bonus session`,
          weekly,
        };
      }
      // Below the minimum: if the sessions still owed match the days left,
      // today is no longer skippable.
      const owed = min - doneThisWeek;
      const urgent = owed >= daysLeft;
      return {
        ...base,
        requiredSessions: 1,
        status: 'due',
        urgent,
        statusLabel: urgent
          ? `Due today · ${owed} left with ${daysLeft} day${daysLeft === 1 ? '' : 's'} in the week`
          : `Due this week · ${doneThisWeek} of ${min} done`,
        weekly,
      };
    }
  }
}

const STATUS_RANK: Record<PlanStatus, number> = { due: 0, optional: 1, done: 2, resting: 3 };

/** Build today's checklist, ordered: due first, then optional, done, resting. */
export function buildDailyPlan(
  exercises: Exercise[],
  logs: LogEntry[],
  today: string,
): DailyPlan {
  const items = exercises
    .filter((e) => e.is_active)
    .map((e) => planForExercise(e, logs, today))
    .sort((a, b) => {
      const byStatus = STATUS_RANK[a.status] - STATUS_RANK[b.status];
      if (byStatus !== 0) return byStatus;
      if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
      return a.exercise.display_order - b.exercise.display_order;
    });

  let totalRequired = 0;
  let totalCompleted = 0;
  for (const item of items) {
    totalRequired += item.requiredSessions;
    totalCompleted += Math.min(item.completedSessions, item.requiredSessions);
  }

  return {
    items,
    totalRequired,
    totalCompleted,
    percent: totalRequired === 0 ? 100 : Math.round((totalCompleted / totalRequired) * 100),
  };
}

/** Completion percentage for a single past day — used by the history strip. */
export function dayCompletion(
  exercises: Exercise[],
  logs: LogEntry[],
  iso: string,
): { percent: number; required: number; completed: number } {
  const plan = buildDailyPlan(exercises, logs, iso);
  return {
    percent: plan.percent,
    required: plan.totalRequired,
    completed: plan.totalCompleted,
  };
}
