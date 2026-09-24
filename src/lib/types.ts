/** How often an exercise is prescribed. Mirrors the `frequency_type` enum in Postgres. */
export type FrequencyType =
  | 'daily'
  | 'times_per_day'
  | 'every_n_days'
  | 'times_per_week'
  /** No schedule — done when it's wanted (e.g. stretches after a track session). */
  | 'as_needed';

export interface Exercise {
  id: string;
  user_id: string;
  name: string;
  category: string;
  description: string | null;
  frequency: FrequencyType;
  sessions_per_day: number;
  interval_days: number | null;
  weekly_target_min: number | null;
  weekly_target_max: number | null;
  target_sets: number | null;
  target_reps: number | null;
  hold_seconds: number | null;
  load_lbs: number | null;
  is_active: boolean;
  display_order: number;
}

export interface LogEntry {
  id: string;
  user_id: string;
  exercise_id: string;
  /** Local calendar day the session belongs to, as YYYY-MM-DD. */
  completed_on: string;
  completed_at: string;
  session_index: number;
  pain_level: number | null;
  notes: string | null;
}

export interface Appointment {
  id: string;
  user_id: string;
  title: string;
  scheduled_at: string;
  /** IANA zone the appointment is booked in, e.g. "America/Toronto". */
  timezone: string;
  location: string | null;
  notes: string | null;
}

export interface TherapistNote {
  id: string;
  user_id: string;
  body: string;
  category: string;
  is_pinned: boolean;
  noted_on: string;
  display_order: number;
}

/** Why an exercise is (or is not) on today's list. */
export type PlanStatus =
  | 'due'       // still owed today
  | 'done'      // every session for today is logged
  | 'optional'  // weekly minimum met, extra sessions still allowed
  | 'resting';  // not scheduled today

export interface PlanItem {
  exercise: Exercise;
  /** Sessions expected today. 0 for optional/resting items. */
  requiredSessions: number;
  /** Sessions already logged today. */
  completedSessions: number;
  status: PlanStatus;
  /** Plain-English explanation of the schedule rule, e.g. "3x per day". */
  scheduleLabel: string;
  /** Plain-English state, e.g. "1 of 3 done today" or "Next due Sat 23 Aug". */
  statusLabel: string;
  /** Weekly progress, for `times_per_week` exercises only. */
  weekly?: { done: number; min: number; max: number; daysLeftInWeek: number };
  /** True when a weekly exercise can no longer afford a skipped day. */
  urgent: boolean;
}

export interface DailyPlan {
  items: PlanItem[];
  totalRequired: number;
  totalCompleted: number;
  /** 0-100. 100 when nothing is scheduled today. */
  percent: number;
}
