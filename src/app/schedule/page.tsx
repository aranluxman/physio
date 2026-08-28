'use client';

import { useMemo, useState } from 'react';
import { usePhysio } from '@/hooks/usePhysio';
import { EmptyRegimen } from '@/components/EmptyRegimen';
import { CategoryIcon } from '@/components/CategoryIcon';
import { ChevronDownIcon } from '@/components/icons';
import { dosageLabel, frequencyGroup, scheduleLabel, GROUP_ORDER } from '@/lib/schedule';
import type { Exercise } from '@/lib/types';

/** One-line summary of what a group asks of you, shown on the collapsed header. */
const GROUP_BLURB: Record<string, string> = {
  'Daily / Multiple times per day': 'Mobility and stretches, every day',
  'Every 2 days': 'Core work with a recovery day between',
  '2-3 times per week': 'Loaded strength work, flexible days',
};

export default function SchedulePage() {
  const { exercises, loading, error, seedRegimen } = usePhysio();

  const grouped = useMemo(() => {
    const map = new Map<string, Exercise[]>();
    for (const exercise of exercises) {
      const key = frequencyGroup(exercise);
      const list = map.get(key) ?? [];
      list.push(exercise);
      map.set(key, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.display_order - b.display_order);
    return GROUP_ORDER.filter((g) => map.has(g)).map((g) => [g, map.get(g)!] as const);
  }, [exercises]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-36 animate-pulse rounded-lg bg-panel" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-36 animate-pulse rounded-2xl bg-panel" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Schedule</h1>
        <p className="mt-0.5 text-sm text-muted">
          The full prescribed regimen, grouped by how often each exercise is due.
        </p>
      </div>

      {error && (
        <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger-soft-fg" role="alert">
          {error}
        </p>
      )}

      {exercises.length === 0 ? (
        <EmptyRegimen onSeed={seedRegimen} />
      ) : (
        <div className="space-y-4">
          {grouped.map(([group, list], index) => (
            <FrequencyGroup
              key={group}
              title={group}
              blurb={GROUP_BLURB[group]}
              exercises={list}
              defaultOpen={index === 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FrequencyGroup({
  title,
  blurb,
  exercises,
  defaultOpen,
}: {
  title: string;
  blurb?: string;
  exercises: Exercise[];
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = `group-${title.replace(/\W+/g, '-').toLowerCase()}`;

  return (
    <section className="card overflow-hidden">
      <h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={id}
          className="focus-ring flex w-full items-center gap-3 px-4 py-3.5 text-left
            transition hover:bg-panel/60"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-ink">{title}</span>
            {blurb && <span className="mt-0.5 block text-[13px] text-muted">{blurb}</span>}
          </span>
          <span className="chip-muted shrink-0 tabular-nums">{exercises.length}</span>
          <ChevronDownIcon
            className={`h-4 w-4 shrink-0 text-muted transition-transform duration-200 ${
              open ? 'rotate-180' : ''
            }`}
          />
        </button>
      </h2>

      {open && (
        <ul id={id} className="divide-y divide-line border-t border-line">
          {exercises.map((exercise) => (
            <li key={exercise.id} className="flex items-start gap-3 p-4">
              <CategoryIcon category={exercise.category} />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                  <h3 className="text-[15px] font-semibold leading-tight text-ink">
                    {exercise.name}
                  </h3>
                  <span className="chip-accent shrink-0">{scheduleLabel(exercise)}</span>
                </div>

                {/* Dosage is the thing you look up mid-session, so it gets the
                    strongest weight after the name. */}
                <p className="mt-1 text-sm font-semibold tabular-nums text-muted">
                  {dosageLabel(exercise)}
                </p>

                {exercise.description && (
                  <p className="mt-1.5 text-[13px] leading-relaxed text-faint">
                    {exercise.description}
                  </p>
                )}

                <span className="mt-2 inline-block text-[11px] font-semibold uppercase tracking-wider text-faint">
                  {exercise.category}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
