'use client';

import { useEffect, useState } from 'react';
import type { LogEntry, PlanItem, PlanStatus } from '@/lib/types';
import { dosageLabel } from '@/lib/schedule';
import { SessionToggle } from './SessionToggle';

const STATUS_STYLES: Record<PlanStatus, string> = {
  due: 'bg-amber-100 text-amber-800',
  done: 'bg-emerald-100 text-emerald-800',
  optional: 'bg-sky-100 text-sky-800',
  resting: 'bg-slate-100 text-slate-600',
};

const STATUS_TEXT: Record<PlanStatus, string> = {
  due: 'Due',
  done: 'Done',
  optional: 'Optional',
  resting: 'Rest',
};

interface Props {
  item: PlanItem;
  todaysLogs: LogEntry[];
  busyKeys: Set<string>;
  today: string;
  onToggleSession: (exerciseId: string, sessionIndex: number, checked: boolean) => void;
  onAnnotate: (exerciseId: string, painLevel: number | null, note: string | null) => void;
}

export function ExerciseCard({
  item,
  todaysLogs,
  busyKeys,
  today,
  onToggleSession,
  onAnnotate,
}: Props) {
  const { exercise, status } = item;
  const [expanded, setExpanded] = useState(false);

  // Rest-day and weekly-target-met exercises still get one tick box, so an
  // extra session can always be logged if you feel good.
  const slots = Math.max(item.requiredSessions, 1);
  const doneIndexes = new Set(todaysLogs.map((l) => l.session_index));
  const latest = [...todaysLogs].sort((a, b) => b.session_index - a.session_index)[0];

  const [pain, setPain] = useState<number | null>(latest?.pain_level ?? null);
  const [note, setNote] = useState(latest?.notes ?? '');

  // Re-sync the draft when a new session is logged (or undone) for this day.
  const latestId = latest?.id ?? null;
  useEffect(() => {
    setPain(latest?.pain_level ?? null);
    setNote(latest?.notes ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestId]);

  const saveAnnotation = () => {
    onAnnotate(exercise.id, pain, note.trim() === '' ? null : note.trim());
    setExpanded(false);
  };

  return (
    <li
      className={`card p-4 transition ${
        status === 'done' ? 'border-emerald-200 bg-emerald-50/40' : ''
      } ${item.urgent && status === 'due' ? 'border-amber-300' : ''}`}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h3 className="text-base font-semibold text-slate-900">{exercise.name}</h3>
        <span className={`chip ${STATUS_STYLES[status]}`}>{STATUS_TEXT[status]}</span>
        {item.urgent && status === 'due' && (
          <span className="chip bg-red-100 text-red-700">Don&rsquo;t skip</span>
        )}
      </div>
      <p className="mt-1 text-sm text-slate-600">
        {dosageLabel(exercise)} · <span className="text-slate-500">{item.scheduleLabel}</span>
      </p>
      <p className="mt-0.5 text-sm text-slate-500">{item.statusLabel}</p>

      {item.weekly && (
        <div className="mt-3 flex items-center gap-2">
          <div className="flex gap-1" aria-hidden="true">
            {Array.from({ length: item.weekly.max }, (_, i) => (
              <span
                key={i}
                className={`h-1.5 w-8 rounded-full ${
                  i < item.weekly!.done
                    ? 'bg-brand-500'
                    : i < item.weekly!.min
                      ? 'bg-slate-200'
                      : 'bg-slate-200/60'
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-slate-500">
            {item.weekly.done}/{item.weekly.min}
            {item.weekly.max > item.weekly.min ? `-${item.weekly.max}` : ''} this week
          </span>
        </div>
      )}

      {/* Actions: details on the left, the day's tick boxes on the right. Keeping
          them on their own row stops long exercise names from squeezing the
          tap targets on a phone. */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-sm font-medium text-brand-700 hover:text-brand-800"
            aria-expanded={expanded}
          >
            {expanded ? 'Hide details' : 'Details & pain log'}
          </button>
          {latest?.pain_level != null && (
            <span className="chip bg-slate-100 text-slate-600">Pain {latest.pain_level}/10</span>
          )}
        </div>

        <div className="ml-auto flex flex-wrap justify-end gap-1.5">
          {Array.from({ length: slots }, (_, i) => (
            <SessionToggle
              key={i}
              index={i}
              total={slots}
              checked={doneIndexes.has(i)}
              busy={busyKeys.has(`${exercise.id}:${today}:${i}`)}
              exerciseName={exercise.name}
              onToggle={() => onToggleSession(exercise.id, i, doneIndexes.has(i))}
            />
          ))}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-4 border-t border-slate-200 pt-3">
          {exercise.description && (
            <p className="text-sm leading-relaxed text-slate-600">{exercise.description}</p>
          )}

          <div>
            <span className="text-sm font-medium text-slate-700">Pain level today</span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Array.from({ length: 11 }, (_, level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setPain(pain === level ? null : level)}
                  aria-pressed={pain === level}
                  className={`h-9 w-9 rounded-lg text-sm font-semibold transition ${
                    pain === level
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-500">0 = no pain · 10 = worst</p>
          </div>

          <div>
            <label
              className="text-sm font-medium text-slate-700"
              htmlFor={`note-${exercise.id}`}
            >
              Notes
            </label>
            <textarea
              id={`note-${exercise.id}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="How did it feel? Any pinching at the front of the hip?"
              className="input mt-1 resize-y text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-primary"
              onClick={saveAnnotation}
              disabled={todaysLogs.length === 0}
            >
              Save
            </button>
            {todaysLogs.length === 0 && (
              <span className="text-xs text-slate-500">
                Log a session first, then the note attaches to it.
              </span>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
