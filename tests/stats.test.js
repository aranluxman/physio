const { profileStats, currentStreak, longestStreak } = require('../.test-build/stats');

let pass = 0, fail = 0;
function eq(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass++; console.log('  ok  ', label); }
  else { fail++; console.log('  FAIL', label, '| got', JSON.stringify(actual), 'want', JSON.stringify(expected)); }
}

const base = { user_id: 'u', category: 'c', description: null, sessions_per_day: 1,
  interval_days: null, weekly_target_min: null, weekly_target_max: null,
  target_sets: null, target_reps: null, hold_seconds: null, load_lbs: null,
  is_active: true, display_order: 0 };

const car  = { ...base, id: 'car',  name: 'Hip CAR',  frequency: 'daily', display_order: 10 };
const dead = { ...base, id: 'dead', name: 'Dead Bug', frequency: 'every_n_days', interval_days: 2, display_order: 60 };

const log = (ex, on, idx = 0) => ({ id: `${ex}-${on}-${idx}`, user_id: 'u', exercise_id: ex,
  completed_on: on, completed_at: on + 'T12:00:00Z', session_index: idx, pain_level: null, notes: null });

const TODAY = '2026-08-21'; // Friday
const d = (n) => { const x = new Date(2026, 7, 21); x.setDate(x.getDate() + n); return x.toLocaleDateString('en-CA'); };

console.log('\nstreaks with a single daily exercise');
{
  // completed today and the three days before
  const logs = [0,-1,-2,-3].map(n => log('car', d(n)));
  eq(currentStreak([car], logs, TODAY), 4, '4 consecutive complete days');
  eq(longestStreak([car], logs, TODAY), 4, 'longest matches current');
}
{
  // missed today, but the three before are done -> today must not zero it
  const logs = [-1,-2,-3].map(n => log('car', d(n)));
  eq(currentStreak([car], logs, TODAY), 3, 'unfinished today does not break the streak');
}
{
  // a gap two days back
  const logs = [0,-1,-3,-4].map(n => log('car', d(n)));
  eq(currentStreak([car], logs, TODAY), 2, 'streak stops at the gap');
  eq(longestStreak([car], logs, TODAY), 2, 'longest is the best of the two runs');
}
{
  const logs = [0,-1,-2,-3,-4,-5,-7,-8].map(n => log('car', d(n)));
  eq(currentStreak([car], logs, TODAY), 6, 'current run of 6');
  eq(longestStreak([car], logs, TODAY), 6, 'longest run of 6');
}
eq(currentStreak([car], [], TODAY), 0, 'no logs, no streak');
eq(longestStreak([], [], TODAY), 0, 'no exercises, no streak');

console.log('\nrest days are stepped over, not counted');
{
  // Dead Bug alone: due every 2 days. Logging it on its due days should give a
  // streak that counts only the scheduled days, uninterrupted by the off-days.
  const logs = [0,-2,-4,-6].map(n => log('dead', d(n)));
  eq(currentStreak([dead], logs, TODAY), 4, 'every-2-days kept perfectly = 4');
  eq(longestStreak([dead], logs, TODAY), 4, 'longest also 4');
}
{
  // skipping one due day breaks it
  const logs = [0,-2,-6,-8].map(n => log('dead', d(n)));
  eq(currentStreak([dead], logs, TODAY), 2, 'missed due day ends the run');
}

console.log('\naggregate stats');
{
  const logs = [
    { ...log('car', d(0)), pain_level: 2 },
    { ...log('car', d(-1)), pain_level: 4 },
    { ...log('car', d(-2)) },
    { ...log('dead', d(-2), 0) },
  ];
  const s = profileStats([car, dead], logs, TODAY);
  eq(s.totalSessions, 4, 'total sessions counts every log row');
  eq(s.activeDays, 3, 'active days counts distinct dates');
  eq(s.averagePain, 3, 'average pain ignores sessions with none recorded');
}
{
  const s = profileStats([car], [], TODAY);
  eq(s.averagePain, null, 'no pain entries -> null, not NaN');
  eq(s.totalSessions, 0, 'zero sessions');
  eq(s.activeDays, 0, 'zero active days');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
