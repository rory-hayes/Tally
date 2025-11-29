# architecture.md – Tally MVP Architecture

## 1. High-Level Overview

Tally MVP uses:

- **Frontend**: Next.js (React), hosted on Vercel.
- **Backend & Data**: Supabase:
  - Postgres (core data store).
  - Auth (user accounts).
  - Storage (payslip PDFs).
  - Edge Functions + cron (processing pipeline).
- **External Services**:
  - OCR API (e.g. AWS Textract or equivalent).

All core application data (organisations, clients, batches, payslips, issues) lives in Supabase Postgres. The OCR layer is stateless and can be swapped out.

## 2. Multi-Tenancy Model

- `organisations` table represents a practice or bureau.
- Each `user` belongs to exactly one `organisation` (MVP).
- Each `client` belongs to exactly one `organisation`.
- All downstream entities (`batches`, `employees`, `payslips`, `issues`) are scoped to a `client` and ultimately to an `organisation`.

Multi-tenancy is enforced via:

- Explicit `organisation_id` columns on all relevant tables.
- Supabase Row-Level Security policies restricting access by `organisation_id`.
- Backend logic always filtering by `organisation_id` derived from the authenticated user.

## 3. Core Entities (Tables)

**organisations**
- `id`
- `name`
- `created_at`

**users**
- Supabase auth user.
- `id`
- `organisation_id`
- `role` (`admin`, `staff`)
- `created_at`

**clients**
- `id`
- `organisation_id`
- `name`
- `country` (`IE`, `UK`)
- `payroll_system` (string)
- `created_at`

**batches**
- `id`
- `organisation_id`
- `client_id`
- `period_label` (e.g., `2025-04`, or free text)
- `storage_path` (text, path to original upload)
- `status` (`pending`, `processing`, `completed`, `failed`)
- `error` (text, nullable)
- `created_at`
- `updated_at`
- `status` (`pending`, `processing`, `completed`, `failed`)
- `total_files`
- `processed_files`
- `created_at`
- `completed_at` (nullable)

**employees**
- `id`
- `organisation_id`
- `client_id`
- `external_employee_ref` (payroll system ID if available)
- `name`
- `identifier_hash` (e.g. hashed PPS/NINO if used)
- `created_at`

**payslips**
- `id`
- `organisation_id`
- `client_id`
- `batch_id`
- `employee_id`
- `pay_date`
- `gross_pay`
- `net_pay`
- `paye`
- `usc_or_ni`
- `pension_employee`
- `pension_employer`
- `ytd_gross`
- `ytd_net`
- `ytd_tax`
- `ytd_usc_or_ni`
- `tax_code`
- `prsi_or_ni_category`
- `raw_ocr_json` (JSONB, optional)
- `storage_path` (S3/Supabase path to original file)
- `created_at`

**issues**
- `id`
- `organisation_id`
- `client_id`
- `batch_id`
- `employee_id`
- `payslip_id`
- `rule_code` (e.g. `NET_CHANGE_LARGE`)
- `severity` (`critical`, `warning`, `info`)
- `description`
- `resolved` (bool)
- `resolved_by` (user id, nullable)
- `resolved_at` (nullable)
- `note` (text, nullable)
- `created_at`

**audit_logs**
- `id`
- `organisation_id`
- `user_id`
- `action` (e.g. `UPLOAD_BATCH`, `RESOLVE_ISSUE`)
- `metadata` (JSONB)
- `created_at`

## 4. Processing Pipeline (MVP)

1. **Upload**
   - Frontend obtains a Storage signed URL from Supabase or uses Supabase client SDK.
   - Files are uploaded to a private bucket (`payslips`) under a `batch`-specific prefix.

2. **Batch Creation**
   - A `batch` row is created with `status = 'pending'`, `total_files` set.

3. **Processing Trigger**
   - A Supabase Edge Function `start_batch_processing` is called once upload completes.
   - It enumerates files for the batch and inserts one row per file into a `processing_jobs` table or processes sequentially.

4. **Processing Execution**
   - A cron-triggered Edge Function `process_next_jobs` runs periodically.
   - For each pending job:
     - Downloads file from Storage.
     - Calls OCR API.
     - Parses and normalises fields.
     - Resolves/creates `employee`.
     - Inserts `payslips` row.
     - Runs rules to create `issues`.
     - Updates job and `batches.processed_files`.

5. **Completion**
   - When `processed_files == total_files`, `batches.status` is set to `completed` (or `failed` if errors > threshold).

## 5. Frontend–Backend Interaction

- Auth: Frontend uses Supabase Auth.
- Data access:
  - For simple reads, frontend may use Supabase client directly (subject to RLS).
  - For complex flows (upload, processing triggers), frontend calls Supabase Edge Functions via HTTP.

Endpoints / functions (MVP):

- `start_batch_processing(batch_id)`: trigger processing.
- `get_batch_summary(batch_id)`: aggregated counts and basic metrics (or built from client-side queries).
- `generate_batch_report(batch_id)`: returns data to render/download as CSV/PDF.

## 6. Migration Path to AWS

When scale or complexity demands:

- Move storage for payslips from Supabase Storage → AWS S3.
- Replace cron-based job processing with SQS + Lambda workers.
- Keep Supabase for auth and application data until RDS is needed.
- Introduce a dedicated API (AWS Lambda/ECS) in front of the database if required.

This design assumes the processing layer is stateless and can be migrated without changing the frontend contracts.
