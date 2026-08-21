'use client';

import { useState } from 'react';

/** Shown when the account has no exercises yet (e.g. the signup trigger is off). */
export function EmptyRegimen({ onSeed }: { onSeed: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);

  return (
    <div className="card p-6 text-center">
      <h2 className="text-lg font-semibold text-slate-900">No exercises yet</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-slate-600">
        Load the prescribed hip regimen — Hip CAR, 90:90 rotations, the three stretches, dead
        bug, kettlebell hip flexor hold and lateral step downs.
      </p>
      <button
        type="button"
        className="btn-primary mt-4"
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
