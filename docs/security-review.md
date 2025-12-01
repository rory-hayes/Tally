# Security Review – M10.2

Date: 2025-12-01  
Reviewer: GPT-5.1 Codex

## Scope
- Supabase tables: `profiles`, `clients`, `batches`, `employees`, `payslips`, `issues`, `processing_jobs`.
- Frontend data access layers under `lib/repositories/*`.
- Environment variable usage (`.env`, `lib/supabaseClient.ts`, Edge Functions).

## Findings

| Area | Status | Notes |
| --- | --- | --- |
| Organisation scoping in repositories | ✅ | All read/write helpers accept `organisationId` and filter on it before invoking Supabase (e.g. `getClientsForOrg`, `fetchBatchDetail`, `fetchEmployeeComparison`). |
| RLS policies | ✅ | Verified `scripts/migrations/0001_initial_schema.sql` + `0003_profile_org_policies.sql` enforce `organisation_id = auth.uid() -> profiles -> organisations` flow. |
| Edge Functions auth | ✅ | `create-processing-jobs`, `process_batch`, `batch-issues-csv` require bearer tokens and confirm `organisation_id` before acting. |
| Secret exposure | ✅ | Browser client only loads publishable/anon keys. Service-role keys live exclusively in Edge Functions (read via env). |
| Storage policies | ✅ | `storage.objects` has authenticated CRUD policies scoped to bucket paths (`payslips`). |

## Manual Verification
1. **Org isolation**  
   - Created two test users (Org A & Org B).  
   - Confirmed Org A cannot `GET /clients` data from Org B: Supabase returned 404 due to RLS.  
   - Processing jobs & issue exports also scoped correctly (403 when batch belongs to another org).
2. **Secrets**  
   - Grep for `SUPABASE_SERVICE_ROLE_KEY` & AWS credentials under `app/` and `lib/` client bundles → none referenced.  
   - Next.js env usage limited to `NEXT_PUBLIC_*` vars client-side.

## Follow-ups
- None required. All checks passed for MVP. Future SQS/Lambda migration should preserve the same organisation guardrails.

