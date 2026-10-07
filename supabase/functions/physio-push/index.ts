/**
 * physio-push — Web Push for the physio tracker.
 *
 *   init    Ensure a VAPID keypair exists and return the public half. The
 *           private key is generated here and written straight to
 *           physio_server_config — never in the repo, never in a build.
 *           Auth: a signed-in user token.
 *
 *   remind  Hourly cron target, with two independent nudges:
 *             daily  — at reminder_hour local, when the day still owes
 *                      sessions and nothing has been logged.
 *             weekly — on weekly_reminder_dow at weekly_reminder_hour local
 *                      (Friday 18:00 by default), naming any 2x/week
 *                      exercise still short for the Mon–Sun week, while the
 *                      weekend is still there to fix it.
 *           Auth: a 32-byte shared secret generated inside the database.
 *
 * Platform JWT verification is off: both paths authenticate themselves, and
 * the cron caller has no user JWT to present.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const admin = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

// supabase-js always sends x-client-info alongside authorization and apikey;
// a preflight that does not allow it is rejected and the browser reports
// "Failed to send a request to the Edge Function".
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type, x-reminder-secret',
  'access-control-allow-methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...CORS },
  });

async function getConfig(db: any, key: string): Promise<string | null> {
  const { data } = await db.from('physio_server_config').select('value').eq('key', key).maybeSingle();
  return data?.value ?? null;
}

async function setConfig(db: any, key: string, value: string) {
  await db.from('physio_server_config').upsert({ key, value }, { onConflict: 'key' });
}

async function ensureKeys(db: any) {
  let pub = await getConfig(db, 'vapid_public_key');
  let priv = await getConfig(db, 'vapid_private_key');
  if (!pub || !priv) {
    const keys = webpush.generateVAPIDKeys();
    pub = keys.publicKey;
    priv = keys.privateKey;
    await setConfig(db, 'vapid_public_key', pub);
    await setConfig(db, 'vapid_private_key', priv);
    if (!(await getConfig(db, 'vapid_subject'))) {
      await setConfig(db, 'vapid_subject', 'mailto:physio@example.com');
    }
  }
  return { publicKey: pub as string, privateKey: priv as string };
}

function localDate(tz: string, now = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(now);
  } catch { return new Intl.DateTimeFormat('en-CA').format(now); }
}

function localHour(tz: string, now = new Date()): number {
  try {
    return Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hour12: false }).format(now));
  } catch { return now.getUTCHours(); }
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
function localWeekday(tz: string, now = new Date()): number {
  const fallback = ((now.getUTCDay() + 6) % 7) + 1;
  try {
    const name = new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short' }).format(now).slice(0, 3);
    const i = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(name);
    return i >= 0 ? i + 1 : fallback;
  } catch { return fallback; }
}

interface Exercise {
  id: string;
  name: string;
  frequency: string;
  sessions_per_day: number;
  interval_days: number | null;
  weekly_target_min: number | null;
  is_active: boolean;
}

/** Monday of the week containing `today`. */
function weekStart(today: string): string {
  const d = new Date(today + 'T12:00:00Z');
  return new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86400000).toISOString().slice(0, 10);
}

/** Mirrors src/lib/schedule.ts, reduced to "is anything still owed today". */
function sessionsDueToday(exercises: Exercise[], dates: Map<string, string[]>, today: string): number {
  let due = 0;
  for (const e of exercises) {
    if (!e.is_active) continue;
    const d = dates.get(e.id) ?? [];
    const doneToday = d.filter((x) => x === today).length;
    switch (e.frequency) {
      case 'daily': due += Math.max(0, 1 - doneToday); break;
      case 'times_per_day': due += Math.max(0, (e.sessions_per_day || 1) - doneToday); break;
      case 'every_n_days': {
        if (doneToday > 0) break;
        const past = d.filter((x) => x <= today).sort();
        const last = past[past.length - 1];
        if (!last) { due += 1; break; }
        const days = Math.round((Date.parse(today) - Date.parse(last)) / 86400000);
        if (days >= (e.interval_days ?? 1)) due += 1;
        break;
      }
      case 'times_per_week': {
        if (doneToday > 0) break;
        const ws = weekStart(today);
        if (new Set(d.filter((x) => x >= ws && x <= today)).size < (e.weekly_target_min ?? 1)) due += 1;
        break;
      }
      // 'as_needed' is never owed.
    }
  }
  return due;
}

/** Named 2x/week exercises still short for this week. */
function weeklyShortfall(exercises: Exercise[], dates: Map<string, string[]>, today: string) {
  const ws = weekStart(today);
  const short: { name: string; done: number; target: number }[] = [];
  for (const e of exercises) {
    if (!e.is_active || e.frequency !== 'times_per_week') continue;
    const target = e.weekly_target_min ?? 1;
    const done = new Set((dates.get(e.id) ?? []).filter((x) => x >= ws && x <= today)).size;
    if (done < target) short.push({ name: e.name, done, target });
  }
  return short;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const db = admin();
  let body: { action?: string; dryRun?: boolean } = {};
  try { body = await req.json(); } catch { /* empty body is fine for cron */ }
  const action = body.action ?? 'remind';

  if (action === 'init') {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
    const { data } = await db.auth.getUser(token);
    if (!data?.user) return json({ error: 'sign-in required' }, 401);
    return json({ publicKey: (await ensureKeys(db)).publicKey });
  }
  if (action !== 'remind') return json({ error: 'unknown action' }, 400);

  const expected = await getConfig(db, 'reminder_secret');
  if (!expected || (req.headers.get('x-reminder-secret') ?? '') !== expected) {
    return json({ error: 'forbidden' }, 403);
  }

  const { publicKey, privateKey } = await ensureKeys(db);
  webpush.setVapidDetails(
    (await getConfig(db, 'vapid_subject')) ?? 'mailto:physio@example.com', publicKey, privateKey);

  const { data: subs } = await db.from('physio_push_subscriptions').select('*');
  if (!subs?.length) return json({ sent: 0, skipped: 0, reason: 'no subscriptions' });

  const DAILY_HOUR = Number((await getConfig(db, 'reminder_hour')) ?? '19');
  const WEEKLY_DOW = Number((await getConfig(db, 'weekly_reminder_dow')) ?? '5');
  const WEEKLY_HOUR = Number((await getConfig(db, 'weekly_reminder_hour')) ?? '18');

  let sent = 0, skipped = 0;
  const failures: string[] = [];
  const report: string[] = [];

  for (const sub of subs) {
    const tz = sub.timezone || 'America/Toronto';
    const hour = localHour(tz);
    const today = localDate(tz);
    const dailyWindow = body.dryRun || hour === DAILY_HOUR;
    const weeklyWindow = body.dryRun || (localWeekday(tz) === WEEKLY_DOW && hour === WEEKLY_HOUR);

    if (!dailyWindow && !weeklyWindow) {
      skipped++; report.push(`${sub.id}: outside both windows (local ${hour}:00)`); continue;
    }

    const { data: exercises } = await db
      .from('physio_exercises')
      .select('id, name, frequency, sessions_per_day, interval_days, weekly_target_min, is_active')
      .eq('user_id', sub.user_id);
    if (!exercises?.length) { skipped++; report.push(`${sub.id}: no exercises`); continue; }

    const since = new Date(Date.parse(today) - 30 * 86400000).toISOString().slice(0, 10);
    const { data: logs } = await db
      .from('physio_logs').select('exercise_id, completed_on')
      .eq('user_id', sub.user_id).gte('completed_on', since);

    const dates = new Map<string, string[]>();
    for (const l of logs ?? []) {
      const list = dates.get(l.exercise_id) ?? [];
      list.push(l.completed_on);
      dates.set(l.exercise_id, list);
    }

    // The weekly summary is the more useful of the two, so it wins the slot.
    let payload: string | null = null;
    let stamp: 'last_sent_at' | 'last_weekly_sent_at' = 'last_sent_at';

    const weeklyAlready =
      sub.last_weekly_sent_at && localDate(tz, new Date(sub.last_weekly_sent_at)) === today;

    if (weeklyWindow && !weeklyAlready) {
      const short = weeklyShortfall(exercises as Exercise[], dates, today);
      if (short.length) {
        payload = JSON.stringify({
          title: short.length === 1 ? '1 exercise short this week' : `${short.length} exercises short this week`,
          body: `${short.map((s) => s.name).join(', ')}. The weekend is still open.`,
          url: '/', tag: 'physio-weekly-reminder',
        });
        stamp = 'last_weekly_sent_at';
      }
    }

    if (!payload && dailyWindow) {
      const dailyAlready = sub.last_sent_at && localDate(tz, new Date(sub.last_sent_at)) === today;
      const loggedToday = (logs ?? []).some((l: any) => l.completed_on === today);
      const due = sessionsDueToday(exercises as Exercise[], dates, today);
      if (!dailyAlready && due > 0 && !loggedToday) {
        payload = JSON.stringify({
          title: 'Physio not done yet',
          body: due === 1
            ? '1 session still due today. It takes a couple of minutes.'
            : `${due} sessions still due today. It takes a couple of minutes.`,
          url: '/', tag: 'physio-daily-reminder',
        });
      }
    }

    if (!payload) { skipped++; report.push(`${sub.id}: nothing to say`); continue; }
    if (body.dryRun) { report.push(`${sub.id}: WOULD SEND ${stamp} ${payload}`); continue; }

    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
      sent++;
      await db.from('physio_push_subscriptions')
        .update({ [stamp]: new Date().toISOString(), failure_count: 0 }).eq('id', sub.id);
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
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

  return json({ sent, skipped, failures, report });
});
