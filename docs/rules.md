# Rules

Every finding carries one of these rule IDs, a plain-English message, a fix, and the legal basis it rests on. Repeating per-paycheck problems (for example, the wrong default rate every pay period) are reported once per employee with `pay_periods` and `last_pay_date`.

Severity: **error** = likely compliance failure that needs correction; **warning** = probably wrong, check it; **info** = worth a look.

## Plan configuration

| Rule | Severity | What it catches | Basis |
|---|---|---|---|
| PLAN-414A-INITIAL | error | Initial default rate outside 3%–10% | IRC 414A(b) |
| PLAN-414A-MAX | error | Escalation cap outside 10%–15% | IRC 414A(b) |
| PLAN-414A-STEP | error | Annual escalation step other than 1 percentage point | IRC 414A(b) |

## Automatic enrollment (SECURE 2.0)

| Rule | Severity | What it catches | Basis |
|---|---|---|---|
| AE-NOT-ENROLLED | error | Eligible employee with no deferrals after the enrollment grace period and no opt-out or affirmative election | IRC 414A; proposed Treas. Reg. 1.414A-1 |
| AE-DEFAULT-RATE | error | Default-election employee deferring at a rate other than the plan's schedule | IRC 414A |
| AE-ESCALATION-MISSED | error | Default rate still at the previous step after the automatic increase was due | IRC 414A |
| AE-OPTOUT-CONTINUED | error | Deductions continue after the employee opted out | IRC 414(w); plan document |

## Deferral amounts and IRS limits

| Rule | Severity | What it catches | Basis |
|---|---|---|---|
| DEF-ELECTION-MISMATCH | warning | Deduction differs from the elected percentage of plan compensation | IRC 414(w); plan document |
| DEF-NO-COMP | warning | Deferral taken with no plan compensation | Data quality |
| LIM-402G | error | Year-to-date deferrals exceed the 402(g) limit plus any age-based catch-up | IRC 402(g)(1); IRC 414(v) |
| LIM-CATCHUP-ROTH | error | From 2026: catch-up made pre-tax by someone whose prior-year FICA wages exceeded the Roth catch-up threshold | IRC 414(v)(7) (SECURE 2.0 sec. 603) |

## Deposit timing

| Rule | Severity | What it catches | Basis |
|---|---|---|---|
| DEP-OUTER-LIMIT | error | Deposit after the 15th business day of the month following payday | 29 CFR 2510.3-102(b)(1) |
| DEP-SAFE-HARBOR | warning | Small plan: deposit more than 7 business days after payday | 29 CFR 2510.3-102(a)(2) |
| DEP-SLOW | warning | Large plan: deposit slower than the plan's alert threshold (default 7 business days) | 29 CFR 2510.3-102(a)(1) |
| DEP-SLOWER-THAN-USUAL | warning | Deposit at least 3 business days slower than the employer's own median | 29 CFR 2510.3-102(a)(1) |
| DEP-MISSING-DATE | warning | Contribution rows with no deposit date | 29 CFR 2510.3-102 |
| DEP-BEFORE-PAY | info | Deposit dated before payday (often a date-mapping error) | Data quality |

## Continuity

| Rule | Severity | What it catches | Basis |
|---|---|---|---|
| CONT-DROPPED | warning | Employee deferring in the previous payroll but missing from the latest one, with no termination date | Data quality |

## Data quality

| Rule | Severity | What it catches | Basis |
|---|---|---|---|
| DATA-MISSING-COLUMNS | error | Required columns missing (checks stop) | Data quality |
| DATA-BAD-ROW | error | Census row with no employee ID | Data quality |
| DATA-BAD-DATE | error | Invalid hire date or pay date | Data quality |
| DATA-BAD-AMOUNT | error | Invalid or negative compensation or deferral | Data quality |
| DATA-UNKNOWN-EMPLOYEE | warning | Contribution for someone not in the census | Data quality |
| DATA-DUPLICATE-ROW | warning | Two rows for the same employee and pay date | Data quality |
| DATA-NO-LIMITS-YEAR | info | No IRS limits loaded for a year, so limit checks were skipped | Data quality |
