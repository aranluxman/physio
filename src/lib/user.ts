import type { User } from '@supabase/supabase-js';

/** The name to show for a user: their chosen display name, else the email local part. */
export function displayName(user: User | null): string {
  if (!user) return 'You';
  const chosen = (user.user_metadata?.display_name as string | undefined)?.trim();
  if (chosen) return chosen;
  const email = user.email ?? '';
  const local = email.split('@')[0] ?? '';
  if (!local) return 'You';
  // "luxman.satchi" -> "Luxman Satchi"
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** One or two letters for the avatar. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Stable hue per user, so the avatar colour is theirs and doesn't jump around. */
export function avatarHue(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(hash) % 360;
}
