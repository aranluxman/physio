'use client';

import { CoreIcon, MobilityIcon, StrengthIcon, StretchIcon } from './icons';

type Tone = 'accent' | 'info' | 'ok' | 'warn';

interface CategoryStyle {
  Icon: typeof MobilityIcon;
  tone: Tone;
}

/**
 * Categories are free text in the database, so match on keywords rather than
 * an exact list — a new "Glute Strength" still gets the strength icon.
 */
function styleFor(category: string): CategoryStyle {
  const c = category.toLowerCase();
  if (c.includes('stretch')) return { Icon: StretchIcon, tone: 'info' };
  if (c.includes('core')) return { Icon: CoreIcon, tone: 'warn' };
  if (c.includes('strength')) return { Icon: StrengthIcon, tone: 'ok' };
  return { Icon: MobilityIcon, tone: 'accent' };
}

const TONES: Record<Tone, string> = {
  accent: 'bg-accent-soft text-accent-soft-fg',
  info: 'bg-info-soft text-info-soft-fg',
  ok: 'bg-ok-soft text-ok-soft-fg',
  warn: 'bg-warn-soft text-warn-soft-fg',
};

const SIZES = {
  sm: 'h-8 w-8 rounded-lg [&>svg]:h-4 [&>svg]:w-4',
  md: 'h-10 w-10 rounded-xl [&>svg]:h-5 [&>svg]:w-5',
} as const;

export function CategoryIcon({
  category,
  size = 'md',
  className = '',
}: {
  category: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const { Icon, tone } = styleFor(category);
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center ${SIZES[size]} ${TONES[tone]} ${className}`}
    >
      <Icon />
    </span>
  );
}

export function categoryTone(category: string): Tone {
  return styleFor(category).tone;
}
