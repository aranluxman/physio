'use client';

import { useEffect, useState } from 'react';

interface Props {
  percent: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  children?: React.ReactNode;
}

/**
 * Circular completion meter. The stroke animates from wherever it was to the
 * new value, so ticking an exercise visibly moves the ring.
 */
export function ProgressRing({
  percent,
  size = 92,
  strokeWidth = 8,
  label,
  children,
}: Props) {
  const clamped = Math.max(0, Math.min(100, percent));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Start empty on mount so the first paint animates in rather than snapping.
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(clamped));
    return () => cancelAnimationFrame(id);
  }, [clamped]);

  const complete = clamped >= 100;

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? `${Math.round(clamped)} percent complete`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-panel"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (shown / 100) * circumference}
          className={`transition-[stroke-dashoffset,stroke] duration-700 ease-out ${
            complete ? 'stroke-ok' : 'stroke-accent'
          }`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
}
