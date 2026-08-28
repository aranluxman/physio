'use client';

import { useState } from 'react';
import { SparkleIcon } from './icons';

/** Shown when the account has no exercises yet. */
export function EmptyRegimen({ onSeed }: { onSeed: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);

  return (
    <div className="card p-8 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-soft-fg">
        <SparkleIcon className="h-6 w-6" />
      </span>
      <h2 className="mt-4 text-lg font-semibold text-ink">No exercises yet</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
        Load the prescribed hip regimen — Hip CAR, 90:90 rotations, the three stretches, dead
        bug, kettlebell hip flexor hold and lateral step downs.
      </p>
      <button
        type="button"
        className="btn-primary mt-5"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onSeed();
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Loading…' : 'Load my regimen'}
      </button>
    </div>
  );
}
