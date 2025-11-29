# agent.md – Tally AI Assistant Instructions

## Project Overview

Tally is a B2B SaaS application for accounting practices and payroll bureaus in Ireland and the UK.

The product automatically analyses payslips, detects anomalies, compares against prior periods, and produces audit-ready reports. It is **not** a payroll processing engine – it sits on top of existing payroll systems as a verification layer.

The MVP flow is:

1. Practice user logs in.
2. Selects a client and creates a payroll batch.
3. Uploads payslips (PDFs / ZIP).
4. Background process extracts and normalises data.
5. Rules engine generates anomalies/issues.
6. User reviews issues in a dashboard and exports a report.

## Tech Stack (MVP)

- Frontend: Next.js (React), deployed on Vercel.
- UI: Ant Design (antd).
- Backend/Data: Supabase (Postgres, Auth, Storage, Edge Functions).
- OCR: External OCR API (e.g. AWS Textract or similar) called from Edge Functions.
- Language: TypeScript for frontend; TypeScript or Deno JS for Supabase functions; Python may be used for data processing prototypes.

## Design Principles

- MVP must stay within the defined scope:
  - Multi-tenant orgs, clients, batch uploads, OCR, anomaly detection, review UI, exports.
  - No HMRC/ROS, no payroll CSV imports, no employee portal, no multi-country.

- Prioritise:
  - Clear separation of concerns (UI, API, processing).
  - Multi-tenancy safety (no cross-org data leaks).
  - Maintainability and testability of the rules engine.

## Coding Expectations

When generating or modifying code:

1. **Prefer clarity over cleverness.** Explicit, well-typed code is preferred.
2. **Respect boundaries:**
   - Frontend only calls Supabase APIs/Edge Functions; no direct DB access from the browser beyond Supabase client where appropriate.
   - Supabase functions own OCR calls and processing logic.
3. **Guard against scope creep.**
   - Do not add features not in MVP scope without explicit instruction.
4. **Multi-tenancy & security:**
   - Always filter data by `organisation_id`.
   - Use Supabase RLS where applicable.

## Files and Docs

- `architecture.md`: system and data architecture.
- `design.md`: UI/UX guidelines and screen definitions.
- `agent.md`: this file – behaviour of AI assistants.

Before making structural changes, read `architecture.md` and `design.md` to ensure alignment.
