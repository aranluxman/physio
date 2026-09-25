-- ============================================================================
--  Physio Tracker — complete Supabase schema
--  Run this whole file once in: Supabase Dashboard -> SQL Editor -> New query
--  It is idempotent: re-running it is safe.
--
--  The SQL Editor runs the whole file as one transaction, so a single failing
--  statement rolls back everything and you end up with no tables at all. This
--  file therefore avoids anything that needs ownership of `auth.users`, which
--  the SQL Editor role does not have on current Supabase projects.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";  -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'physio_frequency_type') then
    create type public.physio_frequency_type as enum (
      'daily',          -- once every day
      'times_per_day',  -- N sessions every day (e.g. 3x/day)
      'every_n_days',   -- once every N days (e.g. every 2 days)
      'times_per_week', -- N-M sessions per week, day is flexible (e.g. 2x/week)
      'as_needed'       -- no schedule; done when wanted (e.g. stretches after track)
    );
  else
    -- Added later than the rest of the enum; safe to re-run.
    alter type public.physio_frequency_type add value if not exists 'as_needed';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 2. exercises — the prescribed regimen
-- ---------------------------------------------------------------------------
create table if not exists public.physio_exercises (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,

  name              text not null,
  category          text not null default 'General',       -- Hip Mobility, Hip Strength, ...
  description       text,                                   -- how to perform / cues

  -- scheduling rules
  frequency         public.physio_frequency_type not null,
  sessions_per_day  smallint not null default 1,            -- used by daily / times_per_day
  interval_days     smallint,                               -- used by every_n_days
  weekly_target_min smallint,                               -- used by times_per_week
  weekly_target_max smallint,                               -- used by times_per_week

  -- dosage
  target_sets       smallint,
  target_reps       smallint,
  hold_seconds      smallint,                               -- for static stretches
  load_lbs          numeric(5,1),                           -- external load, if any

  is_active         boolean not null default true,
  display_order     smallint not null default 0,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint physio_exercises_sessions_per_day_ck  check (sessions_per_day between 1 and 12),
  constraint physio_exercises_interval_days_ck     check (interval_days is null or interval_days between 1 and 30),
  constraint physio_exercises_weekly_target_ck     check (
    weekly_target_min is null
    or weekly_target_max is null
    or weekly_target_max >= weekly_target_min
  ),
  -- each frequency type must carry the fields it needs
  constraint physio_exercises_frequency_shape_ck check (
    (frequency = 'daily'          and sessions_per_day = 1)
    or (frequency = 'times_per_day'  and sessions_per_day >= 1)
    or (frequency = 'every_n_days'   and interval_days is not null)
    or (frequency = 'times_per_week' and weekly_target_min is not null)
    or (frequency = 'as_needed'      and sessions_per_day >= 1)
  ),
  -- one row per exercise name per user
  constraint physio_exercises_user_name_uk unique (user_id, name)
);

create index if not exists physio_exercises_user_active_idx
  on public.physio_exercises (user_id, is_active, display_order);

-- ---------------------------------------------------------------------------
-- 3. logs — one row per completed session
-- ---------------------------------------------------------------------------
create table if not exists public.physio_logs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  exercise_id    uuid not null references public.physio_exercises (id) on delete cascade,

  -- the calendar day the session belongs to, in the user's own local time.
  -- The client sends this, so a late-night session is never bumped to
  -- "tomorrow" by UTC.
  completed_on   date not null default (now() at time zone 'utc')::date,
  completed_at   timestamptz not null default now(),

  -- which session of the day this is (0-based). Always 0 for once-a-day
  -- exercises; 0..2 for a 3x/day exercise.
  session_index  smallint not null default 0,

  pain_level     smallint,          -- 0 = no pain ... 10 = worst
  notes          text,

  created_at     timestamptz not null default now(),

  constraint physio_logs_pain_level_ck     check (pain_level is null or pain_level between 0 and 10),
  constraint physio_logs_session_index_ck  check (session_index between 0 and 11),
  -- ticking the same session twice is a no-op, not a duplicate row
  constraint physio_logs_unique_session_uk unique (exercise_id, completed_on, session_index)
);

create index if not exists physio_logs_user_date_idx     on public.physio_logs (user_id, completed_on desc);
create index if not exists physio_logs_exercise_date_idx on public.physio_logs (exercise_id, completed_on desc);

-- ---------------------------------------------------------------------------
-- 4. appointments — next physio visit
-- ---------------------------------------------------------------------------
create table if not exists public.physio_appointments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  title        text not null default 'Physiotherapy appointment',
  scheduled_at timestamptz not null,
  -- The clinic's timezone. `scheduled_at` is an absolute instant; this is what
  -- the app formats it in, so the card reads "5:30 PM" wherever you open it.
  timezone     text not null default 'America/Toronto',
  location     text,
  notes        text,
  created_at   timestamptz not null default now()
);

alter table public.physio_appointments
  add column if not exists timezone text not null default 'America/Toronto';

create index if not exists physio_appointments_user_time_idx
  on public.physio_appointments (user_id, scheduled_at);

-- ---------------------------------------------------------------------------
-- 5. therapist_notes — key takeaways from each session
-- ---------------------------------------------------------------------------
create table if not exists public.physio_therapist_notes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  body          text not null,
  category      text not null default 'General',  -- Focus, Status, Technique, ...
  is_pinned     boolean not null default false,
  noted_on      date not null default (now() at time zone 'utc')::date,
  display_order smallint not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists physio_therapist_notes_user_idx
  on public.physio_therapist_notes (user_id, is_pinned desc, display_order);

-- ---------------------------------------------------------------------------
-- 6. updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.physio_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists physio_exercises_set_updated_at on public.physio_exercises;
create trigger physio_exercises_set_updated_at
  before update on public.physio_exercises
  for each row execute function public.physio_set_updated_at();

-- ---------------------------------------------------------------------------
-- 7. Row Level Security — every row is private to its owner
-- ---------------------------------------------------------------------------
alter table public.physio_exercises      enable row level security;
alter table public.physio_logs           enable row level security;
alter table public.physio_appointments   enable row level security;
alter table public.physio_therapist_notes enable row level security;

-- exercises
drop policy if exists "physio_exercises_select_own" on public.physio_exercises;
create policy "physio_exercises_select_own" on public.physio_exercises
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "physio_exercises_insert_own" on public.physio_exercises;
create policy "physio_exercises_insert_own" on public.physio_exercises
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "physio_exercises_update_own" on public.physio_exercises;
create policy "physio_exercises_update_own" on public.physio_exercises
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "physio_exercises_delete_own" on public.physio_exercises;
create policy "physio_exercises_delete_own" on public.physio_exercises
  for delete to authenticated using (auth.uid() = user_id);

-- logs (insert also verifies the exercise being logged belongs to you)
drop policy if exists "physio_logs_select_own" on public.physio_logs;
create policy "physio_logs_select_own" on public.physio_logs
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "physio_logs_insert_own" on public.physio_logs;
create policy "physio_logs_insert_own" on public.physio_logs
  for insert to authenticated with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.physio_exercises e
      where e.id = exercise_id and e.user_id = auth.uid()
    )
  );

drop policy if exists "physio_logs_update_own" on public.physio_logs;
create policy "physio_logs_update_own" on public.physio_logs
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "physio_logs_delete_own" on public.physio_logs;
create policy "physio_logs_delete_own" on public.physio_logs
  for delete to authenticated using (auth.uid() = user_id);

-- appointments
drop policy if exists "physio_appointments_all_own" on public.physio_appointments;
create policy "physio_appointments_all_own" on public.physio_appointments
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- therapist_notes
drop policy if exists "physio_therapist_notes_all_own" on public.physio_therapist_notes;
create policy "physio_therapist_notes_all_own" on public.physio_therapist_notes
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 7b. Table privileges.
--     Supabase normally grants these to anon/authenticated automatically via
--     default privileges, but a project whose defaults have been changed would
--     give "permission denied for table exercises" even with the policies
--     above in place. Granting explicitly makes this file self-sufficient.
--     RLS still decides which *rows* each user can touch.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on
  public.physio_exercises,
  public.physio_logs,
  public.physio_appointments,
  public.physio_therapist_notes
to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Seed function — loads the prescribed regimen for one user
--     SECURITY DEFINER so it can run from the client via rpc('seed_my_regimen')
--     and from the auth.users signup trigger. It only ever writes rows owned by
--     the uuid it is given, and it never overwrites data that already exists.
-- ---------------------------------------------------------------------------
create or replace function public.physio_seed_default_regimen(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- ---- Exercises -----------------------------------------------------------
  insert into public.physio_exercises
    (user_id, name, category, description, frequency, sessions_per_day,
     interval_days, weekly_target_min, weekly_target_max,
     target_sets, target_reps, hold_seconds, load_lbs, display_order)
  values
    (p_user_id, 'Hip CAR', 'Hip Mobility',
     'Controlled Articular Rotation. Move the hip slowly through its full circle, keeping the rest of the body still. Do it before practice or training.',
     'daily', 1, null, null, null, 3, 8, null, null, 10),

    (p_user_id, 'Hip 90:90 Rotations', 'Hip Mobility',
     'Seated 90/90. Rotate both knees side to side under control, sitting tall. Especially before practice or training.',
     'times_per_day', 3, null, null, null, 1, 10, null, null, 20),

    (p_user_id, 'Single Leg Squat', 'Hip Strength',
     'Single leg squat holding 10 lb. Control the descent and keep the knee tracking over the mid-foot.',
     'times_per_week', 1, null, 2, 2, 4, 8, null, 10.0, 30),

    (p_user_id, 'Single Leg RDL', 'Hip Strength',
     'Single leg Romanian deadlift with 10 lb, both sides. Hinge from the hip with a flat back, hips square.',
     'times_per_week', 1, null, 2, 2, 4, 8, null, 10.0, 40),

    (p_user_id, 'Lateral Step Down with Band', 'Hip Strength',
     'Lateral step down against a band. Control the descent, keep the knee tracking over the mid-foot.',
     'times_per_week', 1, null, 2, 2, 4, 8, null, null, 50),

    (p_user_id, 'Hip Internal Rotation with Block', 'Hip Strength',
     'Hip internal rotation against a block. Targets the internal rotators — the weakness identified on 22 Sep and a common contributor to groin strain.',
     'times_per_week', 1, null, 2, 2, 4, 6, null, null, 60),

    (p_user_id, 'Dead Bug', 'Core / Hip Flexors',
     'Targeted core and hip flexor work. Keep the low back flat on the floor throughout.',
     'every_n_days', 1, 2, null, null, 3, 14, null, null, 70),

    (p_user_id, 'Kneeling Hip Flexor Stretch', 'Mobility / Stretch',
     'Half-kneeling. Tuck the pelvis, squeeze the glute, drive gently forward. 30-second hold each side. As needed, and after a track session.',
     'as_needed', 1, null, null, null, 1, null, 30, null, 80),

    (p_user_id, 'Hip Adductor Stretch', 'Mobility / Stretch',
     'Groin stretch, 30-second hold each side. As needed, and after a track session.',
     'as_needed', 1, null, null, null, 1, null, 30, null, 90),

    (p_user_id, 'Hamstring Stretch', 'Mobility / Stretch',
     'Long-leg hamstring stretch, 30-second hold each side. As needed, and after a track session.',
     'as_needed', 1, null, null, null, 1, null, 30, null, 100)
  on conflict (user_id, name) do nothing;

  -- No appointment is seeded. Roland's 22 Sep summary says a discharge
  -- session is coming but gives no date, and a clinical date must not be
  -- invented. Add the real one to physio_appointments when it is known.

  -- ---- Therapist notes -----------------------------------------------------
  insert into public.physio_therapist_notes (user_id, body, category, is_pinned, display_order)
  select p_user_id, v.body, v.category, v.is_pinned, v.display_order
  from (values
    ('Progressing very well — no pain with testing or exercises, and strength is improving.', 'Status', true, 10),
    ('Hip internal rotators are an area of weakness, a common contributor to groin strain. The block exercise targets this.', 'Focus', true, 20),
    ('Hip mobility — Hip CAR and 90:90 — every day, especially before practice or training.', 'Technique', false, 30),
    ('Strength work twice a week: single leg squat, single leg RDL, banded lateral step down, internal rotation with block.', 'Technique', false, 40),
    ('Dead bug every other day. Hip stretches as needed and after a track session.', 'Technique', false, 50),
    ('Discharge session next: Roland will cover how to progress the exercises independently. Email him if anything flares up before then.', 'Status', false, 60)
  ) as v(body, category, is_pinned, display_order)
  where not exists (
    select 1 from public.physio_therapist_notes n where n.user_id = p_user_id
  );
end;
$$;

-- This one takes an arbitrary user id and runs as its owner, so it must never be
-- callable over the API. `revoke ... from public` alone is not enough: Supabase's
-- default privileges grant EXECUTE to anon and authenticated on new functions, and
-- those grants survive a revoke aimed only at PUBLIC.
revoke all on function public.physio_seed_default_regimen(uuid) from public;
revoke all on function public.physio_seed_default_regimen(uuid) from anon, authenticated;

-- Client-callable wrapper: seeds the *calling* user only.
create or replace function public.physio_seed_my_regimen()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'seed_my_regimen() must be called by an authenticated user';
  end if;
  perform public.physio_seed_default_regimen(auth.uid());
end;
$$;

revoke all on function public.physio_seed_my_regimen() from public, anon;
grant execute on function public.physio_seed_my_regimen() to authenticated;

-- ---------------------------------------------------------------------------
-- 9. OPTIONAL: auto-seed every new signup.
--
--    Leave this commented out unless this Supabase project is dedicated to the
--    physio app. Two reasons:
--
--    a) On a project shared with another app, every signup to that other app
--       would also get a physio regimen created for it.
--    b) A trigger named `on_auth_user_created` calling `public.handle_new_user()`
--       is the naming used by Supabase's own profiles tutorial. If the other app
--       followed it, `create or replace` here would silently replace that app's
--       signup hook and break its profile creation. The names below are
--       suffixed with `_physio` so they can coexist, but (a) still applies.
--
--    You do not need this either way: signing in to an empty account shows a
--    "Load my regimen" button that calls seed_my_regimen().
-- ---------------------------------------------------------------------------
-- create or replace function public.handle_new_user_physio()
-- returns trigger
-- language plpgsql
-- security definer
-- set search_path = public
-- as $$
-- begin
--   perform public.physio_seed_default_regimen(new.id);
--   return new;
-- end;
-- $$;
--
-- drop trigger if exists on_auth_user_created_physio on auth.users;
-- create trigger on_auth_user_created_physio
--   after insert on auth.users
--   for each row execute function public.handle_new_user_physio();

-- ---------------------------------------------------------------------------
-- 10. Seed your own account.
--     Safe to run before you have signed up — it just prints a notice and does
--     nothing. Re-run it after signing up, or skip it entirely and tap
--     "Load my regimen" in the app.
--
--     Only ever touches the one account named here, never every user in the
--     project.
-- ---------------------------------------------------------------------------
do $$
declare
  -- vvv change this to the email you sign in with vvv
  target_email constant text := 'luxman.satchi@gmail.com';
  target_id    uuid;
begin
  select id into target_id from auth.users where email = target_email;

  if target_id is null then
    raise notice 'No account for % yet. Sign up in the app first, then either re-run this block or tap "Load my regimen".', target_email;
  else
    perform public.physio_seed_default_regimen(target_id);
    raise notice 'Seeded the physio regimen for %.', target_email;
  end if;
exception
  -- Nothing in this block is essential, and the SQL Editor runs the file as a
  -- single transaction, so any error here would roll back every table above
  -- it. Two known cases: no SELECT on auth.users, and Postgres refusing to use
  -- an enum value that was added earlier in this same transaction. Report and
  -- carry on; the "Load my regimen" button seeds the account either way.
  when others then
    raise notice 'Skipped seeding % (%). Use the "Load my regimen" button in the app instead.',
      target_email, sqlerrm;
end
$$;

-- ---------------------------------------------------------------------------
-- 11. Tell PostgREST about the new tables and functions straight away, instead
--     of waiting for it to notice. Without this, the app can briefly get
--     "Could not find the function public.physio_seed_my_regimen in the schema cache".
-- ---------------------------------------------------------------------------
notify pgrst, 'reload schema';
