const { buildDailyPlan, scheduleLabel, dosageLabel } = require('../.test-build/schedule');

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

const car   = { ...base, id: 'car',  name: 'Hip CAR',   frequency: 'daily', target_sets: 3, target_reps: 8, display_order: 10 };
const nn    = { ...base, id: 'nn',   name: '90:90',     frequency: 'times_per_day', sessions_per_day: 3, target_reps: 10, display_order: 20 };
const dead  = { ...base, id: 'dead', name: 'Dead Bug',  frequency: 'every_n_days', interval_days: 2, target_sets: 3, target_reps: 6, display_order: 60 };
const kb    = { ...base, id: 'kb',   name: 'KB Hold',   frequency: 'times_per_week', weekly_target_min: 2, weekly_target_max: 3, load_lbs: 30, display_order: 70 };
const all = [car, nn, dead, kb];

const log = (ex, on, idx = 0) => ({ id: `${ex}-${on}-${idx}`, user_id: 'u', exercise_id: ex,
  completed_on: on, completed_at: on + 'T12:00:00Z', session_index: idx, pain_level: null, notes: null });

const pick = (plan, id) => plan.items.find((i) => i.exercise.id === id);

// Wednesday 2026-08-19 (week starts Mon 2026-08-17)
const TODAY = '2026-08-19';

console.log('\nlabels');
eq(scheduleLabel(car), 'Daily', 'daily label');
eq(scheduleLabel(nn), '3x per day', 'times per day label');
eq(scheduleLabel(dead), 'Every 2 days', 'every 2 days label');
eq(scheduleLabel(kb), '2-3x per week', 'weekly range label');
eq(dosageLabel(car), '3 sets · 8 reps', 'dosage sets/reps');
eq(dosageLabel(kb), '30 lbs', 'dosage load');

console.log('\nfresh day, nothing logged');
{
  const p = buildDailyPlan(all, [], TODAY);
  eq(pick(p, 'car').requiredSessions, 1, 'daily needs 1 session');
  eq(pick(p, 'nn').requiredSessions, 3, '3x/day needs 3 sessions');
  eq(pick(p, 'dead').status, 'due', 'never-logged every-2-days is due');
  eq(pick(p, 'kb').status, 'due', 'weekly with 0 done is due');
  eq(p.totalRequired, 1 + 3 + 1 + 1, 'total required sessions');
  eq(p.percent, 0, '0% at start of day');
}

console.log('\npartial 3x/day');
{
  const p = buildDailyPlan([nn], [log('nn', TODAY, 0)], TODAY);
  eq(pick(p, 'nn').completedSessions, 1, '1 of 3 logged');
  eq(pick(p, 'nn').status, 'due', 'still due after 1 of 3');
  eq(p.percent, 33, '33% after 1 of 3');
}
{
  const p = buildDailyPlan([nn], [log('nn', TODAY, 0), log('nn', TODAY, 1), log('nn', TODAY, 2)], TODAY);
  eq(pick(p, 'nn').status, 'done', 'done after 3 of 3');
  eq(p.percent, 100, '100% after all sessions');
}

console.log('\nevery 2 days');
{
  eq(pick(buildDailyPlan([dead], [log('dead', TODAY)], TODAY), 'dead').status, 'done', 'done when logged today');
  eq(pick(buildDailyPlan([dead], [log('dead', '2026-08-18')], TODAY), 'dead').status, 'resting', 'resting 1 day after');
  eq(pick(buildDailyPlan([dead], [log('dead', '2026-08-17')], TODAY), 'dead').status, 'due', 'due 2 days after');
  const overdue = pick(buildDailyPlan([dead], [log('dead', '2026-08-14')], TODAY), 'dead');
  eq(overdue.status, 'due', 'due 5 days after');
  eq(overdue.urgent, true, 'overdue is flagged urgent');
  eq(pick(buildDailyPlan([dead], [log('dead', '2026-08-18')], TODAY), 'dead').requiredSessions, 0, 'rest day adds nothing to the target');
}

console.log('\n2-3x per week (week = Mon 17 .. Sun 23)');
{
  const p = buildDailyPlan([kb], [log('kb', '2026-08-17')], TODAY);
  eq(pick(p, 'kb').status, 'due', 'still due at 1 of 2');
  eq(pick(p, 'kb').weekly, { done: 1, min: 2, max: 3, daysLeftInWeek: 5 }, 'weekly counters');
  eq(pick(p, 'kb').urgent, false, 'not urgent with 5 days left');
}
{
  const p = buildDailyPlan([kb], [log('kb', '2026-08-17'), log('kb', '2026-08-18')], TODAY);
  eq(pick(p, 'kb').status, 'optional', 'minimum met -> optional');
  eq(pick(p, 'kb').requiredSessions, 0, 'optional does not add to the daily target');
}
{
  const p = buildDailyPlan([kb], [log('kb', '2026-08-17'), log('kb', '2026-08-18'), log('kb', '2026-08-19')], TODAY);
  eq(pick(p, 'kb').status, 'done', 'logged today reads as done');
}
{
  // Sunday 2026-08-23 with nothing done: 2 owed, 1 day left -> unskippable
  const p = buildDailyPlan([kb], [], '2026-08-23');
  eq(pick(p, 'kb').urgent, true, 'urgent on the last day of the week');
  eq(pick(p, 'kb').weekly.daysLeftInWeek, 1, 'one day left on Sunday');
}
{
  // last week's sessions must not count toward this week
  const p = buildDailyPlan([kb], [log('kb', '2026-08-15'), log('kb', '2026-08-16')], TODAY);
  eq(pick(p, 'kb').weekly.done, 0, 'previous week does not leak in');
}

console.log('\nas needed (stretches, after a track session)');
{
  const stretch = { ...base, id:'st', name:'Hamstring Stretch', frequency:'as_needed', hold_seconds:30, display_order:80 };
  eq(scheduleLabel(stretch), 'As needed', 'as-needed label');
  const p = buildDailyPlan([stretch], [], TODAY);
  eq(pick(p, 'st').status, 'optional', 'never due, always available');
  eq(pick(p, 'st').requiredSessions, 0, 'adds nothing to the daily target');
  eq(p.totalRequired, 0, 'a day of only as-needed work is a rest day');
  eq(p.percent, 100, 'and reads as complete rather than 0%');
  const done = buildDailyPlan([stretch], [log('st', TODAY)], TODAY);
  eq(pick(done, 'st').status, 'done', 'logging one marks it done');
  const twice = buildDailyPlan([stretch], [log('st', TODAY, 0), log('st', TODAY, 1)], TODAY);
  eq(pick(twice, 'st').statusLabel, 'Done 2 times today', 'counts repeats');
}
{
  // Mixed day: the daily exercise still drives the progress bar.
  const stretch = { ...base, id:'st', name:'Stretch', frequency:'as_needed', display_order:80 };
  const p = buildDailyPlan([car, stretch], [], TODAY);
  eq(p.totalRequired, 1, 'as-needed does not inflate the denominator');
}

console.log('\nunknown frequency must not crash the page');
{
  const weird = { ...base, id:'wx', name:'Mystery', frequency:'someday_maybe', display_order:5 };
  const p = buildDailyPlan([weird], [], TODAY);
  eq(p.items.length, 1, 'still produces a plan item');
  eq(pick(p, 'wx').status, 'optional', 'degrades to optional');
  eq(pick(p, 'wx').statusLabel, 'No schedule set', 'and says so plainly');
  eq(scheduleLabel(weird), 'Unscheduled', 'label does not render undefined');
}

console.log('\nordering + rest day');
{
  const p = buildDailyPlan(all, [log('dead', '2026-08-18')], TODAY);
  eq(p.items.map((i) => i.exercise.id), ['car', 'nn', 'kb', 'dead'], 'due first, resting last');
  eq(p.totalRequired, 5, 'resting dead bug excluded from target');
}
{
  const inactive = [{ ...car, is_active: false }];
  eq(buildDailyPlan(inactive, [], TODAY).items.length, 0, 'inactive exercises hidden');
  eq(buildDailyPlan(inactive, [], TODAY).percent, 100, 'empty plan is 100%');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
