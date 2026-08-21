/**
 * Date helpers. Everything the user sees is in *their* local timezone, so
 * calendar days are derived from the browser clock rather than from UTC.
 * `en-CA` formats as YYYY-MM-DD, which is exactly the shape Postgres `date`
 * columns expect.
 */

export function toISODate(date: Date): string {
  return date.toLocaleDateString('en-CA');
}

export function todayISO(): string {
  return toISODate(new Date());
}

/** Parse a YYYY-MM-DD string at local noon, which keeps DST out of the maths. */
export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function addDays(iso: string, days: number): string {
  const date = fromISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

/** Whole days from `fromIso` to `toIso` (negative if `toIso` is earlier). */
export function daysBetween(fromIso: string, toIso: string): number {
  const ms = fromISODate(toIso).getTime() - fromISODate(fromIso).getTime();
  return Math.round(ms / 86_400_000);
}

/** Monday of the week containing `iso`. */
export function startOfWeek(iso: string): string {
  const date = fromISODate(iso);
  const dow = (date.getDay() + 6) % 7; // 0 = Monday
  return addDays(iso, -dow);
}

/** Days left in the week including today (Monday = 7, Sunday = 1). */
export function daysLeftInWeek(iso: string): number {
  return 7 - daysBetween(startOfWeek(iso), iso);
}

export function formatShortDate(iso: string): string {
  return fromISODate(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function formatLongDate(iso: string): string {
  return fromISODate(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Render an instant as wall-clock time. Pass `timeZone` to pin it to the zone
 * the event was booked in, so a 5:30 PM appointment still reads 5:30 PM on a
 * laptop whose clock is set to somewhere else.
 */
export function formatDateTime(timestamp: string, timeZone?: string): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  };
  if (timeZone) {
    options.timeZone = timeZone;
    options.timeZoneName = 'short';
  }
  try {
    return new Date(timestamp).toLocaleString(undefined, options);
  } catch {
    // Unknown IANA zone on an old engine — fall back to the device clock.
    delete options.timeZone;
    delete options.timeZoneName;
    return new Date(timestamp).toLocaleString(undefined, options);
  }
}

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  isPast: boolean;
}

export function countdownTo(timestamp: string, now: Date = new Date()): Countdown {
  const diff = new Date(timestamp).getTime() - now.getTime();
  const abs = Math.abs(diff);
  return {
    days: Math.floor(abs / 86_400_000),
    hours: Math.floor((abs % 86_400_000) / 3_600_000),
    minutes: Math.floor((abs % 3_600_000) / 60_000),
    isPast: diff < 0,
  };
}
