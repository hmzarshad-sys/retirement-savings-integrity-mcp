// Copyright (c) 2026 Humza Arshad. MIT License (see LICENSE).
//
// Plan settings and the auto-enrollment schedule. Defaults describe a
// typical SECURE 2.0 (IRC 414A) plan; every value can be overridden in the
// plan file to match the plan document.

import { parseDate, addDays, ageOn } from './dates.mjs';

export const DEFAULT_PLAN = {
  name: 'Example 401(k) plan',
  plan_year_start_month: 1,          // 1 = calendar-year plan
  subject_to_414a: true,             // new plan subject to SECURE 2.0 mandatory auto-enrollment
  auto_enroll: {
    initial_pct: 3,                  // IRC 414A: 3% to 10%
    step_pct: 1,                     // +1 percentage point a year
    max_pct: 10,                     // escalate to at least 10%, no more than 15%
    escalation_basis: 'plan_year',   // 'plan_year' (first day of each plan year after the initial period) or 'anniversary'
    enroll_within_days: 30,          // grace from eligibility to the first default deferral
  },
  eligibility: {
    min_age: 21,
    service_days: 0,
    entry: 'immediate',              // 'immediate' | 'first_of_month' | 'first_of_quarter'
  },
  small_plan: false,                 // fewer than 100 participants at the start of the plan year (DOL 7-business-day safe harbor)
  deposit_alert_business_days: 7,    // flag deposits slower than this (large plans have no fixed safe harbor)
  amount_tolerance: 0.05,            // dollars
  pct_tolerance: 0.1,                // percentage points
};

export function mergePlan(p = {}) {
  return {
    ...DEFAULT_PLAN, ...p,
    auto_enroll: { ...DEFAULT_PLAN.auto_enroll, ...(p.auto_enroll || {}) },
    eligibility: { ...DEFAULT_PLAN.eligibility, ...(p.eligibility || {}) },
  };
}

export function planYearStart(d, startMonth) {
  const m = startMonth - 1;
  const y = d.getUTCMonth() >= m ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return new Date(Date.UTC(y, m, 1));
}

// Eligibility (entry) date from the census, or computed from plan rules.
export function eligibilityDate(emp, plan) {
  const given = parseDate(emp.eligibility_date);
  if (given) return given;
  const hire = parseDate(emp.hire_date);
  if (!hire) return null;
  let d = addDays(hire, plan.eligibility.service_days || 0);
  const birth = parseDate(emp.birth_date);
  if (birth && plan.eligibility.min_age) {
    const ageDate = new Date(Date.UTC(birth.getUTCFullYear() + plan.eligibility.min_age, birth.getUTCMonth(), birth.getUTCDate()));
    if (ageDate > d) d = ageDate;
  }
  if (plan.eligibility.entry === 'first_of_month' && d.getUTCDate() !== 1) {
    d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  } else if (plan.eligibility.entry === 'first_of_quarter') {
    const q = Math.floor(d.getUTCMonth() / 3);
    const qs = new Date(Date.UTC(d.getUTCFullYear(), q * 3, 1));
    if (qs.getTime() !== d.getTime()) d = new Date(Date.UTC(d.getUTCFullYear(), q * 3 + 3, 1));
  }
  return d;
}

// Expected default deferral percentage on a pay date for someone whose
// default contributions began on `start`.
// plan_year basis (IRC 414A / proposed Treas. Reg. 1.414A-1): the initial
// period runs to the end of the first FULL plan year; the rate rises by one
// step on the first day of each plan year after that.
export function expectedDefaultPct(start, payDate, plan) {
  const ae = plan.auto_enroll;
  let steps;
  if (ae.escalation_basis === 'anniversary') {
    steps = Math.max(0, ageOn(start, payDate));
  } else {
    const pyStart = planYearStart(start, plan.plan_year_start_month);
    const initialEndYears = pyStart.getTime() === start.getTime() ? 1 : 2;
    const initialEnd = new Date(Date.UTC(pyStart.getUTCFullYear() + initialEndYears, pyStart.getUTCMonth(), 1));
    if (payDate < initialEnd) steps = 0;
    else {
      const payPy = planYearStart(payDate, plan.plan_year_start_month);
      steps = 1 + (payPy.getUTCFullYear() - initialEnd.getUTCFullYear());
    }
  }
  return Math.min(ae.max_pct, ae.initial_pct + ae.step_pct * steps);
}
