'use client';

import { useEffect, useState } from 'react';
import { CheckIcon } from './icons';

const PIECES = Array.from({ length: 14 }, (_, i) => ({
  left: `${6 + i * 6.6}%`,
  delay: `${(i % 7) * 90}ms`,
  hue: [
    'bg-accent',
    'bg-ok',
    'bg-info',
    'bg-warn',
  ][i % 4],
  size: i % 3 === 0 ? 'h-2.5 w-1.5' : 'h-1.5 w-1.5',
}));

/**
 * Celebratory panel for a fully-completed day. The confetti is decorative and
 * runs once; `prefers-reduced-motion` flattens it via the global rule.
 */
export function DayComplete({ sessions }: { sessions: number }) {
  const [burst, setBurst] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setBurst(false), 2000);
    return () => clearTimeout(id);
  }, []);

  return (
    <section
      className="animate-rise-in relative overflow-hidden rounded-2xl border border-ok/30
        bg-ok-soft p-6 text-center"
      aria-live="polite"
    >
      {burst && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          {PIECES.map((p, i) => (
            <span
              key={i}
              className={`animate-confetti absolute top-0 rounded-[2px] ${p.hue} ${p.size}`}
              style={{ left: p.left, animationDelay: p.delay }}
            />
          ))}
        </div>
      )}

      <span
        className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-full
          bg-ok text-white shadow-raised"
      >
        <CheckIcon className="animate-check-pop h-7 w-7" />
      </span>
      <h2 className="relative mt-3.5 text-lg font-bold text-ok-soft-fg">
        That&rsquo;s everything for today
      </h2>
      <p className="relative mt-1 text-sm text-ok-soft-fg/85">
        All {sessions} session{sessions === 1 ? '' : 's'} logged. The hip thanks you.
      </p>
    </section>
  );
}
