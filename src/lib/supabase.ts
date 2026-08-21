'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

/**
 * Supabase now issues "publishable" keys (`sb_publishable_...`) in place of the
 * older "anon" JWT. Both work identically here, so accept either variable name
 * and prefer the newer one. Next.js only inlines `process.env.NEXT_PUBLIC_*`
 * where it is written out literally, hence the two separate reads.
 */
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * NEXT_PUBLIC_* values are inlined at build time. If the build ran without
 * them the app should say so plainly instead of throwing a cryptic error on
 * the first query.
 */
export const isSupabaseConfigured = Boolean(url && publishableKey);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and ' +
        'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY), then rebuild.',
    );
  }
  if (!client) {
    client = createClient(url as string, publishableKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}
