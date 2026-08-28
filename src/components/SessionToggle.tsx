'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckIcon } from './icons';

interface Props {
  index: number;
  total: number;
  checked: boolean;
  busy: boolean;
  exerciseName: string;
  onToggle: () => void;
}

/**
 * One tick box. For a 3x/day exercise the card renders three of these, so each
 * session of the day is logged separately.
 */
export function SessionToggle({ index, total, checked, busy, exerciseName, onToggle }: Props) {
  const label =
    total === 1
      ? `Mark ${exerciseName} complete`
      : `Mark ${exerciseName} session ${index + 1} of ${total} complete`;

  // Animate only on the transition into "checked", not on first paint of an
  // already-complete exercise.
  const [justChecked, setJustChecked] = useState(false);
  const previous = useRef(checked);
  useEffect(() => {
    if (checked && !previous.current) {
      setJustChecked(true);
      const id = setTimeout(() => setJustChecked(false), 400);
      return () => clearTimeout(id);
    }
    previous.current = checked;
  }, [checked]);

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy}
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      className={`focus-ring group relative flex h-11 min-w-[2.75rem] items-center justify-center
        gap-1.5 rounded-xl border px-3 text-sm font-semibold transition duration-200
        active:scale-95 disabled:opacity-60 ${
          checked
            ? 'border-ok bg-ok text-white'
            : 'border-line bg-surface text-muted hover:border-accent hover:text-accent'
        }`}
    >
      <span className="relative flex h-5 w-5 items-center justify-center">
        {checked ? (
          <CheckIcon className={`h-4 w-4 ${justChecked ? 'animate-check-pop' : ''}`} />
        ) : (
          <span
            aria-hidden="true"
            className="h-[18px] w-[18px] rounded-[6px] border-2 border-current transition
              group-hover:scale-110"
          />
        )}
        {/* Ripple on completion. */}
        {justChecked && (
          <span
            aria-hidden="true"
            className="animate-check-pop absolute inset-0 -m-2 rounded-full bg-white/25"
          />
        )}
      </span>
      {total > 1 && <span className="tabular-nums">{index + 1}</span>}
    </button>
  );
}
