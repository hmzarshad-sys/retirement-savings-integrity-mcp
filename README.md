# Retirement Savings Integrity MCP

Catch 401(k) and 403(b) contribution errors before they cost workers their retirement savings.

SECURE 2.0 requires most new 401(k) and 403(b) plans to automatically enroll employees and raise their savings rate every year. Payroll and recordkeeping data has to get that right, every paycheck, for every employee, along with IRS limits, the new 2026 Roth catch-up rule and Department of Labor deposit deadlines. When it doesn't, employees silently miss months of savings and employers face corrections, lost-earnings payments and penalties.

This MCP server lets Claude check a plan's payroll data the way a retirement plan compliance analyst would, locally, on your own machine:

- **Missed automatic enrollment:** eligible employees with no deferrals and no opt-out
- **Wrong default rates and missed automatic increases,** using the plan's escalation schedule
- **Opt-outs not honored:** deductions after an employee opted out
- **Deductions that don't match the election**
- **IRS limit breaches,** including age 50+ and 60–63 catch-ups
- **2026 Roth catch-up:** catch-ups made pre-tax by employees above the wage threshold
- **Late deposits:** past the DOL outer limit, outside the small-plan 7-business-day safe harbor, or slower than the employer's own usual timing
- **Employees who dropped out of the latest payroll**

Every finding gives the rule, a plain-English message, the fix, **the legal basis** (IRC section or DOL regulation) and **where to fix it**, including Workday-specific guidance.

It works with exports from any HR or payroll system (Workday, ADP, UKG, Oracle, SAP SuccessFactors, Paylocity, in-house payroll) through column-mapping profiles.

## Privacy

- **Runs locally,** with no network calls.
- **One folder only:** files are read only inside `RSI_DATA_DIR`.
- **No names needed:** the checker uses internal employee IDs, and masks those in results (`…1234`). Don't export names, SSNs or addresses.

See [SECURITY.md](SECURITY.md).

## Tools

| Tool | Purpose |
|---|---|
| `check_retirement_contributions` | Run all checks on a census and a contributions file. Optional plan settings, column mappings and `platform: "workday"`. |
| `get_plan_template` | Plan settings to copy and edit (auto-enrollment schedule, eligibility, small-plan status). |
| `get_column_template` | Columns the checker expects and how to map your export's headers. |
| `get_irs_limits` | The IRS limits used, by year. |
| `list_rules` | Every rule, with generic and Workday fix locations. |

Rules: [docs/rules.md](docs/rules.md). Legal sources: [docs/sources.md](docs/sources.md).

## Input files

**Census** (one row per employee): `employee_id`, `hire_date` required; optional `birth_date`, `eligibility_date`, `termination_date`, `prior_year_fica_wages`, `excluded`, `auto_enroll_start_date`.

**Contributions** (one row per employee per pay date): `employee_id`, `pay_date`, `plan_comp`, `pretax`, `roth` required; optional `election_source` (`default`, `affirmative`, `opt_out`), `elected_pct`, `deposit_date`.

Use your system's own headers with a mapping profile: copy [profiles/template.json](profiles/template.json), fill in your headers, and pass it as `census_mapping` / `contributions_mapping`. [profiles/workday-example.json](profiles/workday-example.json) shows a Workday custom report layout.

Synthetic examples: [examples/](examples/).

## Install

Requires **Node.js 18+**.

```bash
git clone https://github.com/hmzarshad-sys/retirement-savings-integrity-mcp.git
cd retirement-savings-integrity-mcp
npm install
npm test
```

### Claude Code

```bash
claude mcp add retirement-integrity -e RSI_DATA_DIR="/path/to/exports" -- node /absolute/path/to/retirement-savings-integrity-mcp/src/index.mjs
```

### Claude Desktop

```json
{
  "mcpServers": {
    "retirement-integrity": {
      "command": "node",
      "args": ["/absolute/path/to/retirement-savings-integrity-mcp/src/index.mjs"],
      "env": { "RSI_DATA_DIR": "/path/to/exports" }
    }
  }
}
```

## Use it

> "Check census.csv and contributions.csv against plan.json, as a Workday export."

Example finding:

```json
{
  "severity": "error",
  "rule": "AE-ESCALATION-MISSED",
  "employee": "…0001",
  "pay_date": "2026-01-09",
  "pay_periods": 6,
  "message": "Default rate should have increased to 4% but is still 3%.",
  "fix": "Apply the automatic increase in payroll and correct missed deferrals using the IRS correction method (EPCRS / IRC 414(cc) safe harbor).",
  "basis": "IRC 414A (SECURE 2.0 sec. 101); proposed Treas. Reg. 1.414A-1",
  "where_to_fix": "The scheduled process or business process that applies automatic increases; check it ran for the plan year and included this worker"
}
```

## Limits

- Not legal advice, and not a replacement for the plan's annual testing or audit.
- Plan documents vary: eligibility, compensation definitions, entry dates and escalation timing must be set in the plan file to match.
- IRS limits are loaded for 2025 and 2026; add new years in `src/limits.mjs` when published.
- Mandatory auto-enrollment rules follow the statute and the January 2025 proposed regulations; review against final regulations when issued.
- Does not yet check employer match, vesting, long-term part-time eligibility, loans or nondiscrimination testing.

## License

MIT. Copyright (c) 2026 Humza Arshad. See [LICENSE](LICENSE).

Workday is a trademark of Workday, Inc. This project is not affiliated with or endorsed by Workday, the IRS or the Department of Labor.
