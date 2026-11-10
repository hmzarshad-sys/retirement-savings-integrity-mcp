# Working on this repo

Retirement Savings Integrity MCP: checks payroll and 401(k)/403(b) contribution exports for SECURE 2.0, IRS limit and DOL deposit-timing problems, locally.

## Layout
- `src/checker.mjs`: all rules; findings = { severity, rule, employee (masked), pay_date, message, fix, basis }
- `src/plan.mjs`: plan settings, eligibility date, default-rate schedule
- `src/limits.mjs`: IRS limits by year (add a year when the IRS publishes it)
- `src/dates.mjs`: business days and federal holidays
- `src/csv.mjs`: CSV parsing and column mapping
- `src/hints.mjs`: generic and Workday fix locations per rule
- `src/files.mjs`: reads only inside RSI_DATA_DIR
- `src/index.mjs`: tool wiring only
- `docs/rules.md`, `docs/sources.md`: keep in sync with the code

## Rules for changes
- Every rule cites its legal basis in `BASIS` and has: a message, a fix, a docs/rules.md row, a HINTS entry, a test that fires and a case where it stays silent. Tests enforce the docs and hints.
- Never add names, SSNs or addresses to inputs or outputs. Employee IDs stay masked.
- Don't guess legal numbers: limits and thresholds come from a cited IRS/DOL source in docs/sources.md.
- Synthetic data only (test/fixtures/build.mjs). Never commit real exports.

Run `npm test` before every commit.
