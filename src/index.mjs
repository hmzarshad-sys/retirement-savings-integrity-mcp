#!/usr/bin/env node
// Copyright (c) 2026 Humza Arshad. MIT License (see LICENSE).
//
// Retirement Savings Integrity MCP: checks payroll and 401(k)/403(b)
// contribution data for SECURE 2.0 auto-enrollment, IRS limit, Roth catch-up
// and deposit-timing problems, locally, with employee IDs masked.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { checkContributions } from './checker.mjs';
import { DEFAULT_PLAN } from './plan.mjs';
import { LIMITS, limitsFor } from './limits.mjs';
import { HINTS, hintFor } from './hints.mjs';
import { readDataFile, readProfile, dataDir } from './files.mjs';

const VERSION = '0.1.0';
const server = new McpServer({ name: 'retirement-savings-integrity', version: VERSION });
const ok = (o) => ({ content: [{ type: 'text', text: JSON.stringify(o, null, 2) }] });
const err = (e) => ({ content: [{ type: 'text', text: JSON.stringify({ error: true, code: e.code || 'ERROR', message: e.message, suggestion: e.suggestion || null }) }] });

server.tool(
  'check_retirement_contributions',
  [
    'Check a census export and a payroll contribution export for a 401(k)/403(b) plan.',
    'Finds: missed SECURE 2.0 automatic enrollment, wrong default rates, missed automatic increases,',
    'deductions after opt-out, deductions that do not match elections, 402(g) limit breaches,',
    'pre-tax catch-ups that must be Roth (2026+), late deposits (DOL outer limit, small-plan safe harbor,',
    'slower-than-usual deposits), and employees who dropped out of the latest payroll.',
    'Each finding has a rule ID, plain-English message, fix, legal basis and where to fix it.',
    'Employee IDs are masked; files never leave the machine.',
  ].join('\n'),
  {
    census_file: z.string().describe('Census CSV, relative to RSI_DATA_DIR'),
    contributions_file: z.string().describe('Contributions CSV (one row per employee per pay date), relative to RSI_DATA_DIR'),
    plan_file: z.string().optional().describe('Plan settings JSON (see get_plan_template), relative to RSI_DATA_DIR'),
    plan: z.record(z.any()).optional().describe('Plan settings inline, instead of plan_file'),
    census_mapping: z.string().optional().describe('Column-mapping profile for the census: a bundled name (e.g. "workday-example") or a JSON file in RSI_DATA_DIR'),
    contributions_mapping: z.string().optional().describe('Column-mapping profile for the contributions file'),
    platform: z.enum(['generic', 'workday']).optional().describe('Adds where_to_fix for this platform. Default generic.'),
    max_findings: z.number().int().positive().optional().describe('Default 200, errors first'),
  },
  async (a) => {
    try {
      const plan = a.plan_file ? JSON.parse(await readDataFile(a.plan_file)) : (a.plan || {});
      const cm = await readProfile(a.census_mapping);
      const km = await readProfile(a.contributions_mapping);
      const r = checkContributions({
        censusCsv: await readDataFile(a.census_file),
        contributionsCsv: await readDataFile(a.contributions_file),
        plan,
        censusMapping: cm.census || cm,
        contributionsMapping: km.contributions || km,
      });
      const limit = a.max_findings || 200;
      const findings = r.findings.slice(0, limit).map(f => ({ ...f, where_to_fix: hintFor(f.rule, a.platform || 'generic') }));
      return ok({ ...r, findings, findings_truncated: r.findings.length > limit });
    } catch (e) { return err(e); }
  },
);

server.tool('get_plan_template',
  'Plan settings with defaults (auto-enrollment schedule, eligibility, small-plan status, tolerances). Copy, edit to match the plan document, save in RSI_DATA_DIR and pass as plan_file.',
  {}, async () => ok(DEFAULT_PLAN));

server.tool('get_irs_limits',
  'IRS 401(k) limits the checker uses (elective deferral, catch-up 50+, catch-up 60–63, Roth catch-up wage threshold), for one year or all loaded years.',
  { year: z.number().int().optional() },
  async ({ year }) => ok(year ? (limitsFor(year) || { error: true, message: `No limits loaded for ${year}.`, loaded_years: Object.keys(LIMITS) }) : LIMITS));

server.tool('list_rules',
  'Every rule the checker applies, with where it is usually fixed (generic and Workday).',
  {}, async () => ok(HINTS));

server.tool('get_column_template',
  'The column names the checker expects in the census and contributions files, and how to map your payroll system\'s export headers to them.',
  {},
  async () => ok({
    census: {
      required: ['employee_id', 'hire_date'],
      optional: ['birth_date', 'eligibility_date', 'termination_date', 'prior_year_fica_wages', 'excluded', 'auto_enroll_start_date'],
    },
    contributions: {
      required: ['employee_id', 'pay_date', 'plan_comp', 'pretax', 'roth'],
      optional: ['election_source (default | affirmative | opt_out)', 'elected_pct', 'deposit_date'],
    },
    mapping: 'A JSON profile { "census": { "employee_id": "Your Header", ... }, "contributions": { ... } }. Bundled: generic, workday-example, template.',
    privacy: 'Names, SSNs and addresses are not needed and should not be exported. Use an internal employee ID.',
  }));

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write(`[retirement-savings-integrity ${VERSION}] data folder: ${dataDir() || '(RSI_DATA_DIR not set)'}\n`);
