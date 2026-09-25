/**
 * physio-push — Web Push for the physio tracker.
 *
 * Two jobs, chosen by the `action` in the POST body:
 *
 *   init      Make sure a VAPID keypair exists and return the public half.
 *             The keypair is generated here, inside the function, and the
 *             private key is written straight to physio_server_config. It is
 *             never in the repository, never in a build, and never leaves the
 *             server. Safe to call repeatedly — it only generates once.
 *
 *   remind    The daily cron target. Finds every subscribed user who still has
 *             something due today and has logged nothing, and pushes them a
 *             nudge. Dead endpoints (404/410) are deleted; repeated soft
 *             failures retire a subscription after five strikes.
 *
 * `remind` is protected by a shared secret so a stranger cannot make the app
 * spam its own users; `init` requires a signed-in user.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const admin = () =>
  createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization, content-type, apikey',
      'access-control-allow-methods': 'POST, OPTIONS',
    },
  });

async function getConfig(db: ReturnType<typeof admin>, key: string): Promise<string | null> {
  const { data } = await db.from('physio_server_config').select('value').eq('key', key).maybeSingle();
  return data?.value ?? null;
}

async function setConfig(db: ReturnType<typeof admin>, key: string, value: string) {
  await db.from('physio_server_config').upsert({ key, value }, { onConflict: 'key' });
}

/** Ensure a VAPID keypair exists; return the public half. */
async function ensureKeys(db: ReturnType<typeof admin>) {
  let pub = await getConfig(db, 'vapid_public_key');
  let priv = await getConfig(db, 'vapid_private_key');
  if (!pub || !priv) {
    const keys = webpush.generateVAPIDKeys();
    pub = keys.publicKey;
    priv = keys.privateKey;
    await setConfig(db, 'vapid_public_key', pub);
    await setConfig(db, 'vapid_private_key', priv);
    const subject = (await getConfig(db, 'vapid_subject')) ?? 'mailto:physio@example.com';
    await setConfig(db, 'vapid_subject', subject);
  }
  return { publicKey: pub, privateKey: priv };
}

/** Local calendar date for a device's timezone. */
function localDate(timeZone: string, now = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  } catch {
    return new Intl.DateTimeFormat('en-CA').format(now);
  }
}

/** Local hour 0-23 for a device's timezone. */
function localHour(timeZone: string, now = new Date()): number {
  try {
    return Number(
      new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hour12: false }).format(now),
    );
  } catch {
    return now.getUTCHours();
  }
}

interface Exercise {
  id: string;
  frequency: string;
  sessions_per_day: number;
  interval_days: number | null;
  weekly_target_min: number | null;
  is_active: boolean;
}

/**
 * How many sessions are owed today, mirroring src/lib/schedule.ts. Kept
 * deliberately simple: the reminder only needs "is anything outstanding",
 * not the full plan.
 */
function sessionsDueToday(
  exercises: Exercise[],
  logDates: Map<string, string[]>,
  today: string,
): number {
  let due = 0;
  for (const e of exercises) {
    if (!e.is_active) continue;
    const dates = logDates.get(e.id) ?? [];
    const doneToday = dates.filter((d) => d === today).length;
    switch (e.frequency) {
      case 'daily':
        due += Math.max(0, 1 - doneToday);
        break;
      case 'times_per_day':
        due += Math.max(0, (e.sessions_per_day || 1) - doneToday);
        break;
      case 'every_n_days': {
        if (doneToday > 0) break;
        const past = dates.filter((d) => d <= today).sort();
        const last = past[past.length - 1];
        if (!last) { due += 1; break; }
        const elapsed = Math.round(
          (Date.parse(today + 'T12:00:00Z') - Date.parse(last + 'T12:00:00Z')) / 86400000,
        );
        if (elapsed >= (e.interval_days ?? 1)) due += 1;
        break;
      }
      case 'times_per_week': {
        if (doneToday > 0) break;
        const d = new Date(today + 'T12:00:00Z');
        const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
        const weekStart = new Date(d.getTime() - dow * 86400000).toISOString().slice(0, 10);
        const thisWeek = new Set(dates.filter((x) => x >= weekStart && x <= today));
        if (thisWeek.size < (e.weekly_target_min ?? 1)) due += 1;
        break;
      }
      // 'as_needed' is never owed.
    }
  }
  return due;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({}, 204);
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const db = admin();
  let body: { action?: string } = {};
  try {
    body = await req.json();
  } catch {
    // an empty body is fine for the cron call
  }
  const action = body.action ?? 'remind';

  if (action === 'init') {
    // Must be a signed-in user; the anon key alone is not enough.
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
    const { data: userData } = await db.auth.getUser(token);
    if (!userData?.user) return json({ error: 'sign-in required' }, 401);
    const { publicKey } = await ensureKeys(db);
    return json({ publicKey });
  }

  if (action !== 'remind') return json({ error: 'unknown action' }, 400);

  // Cron path: require the shared secret.
  const expected = await getConfig(db, 'reminder_secret');
  const given = req.headers.get('x-reminder-secret') ?? '';
  if (!expected || given !== expected) return json({ error: 'forbidden' }, 403);

  const { publicKey, privateKey } = await ensureKeys(db);
  const subject = (await getConfig(db, 'vapid_subject')) ?? 'mailto:physio@example.com';
  webpush.setVapidDetails(subject, publicKey, privateKey);

  const { data: subs } = await db.from('physio_push_subscriptions').select('*');
  if (!subs?.length) return json({ sent: 0, reason: 'no subscriptions' });

  // Only fire in the user's local evening, so one daily cron serves every zone.
  const REMIND_HOUR = Number((await getConfig(db, 'reminder_hour')) ?? '19');

  let sent = 0;
  let skipped = 0;
  const failures: string[] = [];

  for (const sub of subs) {
    const tz = sub.timezone || 'America/Toronto';
    if (localHour(tz) !== REMIND_HOUR) { skipped++; continue; }

    const today = localDate(tz);
    // Don't nudge twice in one local day.
    if (sub.last_sent_at && localDate(tz, new Date(sub.last_sent_at)) === today) {
      skipped++;
      continue;
    }

    const { data: exercises } = await db
      .from('physio_exercises')
      .select('id, frequency, sessions_per_day, interval_days, weekly_target_min, is_active')
      .eq('user_id', sub.user_id);
    if (!exercises?.length) { skipped++; continue; }

    const since = new Date(Date.parse(today + 'T12:00:00Z') - 30 * 86400000)
      .toISOString()
      .slice(0, 10);
    const { data: logs } = await db
      .from('physio_logs')
      .select('exercise_id, completed_on')
      .eq('user_id', sub.user_id)
      .gte('completed_on', since);

    const byExercise = new Map<string, string[]>();
    for (const l of logs ?? []) {
      const list = byExercise.get(l.exercise_id) ?? [];
      list.push(l.completed_on);
      byExercise.set(l.exercise_id, list);
    }

    const loggedToday = (logs ?? []).some((l) => l.completed_on === today);
    const due = sessionsDueToday(exercises as Exercise[], byExercise, today);

    // Nothing outstanding, or they have already started today: stay quiet.
    if (due === 0 || loggedToday) { skipped++; continue; }

    const payload = JSON.stringify({
      title: 'Physio not done yet',
      body:
        due === 1
          ? '1 session still due today. It takes a couple of minutes.'
          : `${due} sessions still due today. It takes a couple of minutes.`,
      url: '/',
      tag: 'physio-daily-reminder',
    });

    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      );
      sent++;
      await db
        .from('physio_push_subscriptions')
        .update({ last_sent_at: new Date().toISOString(), failure_count: 0 })
        .eq('id', sub.id);
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        // The browser threw the subscription away; so do we.
        await db.from('physio_push_subscriptions').delete().eq('id', sub.id);
        failures.push(`${sub.id}: gone`);
      } else {
        const next = (sub.failure_count ?? 0) + 1;
        if (next >= 5) {
          await db.from('physio_push_subscriptions').delete().eq('id', sub.id);
          failures.push(`${sub.id}: retired after 5 failures`);
        } else {
          await db.from('physio_push_subscriptions').update({ failure_count: next }).eq('id', sub.id);
          failures.push(`${sub.id}: ${status ?? 'error'}`);
        }
      }
    }
  }

  return json({ sent, skipped, failures });
});
