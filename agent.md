# agent.md – Tally AI Assistant Instructions

## Project Overview

Tally is a B2B SaaS application for accounting practices and payroll bureaus in Ireland and the UK.

The product automatically analyses payslips, detects anomalies, compares against prior periods, and produces audit-ready reports. It is **not** a payroll processing engine – it sits on top of existing payroll systems as a verification layer.

The core MVP flow is:

1. Practice user logs in.
2. Selects a client and creates a payroll batch.
3. Uploads payslips (PDFs / ZIP).
4. Background process extracts and normalises data.
5. Rules engine generates anomalies/issues.
6. User reviews issues in a dashboard and exports a report.

Post-MVP work (tracked in the rules-engine roadmap) extends the rules engine with:
- Country/year-aware tax packs for IE/UK.
- Additional reconciliations (gross-to-net, GL, bank, submissions).
- Per-client rule configuration.

## Tech Stack (MVP)

- Frontend: Next.js (React), deployed on Vercel.
- UI: Ant Design (antd).
- Backend/Data: Supabase (Postgres, Auth, Storage, Edge Functions).
- OCR: External OCR API (e.g. AWS Textract or similar) called from Edge Functions.
- Language:
  - TypeScript for frontend and shared logic.
  - Deno TypeScript/JS for Supabase Edge Functions.
  - Python may be used for isolated data-processing prototypes (not in production path).

## Design Principles

- MVP must stay within the defined scope unless explicitly working on the rules-engine roadmap:
  - Multi-tenant orgs, clients, batch uploads, OCR, anomaly detection, review UI, exports.
  - No HMRC/ROS API integrations, no payroll CSV imports, no employee portal, no multi-country outside IE/UK.

- Prioritise:
  - Clear separation of concerns (UI, API/Edge Functions, pure logic modules).
  - Multi-tenancy safety (no cross-org data leaks).
  - Maintainability and testability of the rules engine (pure functions where possible).
  - TDD: new behaviour should be introduced with tests first or alongside implementation.

## Coding Expectations

When generating or modifying code:

1. **Prefer clarity over cleverness.**  
   - Explicit, well-typed code is preferred over clever one-liners.
   - Favour small, composable modules.

2. **Respect boundaries:**
   - Frontend:
     - Only uses Supabase client (anon key) and public Edge Function endpoints.
     - No direct access to service keys or secrets.
   - Edge Functions:
     - Own OCR calls (Textract) and batch processing.
     - Are the only place AWS credentials are used.
   - Pure logic modules:
     - No Supabase, no network calls, no side effects.
     - Used for diff calculations, rules, and normalisation.

3. **Guard against scope creep:**
   - Do not add new features or integrate new systems beyond what is explicitly requested in:
     - `MVP` roadmap, or
     - `rules-engine` roadmap (G1/G2/G3/G4 tasks).
   - If in doubt, propose a new roadmap item instead of implementing ad-hoc.

4. **Multi-tenancy & security:**
   - Always filter data by `organisation_id` and `client_id` where applicable.
   - Use Supabase Row-Level Security (RLS) to enforce access on the database side.
   - Never expose service keys or AWS credentials to the frontend bundle.

5. **Error handling & logging:**
   - Do not swallow errors silently; log with enough context to debug (job id, batch id, client id).
   - In pipelines:
     - Catch per-job errors and mark jobs/batches as failed with an error message.
   - Prefer structured logging where possible.

6. **Rules engine expectations:**
   - Rules should be pure functions taking a `RuleContext` and returning `IssueCandidate[]`.
   - Country/year-specific behaviour must be driven by config (not hard-coded values).
   - Calculations that replicate statutory logic (PAYE/USC/PRSI/NIC/Student Loans) must be backed by tests and golden examples.

7. **TDD & tests:**
   - For each substantial change, add:
     - Unit tests for pure logic functions.
     - Integration tests for pipelines or UI flows where relevant.
   - Keep tests deterministic and isolate external dependencies via mocking.

## Files and Docs

- `architecture.md`: system, data architecture, processing pipeline, and rules engine layout.
- `design.md`: UI/UX guidelines and screen definitions.
- `agent.md`: this file – behaviour and expectations for AI assistants.
- Roadmaps:
  - `roadmap.html`: MVP tasks and milestones.
  - `tally_rules_engine_roadmap.html`: post-MVP rules engine & reconciliation tasks.

Before making structural changes, read `architecture.md`, `design.md`, and the relevant roadmap to ensure alignment.
