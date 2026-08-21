'use client';

import { useMemo } from 'react';
import { usePhysio } from '@/hooks/usePhysio';
import { EmptyRegimen } from '@/components/EmptyRegimen';
import { dosageLabel, frequencyGroup, scheduleLabel, GROUP_ORDER } from '@/lib/schedule';
import type { Exercise } from '@/lib/types';

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
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-slate-200" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Schedule</h1>
        <p className="text-sm text-slate-500">
          The full prescribed regimen, grouped by how often each exercise is due.
        </p>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {exercises.length === 0 ? (
        <EmptyRegimen onSeed={seedRegimen} />
      ) : (
        grouped.map(([group, list]) => (
          <section key={group}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              {group}
            </h2>
            <ul className="card divide-y divide-slate-200">
              {list.map((exercise) => (
                <li key={exercise.id} className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-900">{exercise.name}</h3>
                    <p className="mt-0.5 text-sm text-slate-600">{dosageLabel(exercise)}</p>
                    {exercise.description && (
                      <p className="mt-1 text-sm leading-relaxed text-slate-500">
                        {exercise.description}
                      </p>
                    )}
                    <span className="chip mt-2 bg-slate-100 text-slate-600">
                      {exercise.category}
                    </span>
                  </div>
                  <span className="chip shrink-0 bg-brand-50 text-brand-700">
                    {scheduleLabel(exercise)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
