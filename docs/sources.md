# Legal and regulatory sources

The checks follow these provisions. This tool is not legal advice; confirm plan-specific rules with the plan document, your recordkeeper and ERISA counsel.

## SECURE 2.0 mandatory automatic enrollment (IRC 414A)

- New 401(k) and 403(b) plans established after December 29, 2022 must automatically enroll eligible employees for plan years beginning after December 31, 2024, unless an exception applies (plans established earlier, businesses under 3 years old, employers with 10 or fewer employees, governmental and church plans, SIMPLE 401(k) plans).
- Initial default rate: a uniform 3% to 10% of compensation.
- Automatic increase: 1 percentage point a year after each completed year of participation, to at least 10% and no more than 15%.
- Proposed Treas. Reg. 1.414A-1 (January 2025): the employee's first year of participation (the "initial period") lasts until the end of their first full plan year; midyear escalation is also permitted. Participants may withdraw default contributions within 90 days.
- Correction of auto-enrollment and escalation errors: EPCRS (Rev. Proc. 2021-30) and the safe harbor codified in IRC 414(cc) by SECURE 2.0 sec. 350, available only if the sponsor has established compliance practices and procedures.

Final regulations under 414A were reported as nearing release in late 2026. When they are published, review `src/plan.mjs` (initial period and escalation timing) against them.

## IRS limits (src/limits.mjs)

| Limit | 2025 | 2026 |
|---|---|---|
| Elective deferrals, IRC 402(g)(1) | $23,500 | $24,500 |
| Catch-up, age 50+, IRC 414(v) | $7,500 | $8,000 |
| Catch-up, ages 60–63, IRC 414(v)(2)(E) | $11,250 | $11,250 |
| Roth catch-up wage threshold (prior-year FICA wages), IRC 414(v)(7) | not in effect | $150,000 (2025 wages) |

From January 1, 2026, catch-up contributions by employees whose prior-year FICA wages from the employer exceeded the threshold must be designated Roth (SECURE 2.0 sec. 603).

## Deposit timing (29 CFR 2510.3-102)

- General rule: participant contributions become plan assets on the earliest date they can reasonably be segregated from the employer's general assets.
- Outer limit for pension plans: no later than the 15th business day of the month following the month in which the amounts were withheld.
- Safe harbor (plans with fewer than 100 participants): deposits within 7 business days of withholding are deemed timely, applied deposit by deposit.
- The DOL compares deposit timing with the employer's own demonstrated practice; a deposit slower than usual can be late even inside the outer limit.

Business days exclude weekends and US federal holidays (5 U.S.C. 6103), with Saturday holidays observed on Friday and Sunday holidays on Monday.
