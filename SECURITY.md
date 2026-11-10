# Security and privacy

Payroll and retirement data is sensitive: compensation, ages and savings decisions.

## How the server handles data

- **Local only.** No network calls. Files are read from disk and results go to the MCP client on the same machine.
- **Confined to one folder.** Files are read only inside `RSI_DATA_DIR`; paths outside it are refused.
- **Minimal data.** The checker needs internal employee IDs, dates and amounts, never names, SSNs or addresses.
- **Masked output.** Employee IDs are shown as the last four characters (`…1234`).
- **Read-only.** The server never changes, moves or sends files.

## Your responsibilities

- Export only the columns the checker needs, and only for the plan and period being checked.
- Keep `RSI_DATA_DIR` on an encrypted, company-managed machine, and delete exports when done.
- Never commit real exports to any repository; use the synthetic files in `examples/`.
- Use an AI service your organization has approved for this kind of data, and follow its data-handling policies.

## Reporting a vulnerability

Use GitHub's private "Report a vulnerability" option on the Security tab.
