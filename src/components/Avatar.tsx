import type { CSSProperties } from 'react';
'use client';

import { avatarHue, initials } from '@/lib/user';

interface Props {
  name: string;
  seed?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = {
  sm: 'h-9 w-9 text-[13px]',
  md: 'h-11 w-11 text-sm',
  lg: 'h-20 w-20 text-2xl',
} as const;

/** Initials avatar with a colour derived from the user, not from randomness. */
export function Avatar({ name, seed, size = 'sm', className = '' }: Props) {
  const hue = avatarHue(seed || name);
  return (
    <span
      aria-hidden="true"
      className={`avatar-swatch flex shrink-0 items-center justify-center rounded-full
        font-semibold ring-1 ring-inset ring-black/5 dark:ring-white/10
        ${SIZES[size]} ${className}`}
      // Only the hue is per-user; globals.css picks the lightness pair for the
      // active theme so this never becomes a glare disc in dark mode.
      style={{ '--avatar-h': hue } as CSSProperties}
    >
      {initials(name)}
    </span>
  );
}
