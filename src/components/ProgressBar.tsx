'use client';

import { ProgressRing } from './ProgressRing';

interface Props {
  percent: number;
  completed: number;
  required: number;
}

export function ProgressBar({ percent, completed, required }: Props) {
  const complete = required > 0 && completed >= required;
  const remaining = Math.max(0, required - completed);

  return (
    <div className="flex items-center gap-5">
      <ProgressRing
        percent={percent}
        label={`Today's sessions: ${completed} of ${required} complete`}
      >
        <span className="text-xl font-bold tabular-nums text-ink">{percent}%</span>
        <span className="text-[10px] font-medium uppercase tracking-wide text-faint">done</span>
      </ProgressRing>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-muted">Today&rsquo;s progress</h2>
          <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">
            {required === 0 ? 'Rest day' : `${completed} / ${required}`}
          </span>
        </div>

        <div
          className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-panel"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Daily exercise completion"
        >
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${
              complete ? 'bg-ok' : 'bg-accent'
            }`}
            style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
          />
        </div>

        <p className="mt-2 text-sm text-muted">
          {required === 0
            ? 'Nothing is due today. Optional sessions are still listed below.'
            : complete
              ? `All ${required} sessions logged.`
              : `${remaining} session${remaining === 1 ? '' : 's'} to go.`}
        </p>
      </div>
    </div>
  );
}
