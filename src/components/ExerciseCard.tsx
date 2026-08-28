'use client';

import { useEffect, useState } from 'react';
import type { LogEntry, PlanItem, PlanStatus } from '@/lib/types';
import { dosageLabel } from '@/lib/schedule';
import { SessionToggle } from './SessionToggle';
import { CategoryIcon } from './CategoryIcon';
import { ChevronDownIcon } from './icons';

const STATUS_CHIP: Record<PlanStatus, string> = {
  due: 'chip-warn',
  done: 'chip-ok',
  optional: 'chip-info',
  resting: 'chip-muted',
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

  const complete = status === 'done';

  return (
    <li
      className={`card-interactive overflow-hidden p-4 ${
        complete ? 'border-ok/30 bg-ok-soft/25' : ''
      } ${item.urgent && status === 'due' ? 'border-warn/40' : ''}`}
    >
      <div className="flex items-start gap-3">
        <CategoryIcon category={exercise.category} size="sm" className="mt-0.5" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3
              className={`text-[15px] font-semibold leading-tight text-ink transition ${
                complete ? 'opacity-70' : ''
              }`}
            >
              {exercise.name}
            </h3>
            <span className={STATUS_CHIP[status]}>{STATUS_TEXT[status]}</span>
            {item.urgent && status === 'due' && (
              <span className="chip-danger">Don&rsquo;t skip</span>
            )}
          </div>

          <p className="mt-1 text-sm font-medium text-muted">
            {dosageLabel(exercise)}
            <span className="text-faint"> · {item.scheduleLabel}</span>
          </p>
          <p className="mt-0.5 text-[13px] text-faint">{item.statusLabel}</p>
        </div>
      </div>

      {item.weekly && (
        <div className="mt-3 flex items-center gap-2 pl-11">
          <div className="flex gap-1" aria-hidden="true">
            {Array.from({ length: item.weekly.max }, (_, i) => (
              <span
                key={i}
                className={`h-1.5 w-8 rounded-full transition-colors duration-300 ${
                  i < item.weekly!.done ? 'bg-accent' : 'bg-line'
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-faint">
            {item.weekly.done}/{item.weekly.min}
            {item.weekly.max > item.weekly.min ? `-${item.weekly.max}` : ''} this week
          </span>
        </div>
      )}

      {/* Actions: details on the left, the day's tick boxes on the right. */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pl-11">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="focus-ring -ml-1.5 flex items-center gap-1 rounded-lg px-1.5 py-1
              text-[13px] font-semibold text-accent transition hover:bg-accent-soft"
            aria-expanded={expanded}
            aria-controls={`details-${exercise.id}`}
          >
            {expanded ? 'Hide details' : 'Details & pain log'}
            <ChevronDownIcon
              className={`h-3.5 w-3.5 transition-transform duration-200 ${
                expanded ? 'rotate-180' : ''
              }`}
            />
          </button>
          {latest?.pain_level != null && (
            <span className="chip-muted">Pain {latest.pain_level}/10</span>
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
        <div
          id={`details-${exercise.id}`}
          className="animate-rise-in mt-3.5 space-y-4 border-t border-line pt-3.5"
        >
          {exercise.description && (
            <p className="text-sm leading-relaxed text-muted">{exercise.description}</p>
          )}

          <fieldset>
            <legend className="text-sm font-medium text-ink">Pain level today</legend>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Array.from({ length: 11 }, (_, level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setPain(pain === level ? null : level)}
                  aria-pressed={pain === level}
                  aria-label={`Pain level ${level} out of 10`}
                  className={`focus-ring h-9 w-9 rounded-lg text-sm font-semibold transition
                    active:scale-90 ${
                      pain === level
                        ? 'bg-ink text-canvas'
                        : 'bg-panel text-muted hover:bg-line hover:text-ink'
                    }`}
                >
                  {level}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-faint">0 = no pain · 10 = worst</p>
          </fieldset>

          <div>
            <label
              className="text-sm font-medium text-ink"
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
              className="input mt-1.5 resize-y text-sm"
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
              <span className="text-xs text-faint">
                Log a session first, then the note attaches to it.
              </span>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
