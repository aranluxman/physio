'use client';

import type { TherapistNote } from '@/lib/types';

export function NotesPanel({ notes }: { notes: TherapistNote[] }) {
  if (notes.length === 0) return null;

  return (
    <section className="card p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Therapist notes
      </h2>
      <ul className="mt-3 space-y-3">
        {notes.map((note) => (
          <li key={note.id} className="flex gap-3">
            <span
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                note.is_pinned ? 'bg-brand-500' : 'bg-slate-300'
              }`}
              aria-hidden="true"
            />
            <div>
              <p
                className={`text-sm leading-relaxed ${
                  note.is_pinned ? 'font-medium text-slate-900' : 'text-slate-600'
                }`}
              >
                {note.body}
              </p>
              <span className="mt-0.5 inline-block text-xs uppercase tracking-wide text-slate-400">
                {note.category}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
