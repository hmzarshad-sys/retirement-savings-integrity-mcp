// Copyright (c) 2026 Humza Arshad. MIT License (see LICENSE).
//
// Where a finding is usually fixed. "generic" applies to any HR/payroll
// system; "workday" names the likely Workday area. Workday configuration
// varies by tenant, so these point to where to look, not exact task names.

const g = (generic, workday) => ({ generic, workday });

export const HINTS = {
  'PLAN-414A-INITIAL': g('Plan document and the plan settings file', 'Retirement savings plan setup: default contribution percentage'),
  'PLAN-414A-MAX': g('Plan document and the plan settings file', 'Retirement savings plan setup: automatic increase maximum'),
  'PLAN-414A-STEP': g('Plan document and the plan settings file', 'Retirement savings plan setup: automatic increase amount'),
  'AE-NOT-ENROLLED': g('Eligibility rules, the auto-enrollment process, and the payroll deduction', 'Eligibility rules for the retirement savings plan; the benefit event that applies default elections (did it run for this worker?); the retirement savings pay component on their payroll'),
  'AE-DEFAULT-RATE': g('Default rate in the auto-enrollment setup or in the payroll deduction', 'Default election percentage on the retirement savings plan; the worker\'s current retirement savings election'),
  'AE-ESCALATION-MISSED': g('The automatic increase process (scheduled job or vendor feed)', 'The scheduled process or business process that applies automatic increases; check it ran for the plan year and included this worker'),
  'AE-OPTOUT-CONTINUED': g('Opt-out processing between the recordkeeper, HR and payroll', 'The worker\'s retirement savings election after the waiver/opt-out; the inbound election feed from the recordkeeper, if used'),
  'DEF-ELECTION-MISMATCH': g('Deduction calculation in payroll', 'Retirement savings pay component calculation and the earnings included in plan compensation'),
  'DEF-NO-COMP': g('Plan compensation definition in payroll', 'Which earnings feed the retirement savings eligible-earnings balance'),
  'LIM-402G': g('Annual limit settings in payroll', 'Retirement savings limits for the tax year and the worker\'s year-to-date balances (including prior-employer amounts if tracked)'),
  'LIM-CATCHUP-ROTH': g('Roth catch-up routing in payroll and prior-year FICA wage data', 'Catch-up contribution setup: prior-year FICA wage test and routing of catch-up dollars to the Roth pay component'),
  'DEP-OUTER-LIMIT': g('Funding process from payroll to the plan trust (treasury, ACH, recordkeeper upload)', 'Usually outside Workday: the funding/ACH step after payroll completes and the recordkeeper file delivery date'),
  'DEP-SAFE-HARBOR': g('Funding process from payroll to the plan trust', 'Usually outside Workday: the funding step and the recordkeeper file delivery schedule'),
  'DEP-SLOW': g('Funding process from payroll to the plan trust', 'Usually outside Workday: the funding step and the recordkeeper file delivery schedule'),
  'DEP-SLOWER-THAN-USUAL': g('Funding process for this specific payroll', 'Integration event history for the recordkeeper file on this pay date; any manual or off-cycle step'),
  'DEP-MISSING-DATE': g('Source of deposit dates in the export', 'Deposit dates are usually not in Workday: join them from treasury or recordkeeper funding reports'),
  'DEP-BEFORE-PAY': g('Date columns in the export', 'Check which date the report uses (check date vs period end date)'),
  'CONT-DROPPED': g('Payroll results and the outbound contribution file', 'The worker\'s payroll result for this pay date and the recordkeeper integration\'s population filter'),
  'DATA-MISSING-COLUMNS': g('Export layout or column-mapping profile', 'Custom report columns, or the mapping profile for your report headers'),
  'DATA-BAD-ROW': g('Export content', 'Custom report filters and required fields'),
  'DATA-BAD-DATE': g('Export date formats', 'Report field formats (use YYYY-MM-DD)'),
  'DATA-BAD-AMOUNT': g('Export amounts (retro pay and reversals can create negatives)', 'Payroll result lines for reversals and retro pay included in the report'),
  'DATA-UNKNOWN-EMPLOYEE': g('Census population', 'Census report population (include terminated and leave workers in the period)'),
  'DATA-DUPLICATE-ROW': g('Export grouping (multiple checks on one date)', 'Report grouping by worker and check date; off-cycle checks'),
  'DATA-NO-LIMITS-YEAR': g('src/limits.mjs in this tool', 'Not a Workday issue: update the tool\'s IRS limits table'),
};

export function hintFor(rule, platform = 'generic') {
  const h = HINTS[rule];
  if (!h) return null;
  return platform === 'workday' ? h.workday : h.generic;
}
