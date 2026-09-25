'use client';

import { useMemo, useState } from 'react';
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
  0: 'Rest day — nothing scheduled',
  1: 'Nothing logged',
  2: 'Some sessions',
  3: 'Most sessions',
  4: 'Everything done',
};

const DAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

interface Props {
  days: HeatmapDay[];
  today: string;
}

export function Heatmap({ days, today }: Props) {
  const [hovered, setHovered] = useState<HeatmapDay | null>(null);

  const grid = useMemo(() => {
    if (days.length === 0) return null;
    // Lay the run out in calendar weeks (Mon..Sun rows) like a contribution
    // graph, padding the first week so weekdays line up across columns.
    const gridStart = startOfWeek(days[0].iso);
    const total = daysBetween(gridStart, today) + 1;
    const byIso = new Map(days.map((d) => [d.iso, d]));

    const weeks: (HeatmapDay | null)[][] = [];
    for (let i = 0; i < total; i++) {
      const iso = addDays(gridStart, i);
      const w = Math.floor(i / 7);
      if (!weeks[w]) weeks[w] = Array(7).fill(null);
      weeks[w][i % 7] = byIso.get(iso) ?? null;
    }

    // One label per month, on the first column where that month appears.
    const months: { col: number; label: string }[] = [];
    let seen = '';
    weeks.forEach((week, col) => {
      const first = week.find(Boolean);
      if (!first) return;
      const d = fromISODate(first.iso);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (key !== seen) {
        seen = key;
        months.push({ col, label: d.toLocaleDateString(undefined, { month: 'short' }) });
      }
    });

    return { weeks, months };
  }, [days, today]);

  if (!grid) return null;
  const { weeks, months } = grid;

  return (
    <div>
      {/*
        One column per week, square cells that grow with the card but stop at
        a sane size — left to fill a wide card outright, eight weeks of data
        became a checkerboard of 96px tiles. Centred so the leftover space is
        balanced rather than stranding the grid in the corner.
      */}
      <div
        className="mx-auto grid gap-x-1 gap-y-1"
        style={{
          gridTemplateColumns: `1.25rem repeat(${weeks.length}, minmax(0, 1fr))`,
          maxWidth: `calc(1.25rem + ${weeks.length} * 2.1rem)`,
        }}
      >
        {/* Month row */}
        <span aria-hidden="true" />
        {weeks.map((_, col) => {
          const m = months.find((x) => x.col === col);
          return (
            <span
              key={`m${col}`}
              aria-hidden="true"
              className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-faint"
            >
              {m?.label ?? ''}
            </span>
          );
        })}

        {/* Seven weekday rows */}
        {DAY_INITIALS.map((initial, row) => (
          <FragmentRow
            key={row}
            initial={initial}
            row={row}
            weeks={weeks}
            today={today}
            onHover={setHovered}
          />
        ))}
      </div>

      {/* Reserved so the layout does not jump as the pointer moves. */}
      <div className="mt-4 flex min-h-[2.25rem] flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p aria-live="polite" className="text-sm">
          {hovered ? (
            <>
              <span className="font-semibold text-ink">{formatShortDate(hovered.iso)}</span>
              <span className="text-muted">
                {' · '}
                {hovered.required === 0
                  ? 'rest day'
                  : `${hovered.completed} of ${hovered.required} sessions · ${hovered.percent}%`}
              </span>
            </>
          ) : (
            <span className="text-faint">Hover or tab through a day for detail</span>
          )}
        </p>

        <div className="flex items-center gap-1.5 text-[11px] font-medium text-faint">
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

function FragmentRow({
  initial,
  row,
  weeks,
  today,
  onHover,
}: {
  initial: string;
  row: number;
  weeks: (HeatmapDay | null)[][];
  today: string;
  onHover: (day: HeatmapDay | null) => void;
}) {
  return (
    <>
      <span
        aria-hidden="true"
        className="flex items-center text-[10px] font-medium leading-none text-faint"
      >
        {/* Only every other row is labelled, or the column reads as noise. */}
        {row % 2 === 0 ? initial : ''}
      </span>
      {weeks.map((week, col) => {
        const day = week[row];
        if (!day) {
          return <span key={col} className="aspect-square" aria-hidden="true" />;
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
            key={col}
            type="button"
            aria-label={label}
            title={label}
            onMouseEnter={() => onHover(day)}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(day)}
            onBlur={() => onHover(null)}
            className={`focus-ring aspect-square w-full rounded-[4px] transition duration-150
              hover:ring-2 hover:ring-ink/20 ${LEVEL_CLASS[level]}
              ${isToday ? 'ring-2 ring-accent ring-offset-1 ring-offset-surface' : ''}`}
          />
        );
      })}
    </>
  );
}
