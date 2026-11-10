// Copyright (c) 2026 Humza Arshad. MIT License (see LICENSE).
//
// Retirement contribution checks. Every finding carries:
//   severity  error | warning | info
//   rule      stable ID (docs/rules.md)
//   employee  masked ID (…1234), never a name
//   pay_date  the pay date concerned, when there is one
//   message   what is wrong, in plain English
//   fix       what to do
//   basis     the law, regulation or guidance the check rests on

import { parseCsv, applyMapping, num } from './csv.mjs';
import { parseDate, iso, addDays, businessDaysAfter, fifteenthBusinessDayOfNextMonth } from './dates.mjs';
import { limitsFor, catchUpLimit } from './limits.mjs';
import { mergePlan, eligibilityDate, expectedDefaultPct } from './plan.mjs';

export const CENSUS_REQUIRED = ['employee_id', 'hire_date'];
export const CONTRIB_REQUIRED = ['employee_id', 'pay_date', 'plan_comp', 'pretax', 'roth'];

export const BASIS = {
  aeMandate: 'IRC 414A (SECURE 2.0 sec. 101); proposed Treas. Reg. 1.414A-1',
  eaca: 'IRC 414(w); IRC 414A(b)',
  optOut: 'IRC 414(w); plan document',
  limit402g: 'IRC 402(g)(1); IRC 414(v)',
  rothCatchUp: 'IRC 414(v)(7) (SECURE 2.0 sec. 603), effective 2026',
  deposit: '29 CFR 2510.3-102(a)(1) and (b)(1)',
  safeHarbor: '29 CFR 2510.3-102(a)(2) (plans with fewer than 100 participants)',
  data: 'Data quality',
};

export function maskId(id) {
  const s = String(id ?? '');
  if (!s) return '(no ID)';
  return s.length <= 4 ? '*'.repeat(s.length) : `…${s.slice(-4)}`;
}

const r2 = (n) => Math.round(n * 100) / 100;

export function checkContributions({ censusCsv, contributionsCsv, plan: planIn = {}, censusMapping = {}, contributionsMapping = {}, asOf } = {}) {
  const plan = mergePlan(planIn);
  const findings = [];
  const add = (severity, rule, f) => {
    const finding = { severity, rule, employee: f.emp !== undefined ? maskId(f.emp) : null, pay_date: f.pay ? iso(f.pay) : null, message: f.message, fix: f.fix, basis: BASIS[f.basis] || f.basis };
    findings.push(finding);
    return finding;
  };
  // Repeating per-period problems are reported once, with a count of the
  // pay periods affected, instead of one finding per paycheck.
  const grouped = new Map();
  const addOnce = (key, severity, rule, f) => {
    const g = grouped.get(key);
    if (g) { g.pay_periods++; g.last_pay_date = f.pay ? iso(f.pay) : g.last_pay_date; return; }
    const finding = add(severity, rule, f);
    finding.pay_periods = 1;
    finding.last_pay_date = finding.pay_date;
    grouped.set(key, finding);
  };

  // ── Plan configuration ──
  const ae = plan.auto_enroll;
  if (plan.subject_to_414a) {
    if (!(ae.initial_pct >= 3 && ae.initial_pct <= 10)) add('error', 'PLAN-414A-INITIAL', { message: `Initial default rate is ${ae.initial_pct}%; IRC 414A requires 3% to 10%.`, fix: 'Correct auto_enroll.initial_pct to match the plan document, or amend the plan.', basis: 'aeMandate' });
    if (!(ae.max_pct >= 10 && ae.max_pct <= 15)) add('error', 'PLAN-414A-MAX', { message: `Escalation cap is ${ae.max_pct}%; IRC 414A requires escalation to at least 10% and no more than 15%.`, fix: 'Correct auto_enroll.max_pct to match the plan document, or amend the plan.', basis: 'aeMandate' });
    if (ae.step_pct !== 1) add('error', 'PLAN-414A-STEP', { message: `Annual escalation step is ${ae.step_pct} points; IRC 414A requires 1 percentage point a year.`, fix: 'Set auto_enroll.step_pct to 1.', basis: 'aeMandate' });
  }

  // ── Load data ──
  const census = applyMapping(parseCsv(censusCsv || ''), censusMapping, CENSUS_REQUIRED);
  const contrib = applyMapping(parseCsv(contributionsCsv || ''), contributionsMapping, CONTRIB_REQUIRED);
  if (census.missing.length || contrib.missing.length) {
    if (census.missing.length) add('error', 'DATA-MISSING-COLUMNS', { message: `Census file is missing column(s): ${census.missing.join(', ')}.`, fix: 'Add the columns or map them with a column-mapping profile (see profiles/).', basis: 'data' });
    if (contrib.missing.length) add('error', 'DATA-MISSING-COLUMNS', { message: `Contributions file is missing column(s): ${contrib.missing.join(', ')}.`, fix: 'Add the columns or map them with a column-mapping profile (see profiles/).', basis: 'data' });
    return finish(findings, plan, {});
  }

  const emps = new Map();
  for (const e of census.records) {
    if (!e.employee_id) { add('error', 'DATA-BAD-ROW', { message: `Census line ${e._line} has no employee_id.`, fix: 'Fix the census row.', basis: 'data' }); continue; }
    if (!parseDate(e.hire_date)) add('error', 'DATA-BAD-DATE', { emp: e.employee_id, message: `Census line ${e._line}: hire_date "${e.hire_date}" is not a valid date.`, fix: 'Use YYYY-MM-DD.', basis: 'data' });
    emps.set(e.employee_id, e);
  }

  const rows = [];
  const seen = new Set();
  for (const c of contrib.records) {
    const pay = parseDate(c.pay_date);
    if (!pay) { add('error', 'DATA-BAD-DATE', { emp: c.employee_id, message: `Contributions line ${c._line}: pay_date "${c.pay_date}" is not a valid date.`, fix: 'Use YYYY-MM-DD.', basis: 'data' }); continue; }
    const comp = num(c.plan_comp), pre = num(c.pretax), roth = num(c.roth);
    if ([comp, pre, roth].some(v => Number.isNaN(v) || (v !== null && v < 0))) { add('error', 'DATA-BAD-AMOUNT', { emp: c.employee_id, pay, message: `Contributions line ${c._line} has an invalid or negative amount.`, fix: 'Check plan_comp, pretax and roth on this row.', basis: 'data' }); continue; }
    if (!emps.has(c.employee_id)) add('warning', 'DATA-UNKNOWN-EMPLOYEE', { emp: c.employee_id, pay, message: `Contributions line ${c._line}: employee is not in the census.`, fix: 'Add the employee to the census or check the ID; eligibility cannot be checked without hire data.', basis: 'data' });
    const key = `${c.employee_id}|${pay.getTime()}`;
    if (seen.has(key)) add('warning', 'DATA-DUPLICATE-ROW', { emp: c.employee_id, pay, message: `Two contribution rows for the same employee and pay date (line ${c._line}).`, fix: 'Combine them if they are two parts of one paycheck; otherwise remove the duplicate before sending.', basis: 'data' });
    seen.add(key);
    rows.push({ id: c.employee_id, pay, comp: comp ?? 0, pre: pre ?? 0, roth: roth ?? 0, total: (pre ?? 0) + (roth ?? 0), source: (c.election_source || '').toLowerCase(), elected: num(c.elected_pct), deposit: parseDate(c.deposit_date), depositRaw: c.deposit_date, line: c._line });
  }
  rows.sort((a, b) => a.pay - b.pay || a.line - b.line);

  const byEmp = new Map();
  for (const r of rows) { if (!byEmp.has(r.id)) byEmp.set(r.id, []); byEmp.get(r.id).push(r); }
  const payTimes = [...new Set(rows.map(r => r.pay.getTime()))].sort((a, b) => a - b);
  const lastPay = payTimes.length ? new Date(payTimes.at(-1)) : null;
  const asOfDate = asOf ? parseDate(asOf) : lastPay;

  // ── Per-employee checks ──
  const yearsWithoutLimits = new Set();
  for (const [id, list] of byEmp) {
    const emp = emps.get(id);
    const birth = emp ? parseDate(emp.birth_date) : null;
    const term = emp ? parseDate(emp.termination_date) : null;
    const excluded = emp && /^(y|yes|true|1)$/i.test(emp.excluded || '');

    // Opt-out honored, election math, default rate and escalation
    // When default deferrals began. Taken from the census when provided
    // (needed when the file covers only part of the employee's history),
    // otherwise inferred from the first default-election row in the file.
    let defaultStart = emp ? parseDate(emp.auto_enroll_start_date) : null;
    for (const r of list) {
      if (r.source === 'opt_out' && r.total > plan.amount_tolerance) {
        addOnce(`${id}|optout`, 'error', 'AE-OPTOUT-CONTINUED', { emp: id, pay: r.pay, message: `Employee opted out, but $${r2(r.total)} was still deducted.`, fix: 'Stop the deduction in payroll and refund or correct per the plan\'s procedures (permissible withdrawal or correction).', basis: 'optOut' });
      }
      if (r.total > 0 && !(r.comp > 0)) {
        addOnce(`${id}|nocomp`, 'warning', 'DEF-NO-COMP', { emp: id, pay: r.pay, message: `A deferral of $${r2(r.total)} was taken with no plan compensation.`, fix: 'Check the plan compensation mapping; deferrals should be a percentage of plan compensation.', basis: 'data' });
      }
      if (r.elected !== null && !Number.isNaN(r.elected) && r.comp > 0 && (r.source === 'affirmative' || r.source === 'default')) {
        const expected = r.comp * r.elected / 100;
        if (Math.abs(expected - r.total) > Math.max(plan.amount_tolerance, 0.005 * expected)) {
          addOnce(`${id}|mismatch`, 'warning', 'DEF-ELECTION-MISMATCH', { emp: id, pay: r.pay, message: `Election is ${r.elected}% of $${r2(r.comp)} = $${r2(expected)}, but $${r2(r.total)} was deducted.`, fix: 'Check the deduction setup for this employee, partial-period pay and any limit cut-offs.', basis: 'eaca' });
        }
      }
      if (r.source === 'default' && plan.subject_to_414a && r.comp > 0) {
        if (!defaultStart) defaultStart = r.pay;
        const exp = expectedDefaultPct(defaultStart, r.pay, plan);
        const actual = (r.total / r.comp) * 100;
        if (Math.abs(actual - exp) > plan.pct_tolerance && !hitLimit(list, r, birth)) {
          const prevStep = exp - plan.auto_enroll.step_pct;
          if (exp > plan.auto_enroll.initial_pct && Math.abs(actual - prevStep) <= plan.pct_tolerance) {
            addOnce(`${id}|esc|${exp}`, 'error', 'AE-ESCALATION-MISSED', { emp: id, pay: r.pay, message: `Default rate should have increased to ${exp}% but is still ${r2(actual)}%.`, fix: 'Apply the automatic increase in payroll and correct missed deferrals using the IRS correction method (EPCRS / IRC 414(cc) safe harbor).', basis: 'aeMandate' });
          } else {
            addOnce(`${id}|rate|${exp}`, 'error', 'AE-DEFAULT-RATE', { emp: id, pay: r.pay, message: `Default deferral is ${r2(actual)}% of pay; the plan's schedule requires ${exp}% (previous step ${Math.max(plan.auto_enroll.initial_pct, prevStep)}%).`, fix: 'Correct the default rate in payroll to match the plan\'s automatic enrollment schedule.', basis: 'aeMandate' });
          }
        }
      }
    }

    // Missed automatic enrollment
    if (emp && plan.subject_to_414a && !excluded) {
      const elig = eligibilityDate(emp, plan);
      if (elig) {
        const deadline = addDays(elig, plan.auto_enroll.enroll_within_days);
        const missed = list.filter(r => r.pay > deadline && (!term || r.pay <= term) && r.total <= plan.amount_tolerance && r.source !== 'opt_out' && !(r.source === 'affirmative' && (r.elected === 0)));
        if (missed.length) {
          add('error', 'AE-NOT-ENROLLED', { emp: id, pay: missed[0].pay, message: `Eligible since ${iso(elig)} but no deferral was taken in ${missed.length} pay period(s) from ${iso(missed[0].pay)}, with no opt-out or affirmative election on file.`, fix: `Start default deferrals at the scheduled rate and correct the missed deferrals (EPCRS / IRC 414(cc) safe harbor). Check why automatic enrollment did not trigger: eligibility rules, the enrollment event or the deduction setup.`, basis: 'aeMandate' });
        }
      }
    }

    // 402(g) limit and mandatory Roth catch-up
    const byYear = new Map();
    for (const r of list) { const y = r.pay.getUTCFullYear(); if (!byYear.has(y)) byYear.set(y, []); byYear.get(y).push(r); }
    for (const [year, yl] of byYear) {
      const L = limitsFor(year);
      if (!L) { yearsWithoutLimits.add(year); continue; }
      const cap = L.elective_deferral + catchUpLimit(year, birth);
      let ytd = 0, flagged = false;
      const fica = emp ? num(emp.prior_year_fica_wages) : null;
      const rothRequired = L.roth_catch_up_wage_threshold && fica !== null && !Number.isNaN(fica) && fica > L.roth_catch_up_wage_threshold && catchUpLimit(year, birth) > 0;
      for (const r of yl) {
        const before = ytd;
        ytd += r.total;
        if (!flagged && ytd > cap + plan.amount_tolerance) {
          flagged = true;
          add('error', 'LIM-402G', { emp: id, pay: r.pay, message: `Year-to-date deferrals reach $${r2(ytd)} in ${year}, over the $${cap} limit (${L.elective_deferral} base${cap > L.elective_deferral ? ` + ${cap - L.elective_deferral} catch-up` : ''}).`, fix: 'Stop deferrals at the limit in payroll and distribute the excess (with earnings) by April 15 of the following year.', basis: 'limit402g' });
        }
        if (rothRequired && ytd > L.elective_deferral) {
          const overThisPeriod = Math.min(r.total, ytd - Math.max(before, L.elective_deferral));
          const pretaxShare = Math.min(r.pre, overThisPeriod);
          if (pretaxShare > plan.amount_tolerance) {
            addOnce(`${id}|roth|${year}`, 'error', 'LIM-CATCHUP-ROTH', { emp: id, pay: r.pay, message: `Prior-year FICA wages exceed $${L.roth_catch_up_wage_threshold}, so catch-up contributions must be Roth, but $${r2(pretaxShare)} of this period's catch-up was pre-tax.`, fix: 'Route deferrals above the base 402(g) limit to Roth for this employee, and correct the pre-tax catch-up per IRS guidance.', basis: 'rothCatchUp' });
          }
        }
      }
    }
  }
  for (const y of yearsWithoutLimits) add('info', 'DATA-NO-LIMITS-YEAR', { message: `No IRS limits are loaded for ${y}, so 402(g) and Roth catch-up checks were skipped for that year.`, fix: 'Add the year to src/limits.mjs when the IRS publishes it.', basis: 'data' });

  // ── Deposit timing (by pay date) ──
  const byPay = new Map();
  for (const r of rows) {
    if (r.total <= 0) continue;
    const k = r.pay.getTime();
    if (!byPay.has(k)) byPay.set(k, { pay: r.pay, deposit: null, missing: 0, amount: 0 });
    const g = byPay.get(k);
    g.amount += r.total;
    if (!r.deposit) { g.missing++; continue; }
    if (!g.deposit || r.deposit > g.deposit) g.deposit = r.deposit;
  }
  const lags = [];
  for (const g of byPay.values()) {
    if (g.missing) add('warning', 'DEP-MISSING-DATE', { pay: g.pay, message: `${g.missing} contribution row(s) for this payroll have no deposit date.`, fix: 'Record the date the money reached the plan trust; deposit timing cannot be checked without it.', basis: 'deposit' });
    if (!g.deposit) continue;
    if (g.deposit < g.pay) { add('info', 'DEP-BEFORE-PAY', { pay: g.pay, message: `Deposit date ${iso(g.deposit)} is before the pay date.`, fix: 'Confirm the dates; pre-funding is allowed but usually signals a date mapping error.', basis: 'data' }); continue; }
    const lag = businessDaysAfter(g.pay, g.deposit);
    lags.push({ g, lag });
    const outer = fifteenthBusinessDayOfNextMonth(g.pay);
    if (g.deposit > outer) {
      add('error', 'DEP-OUTER-LIMIT', { pay: g.pay, message: `$${r2(g.amount)} was deposited ${iso(g.deposit)}, after the outer limit of ${iso(outer)} (15th business day of the following month).`, fix: 'Late deposits are a prohibited transaction: deposit lost earnings and consider the DOL Voluntary Fiduciary Correction Program; report on Form 5500.', basis: 'deposit' });
    } else if (plan.small_plan && lag > 7) {
      add('warning', 'DEP-SAFE-HARBOR', { pay: g.pay, message: `Deposited ${lag} business days after payday, outside the 7-business-day safe harbor for small plans.`, fix: 'Deposit within 7 business days to rely on the safe harbor; otherwise the deposit must still be made as soon as the money can reasonably be segregated.', basis: 'safeHarbor' });
    } else if (!plan.small_plan && lag > plan.deposit_alert_business_days) {
      add('warning', 'DEP-SLOW', { pay: g.pay, message: `Deposited ${lag} business days after payday (alert threshold ${plan.deposit_alert_business_days}).`, fix: 'The rule is "as soon as the money can reasonably be segregated", not the 15th-business-day outer limit. Review why this deposit was slower.', basis: 'deposit' });
    }
  }
  if (lags.length >= 4) {
    const sorted = lags.map(l => l.lag).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    for (const { g, lag } of lags) {
      if (lag >= median + 3 && g.deposit <= fifteenthBusinessDayOfNextMonth(g.pay)) {
        add('warning', 'DEP-SLOWER-THAN-USUAL', { pay: g.pay, message: `Deposited ${lag} business days after payday; this employer usually takes ${median}.`, fix: 'The DOL compares deposits with the employer\'s own usual timing. A slower-than-usual deposit can be treated as late even within the outer limit.', basis: 'deposit' });
      }
    }
  }

  // ── Employees who dropped out of the latest payroll ──
  if (payTimes.length >= 2) {
    const last = payTimes.at(-1), prev = payTimes.at(-2);
    const lastIds = new Set(rows.filter(r => r.pay.getTime() === last).map(r => r.id));
    for (const r of rows.filter(x => x.pay.getTime() === prev && x.total > 0)) {
      const emp = emps.get(r.id);
      const term = emp ? parseDate(emp.termination_date) : null;
      if (lastIds.has(r.id) || (term && term.getTime() < last)) continue;
      add('warning', 'CONT-DROPPED', { emp: r.id, pay: new Date(last), message: `Deferring on ${iso(new Date(prev))} but missing from the ${iso(new Date(last))} payroll, with no termination date.`, fix: 'Check whether the employee was paid on this date; if so, the deduction or the file row is missing.', basis: 'data' });
    }
  }

  return finish(findings, plan, { emps, rows, byEmp, lags, asOfDate });
}

function hitLimit(list, r, birth) {
  // A default deferral below schedule is expected once the 402(g) limit is reached.
  const year = r.pay.getUTCFullYear();
  const L = limitsFor(year);
  if (!L) return false;
  const cap = L.elective_deferral + catchUpLimit(year, birth);
  const ytd = list.filter(x => x.pay.getUTCFullYear() === year && x.pay <= r.pay).reduce((s, x) => s + x.total, 0);
  return ytd >= cap - 0.01;
}

function finish(findings, plan, ctx) {
  const rank = { error: 0, warning: 1, info: 2 };
  findings.sort((a, b) => rank[a.severity] - rank[b.severity] || (a.pay_date || '').localeCompare(b.pay_date || ''));
  const counts = { error: 0, warning: 0, info: 0 };
  for (const f of findings) counts[f.severity]++;
  const summary = ctx.rows ? summarize(ctx, plan) : null;
  return { plan: plan.name, valid: counts.error === 0, counts, summary, findings };
}

function summarize({ emps, rows, byEmp, lags }, plan) {
  const contributing = [...byEmp.values()].filter(l => l.some(r => r.total > 0)).length;
  const totalComp = rows.reduce((s, r) => s + r.comp, 0);
  const totalDef = rows.reduce((s, r) => s + r.total, 0);
  const lagVals = lags.map(l => l.lag).sort((a, b) => a - b);
  const sources = {};
  for (const r of rows) sources[r.source || 'unspecified'] = (sources[r.source || 'unspecified'] || 0) + 1;
  return {
    employees_in_census: emps.size,
    employees_in_contributions: byEmp.size,
    employees_deferring: contributing,
    pay_dates: new Set(rows.map(r => r.pay.getTime())).size,
    total_plan_comp: r2(totalComp),
    total_deferrals: r2(totalDef),
    average_deferral_rate_pct: totalComp ? r2(totalDef / totalComp * 100) : null,
    election_sources: sources,
    deposit_business_days: lagVals.length ? { median: lagVals[Math.floor(lagVals.length / 2)], max: lagVals.at(-1) } : null,
    small_plan: plan.small_plan,
  };
}
