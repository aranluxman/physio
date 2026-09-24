'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/errors';
import { addDays, todayISO } from '@/lib/date';
import { buildDailyPlan } from '@/lib/schedule';
import type { Appointment, Exercise, LogEntry, TherapistNote } from '@/lib/types';
import { useAuth } from './useAuth';

/** How much history to pull down. Plenty for streaks and "every N days" maths. */
const HISTORY_DAYS = 120;

/**
 * PostgREST caps a response at the project's max-rows setting (1000 by
 * default) and, without an ORDER BY, which rows you get is undefined. At ~16
 * sessions a day that cap arrives in about two months and the history would
 * silently start using an arbitrary subset. Page through it instead.
 */
const LOG_PAGE_SIZE = 1000;

async function fetchAllLogs(
  supabase: ReturnType<typeof getSupabase>,
  since: string,
): Promise<LogEntry[]> {
  const all: LogEntry[] = [];
  for (let from = 0; ; from += LOG_PAGE_SIZE) {
    const { data, error } = await supabase
      .from('physio_logs')
      .select('*')
      .gte('completed_on', since)
      .order('completed_on', { ascending: false })
      .order('exercise_id', { ascending: true })
      .order('session_index', { ascending: true })
      .range(from, from + LOG_PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as LogEntry[];
    all.push(...page);
    if (page.length < LOG_PAGE_SIZE) return all;
  }
}

interface PhysioState {
  exercises: Exercise[];
  logs: LogEntry[];
  appointments: Appointment[];
  notes: TherapistNote[];
}

const EMPTY: PhysioState = { exercises: [], logs: [], appointments: [], notes: [] };

export function usePhysio() {
  const { user } = useAuth();
  const [data, setData] = useState<PhysioState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKeys, setBusyKeys] = useState<Set<string>>(new Set());
  const [today, setToday] = useState(todayISO());
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Roll the checklist over at midnight without needing a page refresh.
  useEffect(() => {
    const timer = setInterval(() => {
      const current = todayISO();
      setToday((prev) => (prev === current ? prev : current));
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  const refresh = useCallback(async () => {
    if (!user) {
      setData(EMPTY);
      setLoading(false);
      return;
    }
    const supabase = getSupabase();
    setError(null);
    try {
      const since = addDays(todayISO(), -HISTORY_DAYS);
      const [exercisesRes, logs, appointmentsRes, notesRes] = await Promise.all([
        supabase.from('physio_exercises').select('*').order('display_order', { ascending: true }),
        fetchAllLogs(supabase, since),
        supabase.from('physio_appointments').select('*').order('scheduled_at', { ascending: true }),
        supabase
          .from('physio_therapist_notes')
          .select('*')
          .order('is_pinned', { ascending: false })
          .order('display_order', { ascending: true }),
      ]);

      const firstError =
        exercisesRes.error || appointmentsRes.error || notesRes.error;
      if (firstError) throw firstError;
      if (!mounted.current) return;

      setData({
        exercises: (exercisesRes.data ?? []) as Exercise[],
        logs,
        appointments: (appointmentsRes.data ?? []) as Appointment[],
        notes: (notesRes.data ?? []) as TherapistNote[],
      });
    } catch (err) {
      if (mounted.current) setError(errorMessage(err));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  const setBusy = useCallback((key: string, value: boolean) => {
    setBusyKeys((prev) => {
      const next = new Set(prev);
      if (value) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  /** Mark one session of an exercise complete for a given day. */
  const logSession = useCallback(
    async (
      exerciseId: string,
      sessionIndex: number,
      extra?: { painLevel?: number | null; notes?: string | null; onDate?: string },
    ) => {
      if (!user) return;
      const completedOn = extra?.onDate ?? todayISO();
      const key = `${exerciseId}:${completedOn}:${sessionIndex}`;
      setBusy(key, true);
      setError(null);

      // Optimistic: show the tick immediately, roll back if the write fails.
      const optimistic: LogEntry = {
        id: `optimistic-${key}`,
        user_id: user.id,
        exercise_id: exerciseId,
        completed_on: completedOn,
        completed_at: new Date().toISOString(),
        session_index: sessionIndex,
        pain_level: extra?.painLevel ?? null,
        notes: extra?.notes ?? null,
      };
      setData((prev) => ({ ...prev, logs: [...prev.logs, optimistic] }));

      try {
        const { data: inserted, error: insertError } = await getSupabase()
          .from('physio_logs')
          .upsert(
            {
              user_id: user.id,
              exercise_id: exerciseId,
              completed_on: completedOn,
              session_index: sessionIndex,
              pain_level: extra?.painLevel ?? null,
              notes: extra?.notes ?? null,
            },
            { onConflict: 'exercise_id,completed_on,session_index' },
          )
          .select()
          .single();
        if (insertError) throw insertError;
        if (!mounted.current) return;
        setData((prev) => ({
          ...prev,
          logs: prev.logs.map((l) => (l.id === optimistic.id ? (inserted as LogEntry) : l)),
        }));
      } catch (err) {
        if (!mounted.current) return;
        setData((prev) => ({ ...prev, logs: prev.logs.filter((l) => l.id !== optimistic.id) }));
        setError(errorMessage(err));
      } finally {
        if (mounted.current) setBusy(key, false);
      }
    },
    [user, setBusy],
  );

  /** Undo one logged session. */
  const unlogSession = useCallback(
    async (exerciseId: string, sessionIndex: number, onDate?: string) => {
      if (!user) return;
      const completedOn = onDate ?? todayISO();
      const key = `${exerciseId}:${completedOn}:${sessionIndex}`;
      setBusy(key, true);
      setError(null);

      const removed = data.logs.filter(
        (l) =>
          l.exercise_id === exerciseId &&
          l.completed_on === completedOn &&
          l.session_index === sessionIndex,
      );
      setData((prev) => ({
        ...prev,
        logs: prev.logs.filter((l) => !removed.some((r) => r.id === l.id)),
      }));

      try {
        const { error: deleteError } = await getSupabase()
          .from('physio_logs')
          .delete()
          .eq('exercise_id', exerciseId)
          .eq('completed_on', completedOn)
          .eq('session_index', sessionIndex);
        if (deleteError) throw deleteError;
      } catch (err) {
        if (!mounted.current) return;
        setData((prev) => ({ ...prev, logs: [...prev.logs, ...removed] }));
        setError(errorMessage(err));
      } finally {
        if (mounted.current) setBusy(key, false);
      }
    },
    [user, data.logs, setBusy],
  );

  /** Attach a pain level / note to today's most recent session of an exercise. */
  const annotateToday = useCallback(
    async (exerciseId: string, painLevel: number | null, note: string | null) => {
      if (!user) return;
      const completedOn = todayISO();
      const sessions = data.logs
        .filter((l) => l.exercise_id === exerciseId && l.completed_on === completedOn)
        .sort((a, b) => b.session_index - a.session_index);
      const target = sessions[0];
      if (!target || target.id.startsWith('optimistic-')) return;

      setData((prev) => ({
        ...prev,
        logs: prev.logs.map((l) =>
          l.id === target.id ? { ...l, pain_level: painLevel, notes: note } : l,
        ),
      }));

      const { error: updateError } = await getSupabase()
        .from('physio_logs')
        .update({ pain_level: painLevel, notes: note })
        .eq('id', target.id);
      if (updateError && mounted.current) {
        setError(errorMessage(updateError));
        void refresh();
      }
    },
    [user, data.logs, refresh],
  );

  /** Load the prescribed regimen for a brand-new account. */
  const seedRegimen = useCallback(async () => {
    setError(null);
    const { error: rpcError } = await getSupabase().rpc('physio_seed_my_regimen');
    if (rpcError) {
      setError(errorMessage(rpcError));
      return;
    }
    await refresh();
  }, [refresh]);

  const plan = useMemo(
    () => buildDailyPlan(data.exercises, data.logs, today),
    [data.exercises, data.logs, today],
  );

  const nextAppointment = useMemo(() => {
    const now = Date.now();
    const upcoming = data.appointments
      .filter((a) => new Date(a.scheduled_at).getTime() >= now)
      .sort(
        (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime(),
      );
    return upcoming[0] ?? data.appointments[data.appointments.length - 1] ?? null;
  }, [data.appointments]);

  return {
    ...data,
    plan,
    nextAppointment,
    today,
    loading,
    error,
    busyKeys,
    refresh,
    logSession,
    unlogSession,
    annotateToday,
    seedRegimen,
    clearError: () => setError(null),
  };
}
