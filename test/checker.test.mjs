// Copyright (c) 2026 Humza Arshad. MIT License (see LICENSE).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { checkContributions } from '../src/checker.mjs';
import { expectedDefaultPct, mergePlan, eligibilityDate } from '../src/plan.mjs';
import { federalHolidays, fifteenthBusinessDayOfNextMonth, businessDaysAfter, parseDate, iso } from '../src/dates.mjs';
import { catchUpLimit } from '../src/limits.mjs';
import { parseCsv } from '../src/csv.mjs';
import { cleanScenario, census, contributions, defaultRows, payDates } from './fixtures/build.mjs';

const run = ({ people, rows }, plan = {}, extra = {}) =>
  checkContributions({ censusCsv: census(people), contributionsCsv: contributions(rows), plan, ...extra });
const rules = (r) => r.findings.map(f => f.rule);
const fires = (rule, scenario, plan, extra) => {
  const r = run(scenario, plan, extra);
  assert.ok(rules(r).includes(rule), `${rule} should fire; got ${JSON.stringify(rules(r))}`);
  return r;
};
const silent = (rule, scenario, plan, extra) => {
  const r = run(scenario, plan, extra);
  assert.ok(!rules(r).includes(rule), `${rule} should stay silent; got ${JSON.stringify(r.findings.filter(f => f.rule === rule))}`);
  return r;
};
const clone = (s) => JSON.parse(JSON.stringify(s));

// ─── Baseline ────────────────────────────────────────────────────────────────

test('a clean scenario has zero findings', () => {
  const r = run(cleanScenario());
  assert.equal(r.valid, true);
  assert.deepEqual(r.findings, []);
  assert.equal(r.summary.employees_deferring, 3);
});

// ─── Dates and limits ────────────────────────────────────────────────────────

test('federal holidays for 2026, with Saturday July 4 observed on Friday', () => {
  const h = federalHolidays(2026);
  for (const d of ['2026-01-01', '2026-01-19', '2026-02-16', '2026-05-25', '2026-06-19', '2026-07-03', '2026-09-07', '2026-10-12', '2026-11-11', '2026-11-26', '2026-12-25']) assert.ok(h.has(d), d);
  assert.ok(!h.has('2026-07-04'));
});

test('15th business day of the following month skips weekends and holidays', () => {
  assert.equal(iso(fifteenthBusinessDayOfNextMonth(parseDate('2026-01-23'))), '2026-02-23');
});

test('business days count excludes weekends and holidays', () => {
  assert.equal(businessDaysAfter(parseDate('2026-07-02'), parseDate('2026-07-07')), 2); // Jul 3 holiday, weekend
});

test('catch-up limits by age for 2026', () => {
  assert.equal(catchUpLimit(2026, parseDate('1980-01-01')), 0);
  assert.equal(catchUpLimit(2026, parseDate('1975-06-01')), 8000);
  assert.equal(catchUpLimit(2026, parseDate('1964-06-01')), 11250);
  assert.equal(catchUpLimit(2026, parseDate('1960-06-01')), 8000);
});

test('default schedule: initial period runs to the end of the first full plan year', () => {
  const plan = mergePlan();
  assert.equal(expectedDefaultPct(parseDate('2026-01-01'), parseDate('2026-12-31'), plan), 3);
  assert.equal(expectedDefaultPct(parseDate('2026-01-01'), parseDate('2027-01-08'), plan), 4);
  assert.equal(expectedDefaultPct(parseDate('2026-03-06'), parseDate('2027-06-01'), plan), 3);
  assert.equal(expectedDefaultPct(parseDate('2026-03-06'), parseDate('2028-01-07'), plan), 4);
  assert.equal(expectedDefaultPct(parseDate('2020-01-01'), parseDate('2040-01-01'), plan), 10);
  const anniv = mergePlan({ auto_enroll: { escalation_basis: 'anniversary' } });
  assert.equal(expectedDefaultPct(parseDate('2026-03-06'), parseDate('2027-03-06'), anniv), 4);
});

test('eligibility date computed from hire date, age and entry rule', () => {
  const plan = mergePlan({ eligibility: { min_age: 21, service_days: 30, entry: 'first_of_month' } });
  assert.equal(iso(eligibilityDate({ hire_date: '2026-01-15', birth_date: '1990-01-01' }, plan)), '2026-03-01');
  assert.equal(iso(eligibilityDate({ hire_date: '2026-01-15', birth_date: '2006-06-10' }, plan)), '2027-07-01');
});

test('CSV parser handles quotes, commas and CRLF', () => {
  const p = parseCsv('a,b\r\n"x, ""y""",2\r\n');
  assert.equal(p.records[0].a, 'x, "y"');
});

// ─── Plan configuration ──────────────────────────────────────────────────────

test('PLAN-414A rules fire on out-of-range plan settings and stay silent when not subject', () => {
  fires('PLAN-414A-INITIAL', cleanScenario(), { auto_enroll: { initial_pct: 2 } });
  fires('PLAN-414A-MAX', cleanScenario(), { auto_enroll: { max_pct: 16 } });
  fires('PLAN-414A-STEP', cleanScenario(), { auto_enroll: { step_pct: 2 } });
  silent('PLAN-414A-INITIAL', cleanScenario(), { subject_to_414a: false, auto_enroll: { initial_pct: 2 } });
});

// ─── Automatic enrollment ────────────────────────────────────────────────────

test('AE-NOT-ENROLLED: eligible employee with no deferrals and no election', () => {
  const s = cleanScenario();
  s.people.push({ employee_id: 'E100004', hire_date: '2025-11-01', birth_date: '1995-01-01', eligibility_date: '2026-01-01' });
  s.rows.push(...defaultRows('E100004', payDates(), { pct: 0, source: '' }));
  const r = fires('AE-NOT-ENROLLED', s);
  const f = r.findings.find(x => x.rule === 'AE-NOT-ENROLLED');
  assert.match(f.message, /4 pay period/); // first two pay dates fall inside the 30-day grace
});

test('AE-NOT-ENROLLED is silent for opt-outs, excluded employees and plans not subject to 414A', () => {
  const s = cleanScenario();
  s.people.push({ employee_id: 'E100004', hire_date: '2025-11-01', birth_date: '1995-01-01', eligibility_date: '2026-01-01' });
  s.rows.push(...defaultRows('E100004', payDates(), { pct: 0, source: 'opt_out' }));
  silent('AE-NOT-ENROLLED', s);
  const ex = clone(s); ex.people[3].excluded = 'Y'; ex.rows = ex.rows.map(r => r.employee_id === 'E100004' ? { ...r, election_source: '' } : r);
  silent('AE-NOT-ENROLLED', ex);
  silent('AE-NOT-ENROLLED', ex, { subject_to_414a: false });
});

test('AE-OPTOUT-CONTINUED: deductions after an opt-out, reported once with a count', () => {
  const s = cleanScenario();
  s.rows = s.rows.map(r => r.employee_id === 'E100001' ? { ...r, election_source: 'opt_out' } : r);
  const r = fires('AE-OPTOUT-CONTINUED', s);
  const f = r.findings.filter(x => x.rule === 'AE-OPTOUT-CONTINUED');
  assert.equal(f.length, 1);
  assert.equal(f[0].pay_periods, 6);
});

test('AE-DEFAULT-RATE: default deferral at the wrong rate', () => {
  const s = cleanScenario();
  s.rows = s.rows.filter(r => r.employee_id !== 'E100002');
  s.rows.push(...defaultRows('E100002', payDates(), { pct: 2 }));
  fires('AE-DEFAULT-RATE', s);
});

test('AE-ESCALATION-MISSED: rate not increased after the initial period', () => {
  const s = cleanScenario();
  s.people[0].auto_enroll_start_date = '2024-03-01'; // initial period ended Dec 31, 2025
  const r = fires('AE-ESCALATION-MISSED', s);
  assert.ok(!rules(r).includes('AE-DEFAULT-RATE'), 'a missed step is reported as escalation, not as a generic rate error');
  const ok = clone(s);
  ok.rows = ok.rows.filter(x => x.employee_id !== 'E100001');
  ok.rows.push(...defaultRows('E100001', payDates(), { pct: 4 }));
  silent('AE-ESCALATION-MISSED', ok);
  silent('AE-DEFAULT-RATE', ok);
});

// ─── Deferral amounts and limits ─────────────────────────────────────────────

test('DEF-ELECTION-MISMATCH: deduction does not match the elected percentage', () => {
  const s = cleanScenario();
  s.rows = s.rows.map(r => r.employee_id === 'E100003' ? { ...r, pretax: 200 } : r);
  fires('DEF-ELECTION-MISMATCH', s);
});

test('DEF-NO-COMP: deferral with no plan compensation', () => {
  const s = cleanScenario();
  s.rows[0].plan_comp = 0;
  fires('DEF-NO-COMP', s);
});

test('LIM-402G: year-to-date deferrals over the limit, silent with catch-up room', () => {
  const s = { people: [{ employee_id: 'E200001', hire_date: '2020-01-01', birth_date: '1985-01-01', eligibility_date: '2020-01-01' }],
    rows: defaultRows('E200001', payDates('2026-01-09', 26), { comp: 20000, pct: 5, source: 'affirmative' }) }; // $1,000 x 26 = $26,000
  fires('LIM-402G', s);
  const older = clone(s); older.people[0].birth_date = '1970-01-01'; // 56: limit 24,500 + 8,000
  silent('LIM-402G', older);
});

test('LIM-CATCHUP-ROTH: high earner\'s catch-up made pre-tax in 2026, silent when Roth', () => {
  const people = [{ employee_id: 'E300001', hire_date: '2015-01-01', birth_date: '1970-01-01', eligibility_date: '2015-01-01', prior_year_fica_wages: 200000 }];
  const rows = defaultRows('E300001', payDates('2026-01-09', 26), { comp: 20000, pct: 5, source: 'affirmative' });
  fires('LIM-CATCHUP-ROTH', { people, rows });
  const roth = rows.map((r, i) => i >= 24 ? { ...r, pretax: 0, roth: 1000 } : r); // YTD passes 24,500 in period 25
  silent('LIM-CATCHUP-ROTH', { people, rows: roth });
  silent('LIM-CATCHUP-ROTH', { people: [{ ...people[0], prior_year_fica_wages: 100000 }], rows });
});

test('DATA-NO-LIMITS-YEAR: limit checks skipped for a year with no IRS limits loaded', () => {
  const s = cleanScenario(payDates('2030-01-04', 2));
  s.people.forEach(p => { p.eligibility_date = '2029-01-01'; p.auto_enroll_start_date = '2029-01-04'; });
  s.rows = s.rows.map(r => r.election_source === 'default' ? { ...r, election_source: 'affirmative' } : r);
  fires('DATA-NO-LIMITS-YEAR', s);
});

// ─── Deposit timing ──────────────────────────────────────────────────────────

test('DEP-OUTER-LIMIT: deposit after the 15th business day of the next month', () => {
  const s = cleanScenario();
  s.rows = s.rows.map(r => r.pay_date === '2026-01-23' ? { ...r, deposit_date: '2026-02-24' } : r);
  fires('DEP-OUTER-LIMIT', s);
  const onTime = clone(s); onTime.rows = onTime.rows.map(r => r.pay_date === '2026-01-23' ? { ...r, deposit_date: '2026-02-23' } : r);
  silent('DEP-OUTER-LIMIT', onTime);
});

test('DEP-SAFE-HARBOR: small plan deposit after 7 business days', () => {
  const s = cleanScenario();
  s.rows = s.rows.map(r => r.pay_date === '2026-01-09' ? { ...r, deposit_date: '2026-01-21' } : r); // 7 business days incl. MLK holiday? -> 7
  silent('DEP-SAFE-HARBOR', s, { small_plan: true });
  s.rows = s.rows.map(r => r.pay_date === '2026-01-09' ? { ...r, deposit_date: '2026-01-22' } : r); // 8
  fires('DEP-SAFE-HARBOR', s, { small_plan: true });
});

test('DEP-SLOW: large plan deposit slower than the alert threshold', () => {
  const s = cleanScenario();
  s.rows = s.rows.map(r => r.pay_date === '2026-01-09' ? { ...r, deposit_date: '2026-01-23' } : r);
  fires('DEP-SLOW', s);
  silent('DEP-SLOW', s, { deposit_alert_business_days: 15 });
});

test('DEP-SLOWER-THAN-USUAL: one deposit much slower than the employer\'s norm', () => {
  const s = cleanScenario();
  s.rows = s.rows.map(r => r.pay_date === '2026-02-06' ? { ...r, deposit_date: '2026-02-12' } : r); // 4 business days vs usual 1
  const r = fires('DEP-SLOWER-THAN-USUAL', s);
  assert.ok(!rules(r).includes('DEP-SLOW'));
});

test('DEP-MISSING-DATE and DEP-BEFORE-PAY', () => {
  const s = cleanScenario();
  s.rows[0].deposit_date = '';
  fires('DEP-MISSING-DATE', s);
  const b = cleanScenario();
  b.rows = b.rows.map(r => r.pay_date === '2026-01-09' ? { ...r, deposit_date: '2026-01-08' } : r);
  fires('DEP-BEFORE-PAY', b);
});

// ─── Continuity and data quality ─────────────────────────────────────────────

test('CONT-DROPPED: active employee missing from the latest payroll, silent when terminated', () => {
  const s = cleanScenario();
  s.rows = s.rows.filter(r => !(r.employee_id === 'E100003' && r.pay_date === '2026-03-20'));
  fires('CONT-DROPPED', s);
  const t = clone(s); t.people[2].termination_date = '2026-03-10';
  silent('CONT-DROPPED', t);
});

test('data rules: missing columns, bad dates and amounts, unknown employees, duplicates', () => {
  const r = checkContributions({ censusCsv: 'employee_id\nE1\n', contributionsCsv: 'employee_id,pay_date\nE1,2026-01-09\n' });
  assert.equal(r.findings.filter(f => f.rule === 'DATA-MISSING-COLUMNS').length, 2);
  const s = cleanScenario();
  s.rows[0].pay_date = '2026-13-01';
  s.rows[1].pretax = '-5';
  s.rows.push({ ...s.rows[2], employee_id: 'E999999' });
  s.rows.push({ ...s.rows[3] });
  s.people.push({ employee_id: '', hire_date: '2026-01-01' });
  const out = run(s);
  for (const rule of ['DATA-BAD-DATE', 'DATA-BAD-AMOUNT', 'DATA-UNKNOWN-EMPLOYEE', 'DATA-DUPLICATE-ROW', 'DATA-BAD-ROW']) assert.ok(rules(out).includes(rule), rule);
});

test('column mapping lets any payroll system\'s export be used', () => {
  const { people, rows } = cleanScenario();
  const csv = contributions(rows).replace('employee_id,pay_date,plan_comp,pretax,roth', 'Worker ID,Check Date,401k Wages,Pre-Tax 401k,Roth 401k');
  const r = checkContributions({ censusCsv: census(people), contributionsCsv: csv, contributionsMapping: { employee_id: 'Worker ID', pay_date: 'Check Date', plan_comp: '401k Wages', pretax: 'Pre-Tax 401k', roth: 'Roth 401k' } });
  assert.deepEqual(r.findings, []);
});

// ─── Privacy and output ──────────────────────────────────────────────────────

test('employee IDs are masked and every finding has a rule, fix and legal basis', () => {
  const s = cleanScenario();
  s.rows = s.rows.map(r => r.employee_id === 'E100001' ? { ...r, election_source: 'opt_out' } : r);
  const r = run(s);
  assert.ok(!JSON.stringify(r).includes('E100001'));
  for (const f of r.findings) assert.ok(f.rule && f.message && f.fix && f.basis, JSON.stringify(f));
});

test('docs/rules.md lists every rule the checker can emit', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(new URL('../src/checker.mjs', import.meta.url), 'utf8');
  const doc = await readFile(new URL('../docs/rules.md', import.meta.url), 'utf8');
  const ids = [...new Set([...src.matchAll(/'(error|warning|info)', '([A-Z0-9-]+)'/g)].map(m => m[2]))];
  assert.ok(ids.length >= 25, `found ${ids.length}`);
  assert.deepEqual(ids.filter(id => !doc.includes(`| ${id} |`)), []);
});

test('every rule has a generic and a Workday fix location', async () => {
  const { HINTS } = await import('../src/hints.mjs');
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(new URL('../src/checker.mjs', import.meta.url), 'utf8');
  const ids = [...new Set([...src.matchAll(/'(error|warning|info)', '([A-Z0-9-]+)'/g)].map(m => m[2]))];
  assert.deepEqual(ids.filter(id => !HINTS[id]?.generic || !HINTS[id]?.workday), []);
});

test('bundled example files produce the documented findings', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (f) => readFile(new URL(`../examples/${f}`, import.meta.url), 'utf8');
  const r = checkContributions({ censusCsv: await read('census.example.csv'), contributionsCsv: await read('contributions.example.csv'), plan: JSON.parse(await read('plan.example.json')) });
  assert.deepEqual([...new Set(rules(r))].sort(), ['AE-ESCALATION-MISSED', 'AE-NOT-ENROLLED', 'DEP-SLOWER-THAN-USUAL']);
});
