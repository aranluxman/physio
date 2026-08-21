'use client';

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

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy}
      aria-pressed={checked}
      aria-label={label}
      className={`flex h-11 min-w-[2.75rem] items-center justify-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition
        focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2
        disabled:opacity-60 ${
          checked
            ? 'border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600'
            : 'border-slate-300 bg-white text-slate-500 hover:border-brand-400 hover:text-brand-700'
        }`}
    >
      {checked ? (
        <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z"
            clipRule="evenodd"
          />
        </svg>
      ) : (
        <span className="h-5 w-5 rounded-md border-2 border-current" aria-hidden="true" />
      )}
      {total > 1 && <span>{index + 1}</span>}
    </button>
  );
}
