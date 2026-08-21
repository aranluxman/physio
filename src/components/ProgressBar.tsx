'use client';

interface Props {
  percent: number;
  completed: number;
  required: number;
}

export function ProgressBar({ percent, completed, required }: Props) {
  const complete = required > 0 && completed >= required;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-slate-600">Today&rsquo;s progress</span>
        <span className="text-sm font-semibold text-slate-900">
          {required === 0 ? 'Nothing scheduled' : `${completed} / ${required} sessions`}
        </span>
      </div>
      <div
        className="mt-2 h-3 w-full overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Daily exercise completion"
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            complete ? 'bg-emerald-500' : 'bg-brand-500'
          }`}
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
      <p className="mt-2 text-sm text-slate-500">
        {required === 0
          ? 'Rest day — nothing is due. Optional sessions are still listed below.'
          : complete
            ? `All ${required} sessions logged. Nice work.`
            : `${percent}% complete · ${required - completed} session${
                required - completed === 1 ? '' : 's'
              } to go.`}
      </p>
    </div>
  );
}
