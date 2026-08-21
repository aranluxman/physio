\set ON_ERROR_STOP on
\pset pager off

-- Two users signing up; the auth.users trigger should seed each of them.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'aran@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'someone-else@example.com');

\echo '== seeded rows per user =='
select u.email,
       (select count(*) from public.exercises e where e.user_id = u.id)       as exercises,
       (select count(*) from public.appointments a where a.user_id = u.id)    as appointments,
       (select count(*) from public.therapist_notes n where n.user_id = u.id) as notes
from auth.users u order by u.email;

\echo '== the regimen, as seeded =='
select name, frequency, sessions_per_day, interval_days,
       weekly_target_min, weekly_target_max, target_sets, target_reps, hold_seconds, load_lbs
from public.exercises
where user_id = '11111111-1111-1111-1111-111111111111'
order by display_order;

\echo '== appointment instant (rendered in Toronto local time) =='
select title, scheduled_at at time zone 'America/Toronto' as local_time, scheduled_at as utc_instant
from public.appointments where user_id = '11111111-1111-1111-1111-111111111111';

\echo '== re-seeding is a no-op (no duplicates) =='
select public.seed_default_regimen('11111111-1111-1111-1111-111111111111');
select count(*) as exercises_after_second_seed from public.exercises
where user_id = '11111111-1111-1111-1111-111111111111';

-- ---------------------------------------------------------------- RLS checks
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

\echo '== user 1 sees only their own exercises =='
select count(*) as visible_exercises from public.exercises;

\echo '== user 1 logs a session =='
insert into public.logs (user_id, exercise_id, completed_on, session_index, pain_level)
select '11111111-1111-1111-1111-111111111111', id, current_date, 0, 2
from public.exercises where name = 'Hip CAR';
select count(*) as own_logs from public.logs;

\echo '== duplicate tick of the same session is rejected by the unique key =='
do $$
begin
  insert into public.logs (user_id, exercise_id, completed_on, session_index)
  select '11111111-1111-1111-1111-111111111111', id, current_date, 0
  from public.exercises where name = 'Hip CAR';
  raise exception 'FAIL: duplicate session was accepted';
exception when unique_violation then
  raise notice 'PASS: duplicate session rejected';
end $$;

\echo '== user 1 cannot write a row owned by user 2 =='
do $$
begin
  insert into public.logs (user_id, exercise_id, completed_on, session_index)
  select '22222222-2222-2222-2222-222222222222', id, current_date, 5
  from public.exercises where name = 'Hip CAR';
  raise exception 'FAIL: cross-user insert was accepted';
exception when insufficient_privilege then
  raise notice 'PASS: cross-user insert blocked by RLS';
end $$;

\echo '== user 1 cannot log against user 2s exercise =='
reset role;
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
\echo '-- now acting as user 2 --'
select count(*) as user2_visible_exercises from public.exercises;
select count(*) as user2_visible_logs from public.logs;
select count(*) as user2_visible_notes from public.therapist_notes;

\echo '== pain level range is enforced =='
do $$
begin
  insert into public.logs (user_id, exercise_id, completed_on, session_index, pain_level)
  select '22222222-2222-2222-2222-222222222222', id, current_date, 0, 42
  from public.exercises where user_id = '22222222-2222-2222-2222-222222222222' and name = 'Hip CAR';
  raise exception 'FAIL: pain level 42 was accepted';
exception when check_violation then
  raise notice 'PASS: out-of-range pain level rejected';
end $$;

\echo '== seed_my_regimen() seeds the caller =='
select public.seed_my_regimen();
select count(*) as user2_exercises_after_rpc from public.exercises;

reset role;
\echo '== anon sees nothing =='
set role anon;
select count(*) as anon_visible_exercises from public.exercises;
select count(*) as anon_visible_logs from public.logs;
reset role;
