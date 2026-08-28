/**
 * Profile statistics derived from the log history.
 *
 * Streak rules, chosen so the numbers stay honest and motivating:
 *  - A scheduled day counts only when every session due that day was logged.
 *  - A rest day (nothing was due) neither breaks a streak nor extends it — it
 *    is stepped over. Otherwise the Dead Bug's off-days would reset you daily.
 *  - Today is never counted against you while it is still in progress: if it
 *    is incomplete, the streak is measured up to yesterday instead.
 */
import type { Exercise, LogEntry } from './types';
import { addDays, daysBetween } from './date';
import { dayCompletion } from './schedule';

/** Never walk back further than this, however sparse the history. */
const MAX_LOOKBACK_DAYS = 730;

type DayState = 'complete' | 'incomplete' | 'rest';

function stateOf(exercises: Exercise[], logs: LogEntry[], iso: string): DayState {
  const { required, completed } = dayCompletion(exercises, logs, iso);
  if (required === 0) return 'rest';
  return completed >= required ? 'complete' : 'incomplete';
}

/** Earliest day we have any evidence for, bounded by MAX_LOOKBACK_DAYS. */
function earliestDay(logs: LogEntry[], today: string): string {
  let earliest: string | null = null;
  for (const log of logs) {
    if (earliest === null || log.completed_on < earliest) earliest = log.completed_on;
  }
  const floor = addDays(today, -MAX_LOOKBACK_DAYS);
  if (earliest === null || earliest < floor) return floor;
  return earliest;
}

export function currentStreak(
  exercises: Exercise[],
  logs: LogEntry[],
  today: string,
): number {
  if (exercises.length === 0 || logs.length === 0) return 0;
  const floor = earliestDay(logs, today);

  let cursor = today;
  // An unfinished today does not break the run — start from yesterday instead.
  if (stateOf(exercises, logs, today) === 'incomplete') cursor = addDays(today, -1);

  let streak = 0;
  while (cursor >= floor) {
    const state = stateOf(exercises, logs, cursor);
    if (state === 'incomplete') break;
    if (state === 'complete') streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function longestStreak(
  exercises: Exercise[],
  logs: LogEntry[],
  today: string,
): number {
  if (exercises.length === 0 || logs.length === 0) return 0;
  const start = earliestDay(logs, today);
  const span = daysBetween(start, today);

  let best = 0;
  let run = 0;
  for (let i = 0; i <= span; i++) {
    const iso = addDays(start, i);
    const state = stateOf(exercises, logs, iso);
    if (state === 'complete') {
      run += 1;
      if (run > best) best = run;
    } else if (state === 'incomplete') {
      // Today only counts against the run once the day is actually over.
      if (iso !== today) run = 0;
    }
    // 'rest' carries the run through untouched.
  }
  return best;
}

export interface ProfileStats {
  currentStreak: number;
  longestStreak: number;
  totalSessions: number;
  /** Distinct days on which at least one session was logged. */
  activeDays: number;
  /** Average pain level across every session that recorded one, or null. */
  averagePain: number | null;
}

export function profileStats(
  exercises: Exercise[],
  logs: LogEntry[],
  today: string,
): ProfileStats {
  const days = new Set(logs.map((l) => l.completed_on));
  const painValues = logs
    .map((l) => l.pain_level)
    .filter((p): p is number => typeof p === 'number');

  return {
    currentStreak: currentStreak(exercises, logs, today),
    longestStreak: longestStreak(exercises, logs, today),
    totalSessions: logs.length,
    activeDays: days.size,
    averagePain:
      painValues.length === 0
        ? null
        : Math.round((painValues.reduce((a, b) => a + b, 0) / painValues.length) * 10) / 10,
  };
}
