'use client';

import { useState } from 'react';
import { formatShortDate, fromISODate, startOfWeek, addDays, daysBetween } from '@/lib/date';

export interface HeatmapDay {
  iso: string;
  percent: number;
  completed: number;
  required: number;
}

/** Five buckets: nothing scheduled, none, some, most, all. */
function levelOf(day: HeatmapDay): 0 | 1 | 2 | 3 | 4 {
  if (day.required === 0) return 0;
  if (day.completed === 0) return 1;
  if (day.percent >= 100) return 4;
  return day.percent >= 60 ? 3 : 2;
}

/**
 * Colour ramp. Rest days read as a flat neutral so they are visibly "not a
 * miss", and the three working levels climb in both saturation and lightness
 * so the gradient survives greyscale and colour-blind viewing.
 */
const LEVEL_CLASS: Record<number, string> = {
  0: 'bg-panel',
  1: 'bg-line',
  2: 'bg-accent/30',
  3: 'bg-accent/65',
  4: 'bg-ok',
};

const LEVEL_LABEL: Record<number, string> = {
  0: 'Rest day',
  1: 'Nothing logged',
  2: 'Some sessions',
  3: 'Most sessions',
  4: 'Complete',
};

const WEEKDAYS = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'];

interface Props {
  days: HeatmapDay[];
  today: string;
}

export function Heatmap({ days, today }: Props) {
  const [hovered, setHovered] = useState<HeatmapDay | null>(null);

  if (days.length === 0) return null;

  // Lay the run out in calendar weeks (Mon..Sun columns) like a contribution
  // graph, padding the first week so weekdays line up across columns.
  const first = days[0].iso;
  const gridStart = startOfWeek(first);
  const total = daysBetween(gridStart, today) + 1;
  const byIso = new Map(days.map((d) => [d.iso, d]));

  const weeks: (HeatmapDay | null)[][] = [];
  for (let i = 0; i < total; i++) {
    const iso = addDays(gridStart, i);
    const weekIndex = Math.floor(i / 7);
    const dayIndex = i % 7;
    if (!weeks[weekIndex]) weeks[weekIndex] = Array(7).fill(null);
    weeks[weekIndex][dayIndex] = byIso.get(iso) ?? null;
  }

  const monthLabels = weeks.map((week) => {
    const firstReal = week.find(Boolean);
    if (!firstReal) return '';
    const d = fromISODate(firstReal.iso);
    // Label a column only when its week contains the 1st..7th of a month.
    return d.getDate() <= 7 ? d.toLocaleDateString(undefined, { month: 'short' }) : '';
  });

  return (
    <div>
      <div className="overflow-x-auto pb-1">
        {/* One knob controls the whole grid, so cells grow with the viewport
            rather than sitting in a corner of a wide card. */}
        <div
          className="inline-flex min-w-full flex-col gap-1.5
            [--cell:15px] sm:[--cell:20px] lg:[--cell:26px]"
        >
          <div className="flex gap-[3px] pl-9">
            {monthLabels.map((label, i) => (
              <span
                key={i}
                className="w-[var(--cell)] shrink-0 text-[10px] font-medium text-faint"
                aria-hidden="true"
              >
                {label}
              </span>
            ))}
          </div>

          <div className="flex gap-[3px]">
            <div className="mr-1 flex w-8 shrink-0 flex-col gap-[3px]">
              {WEEKDAYS.map((d, i) => (
                <span
                  key={i}
                  className="flex h-[var(--cell)] items-center text-[10px] font-medium text-faint"
                  aria-hidden="true"
                >
                  {d}
                </span>
              ))}
            </div>

            {weeks.map((week, wi) => (
              <div key={wi} className="flex shrink-0 flex-col gap-[3px]">
                {week.map((day, di) => {
                  if (!day) {
                    return <span key={di} className="h-[var(--cell)] w-[var(--cell)]" aria-hidden="true" />;
                  }
                  const level = levelOf(day);
                  const isToday = day.iso === today;
                  const label = `${formatShortDate(day.iso)}: ${
                    day.required === 0
                      ? 'rest day'
                      : `${day.completed} of ${day.required} sessions, ${day.percent}% complete`
                  }`;
                  return (
                    <button
                      key={di}
                      type="button"
                      tabIndex={0}
                      aria-label={label}
                      title={label}
                      onMouseEnter={() => setHovered(day)}
                      onMouseLeave={() => setHovered(null)}
                      onFocus={() => setHovered(day)}
                      onBlur={() => setHovered(null)}
                      className={`focus-ring h-[var(--cell)] w-[var(--cell)] rounded-[4px] transition
                        duration-150 hover:scale-125 hover:ring-1 hover:ring-ink/25
                        ${LEVEL_CLASS[level]}
                        ${isToday ? 'ring-1 ring-accent ring-offset-1 ring-offset-surface' : ''}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Reserve the row so the layout does not jump as you move across cells. */}
      <div className="mt-3 flex min-h-[38px] flex-wrap items-center justify-between gap-3">
        <div aria-live="polite" className="text-sm">
          {hovered ? (
            <span className="text-ink">
              <span className="font-semibold">{formatShortDate(hovered.iso)}</span>
              <span className="text-muted">
                {' — '}
                {hovered.required === 0
                  ? 'rest day'
                  : `${hovered.completed}/${hovered.required} sessions · ${hovered.percent}%`}
              </span>
            </span>
          ) : (
            <span className="text-faint">Hover or focus a day for detail</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-faint">
          <span>Less</span>
          {[1, 2, 3, 4].map((level) => (
            <span
              key={level}
              title={LEVEL_LABEL[level]}
              className={`h-3 w-3 rounded-[3px] ${LEVEL_CLASS[level]}`}
            />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
