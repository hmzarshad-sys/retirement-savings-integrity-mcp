// Synthetic census and contribution files for tests. All people are fictional.
import { addDays, iso, parseDate } from '../../src/dates.mjs';

export function payDates(start = '2026-01-09', count = 6, everyDays = 14) {
  const out = [];
  let d = parseDate(start);
  for (let i = 0; i < count; i++) { out.push(iso(d)); d = addDays(d, everyDays); }
  return out;
}

const toCsv = (headers, rows) => [headers.join(','), ...rows.map(r => headers.map(h => {
  const v = r[h] ?? '';
  return /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v;
}).join(','))].join('\n') + '\n';

export const CENSUS_HEADERS = ['employee_id', 'hire_date', 'birth_date', 'eligibility_date', 'termination_date', 'prior_year_fica_wages', 'excluded', 'auto_enroll_start_date'];
export const CONTRIB_HEADERS = ['employee_id', 'pay_date', 'plan_comp', 'pretax', 'roth', 'election_source', 'elected_pct', 'deposit_date'];

export function census(people) { return toCsv(CENSUS_HEADERS, people); }
export function contributions(rows) { return toCsv(CONTRIB_HEADERS, rows); }

// A person auto-enrolled at `pct` of `comp` every pay date, deposited
// `lagDays` calendar days after payday.
export function defaultRows(id, dates, { comp = 4000, pct = 3, lagDays = 3, source = 'default', roth = 0 } = {}) {
  return dates.map(d => {
    const amt = Math.round(comp * pct) / 100;
    return { employee_id: id, pay_date: d, plan_comp: comp, pretax: roth ? 0 : amt, roth: roth ? amt : 0, election_source: source, elected_pct: pct, deposit_date: iso(addDays(parseDate(d), lagDays)) };
  });
}

// A clean scenario: two auto-enrolled employees and one affirmative 6%.
export function cleanScenario(dates = payDates()) {
  const people = [
    { employee_id: 'E100001', hire_date: '2025-11-01', birth_date: '1990-05-01', eligibility_date: '2026-01-01' },
    { employee_id: 'E100002', hire_date: '2025-11-15', birth_date: '1985-02-10', eligibility_date: '2026-01-01' },
    { employee_id: 'E100003', hire_date: '2024-03-01', birth_date: '1980-07-20', eligibility_date: '2024-03-01' },
  ];
  const rows = [
    ...defaultRows('E100001', dates),
    ...defaultRows('E100002', dates),
    ...defaultRows('E100003', dates, { pct: 6, source: 'affirmative' }),
  ];
  return { people, rows };
}
