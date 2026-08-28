'use client';

import type { ReactNode } from 'react';

interface Props {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: 'default' | 'accent';
}

export function StatTile({ label, value, hint, icon, tone = 'default' }: Props) {
  return (
    <div
      className={`rounded-2xl border p-4 transition ${
        tone === 'accent'
          ? 'border-accent/25 bg-accent-soft'
          : 'border-line bg-panel/60'
      }`}
    >
      <div className="flex items-center gap-1.5">
        {icon && (
          <span className={tone === 'accent' ? 'text-accent-soft-fg' : 'text-faint'}>
            {icon}
          </span>
        )}
        <span
          className={`text-[11px] font-semibold uppercase tracking-wider ${
            tone === 'accent' ? 'text-accent-soft-fg' : 'text-faint'
          }`}
        >
          {label}
        </span>
      </div>
      <p
        className={`mt-1.5 text-2xl font-bold tabular-nums ${
          tone === 'accent' ? 'text-accent-soft-fg' : 'text-ink'
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}
