# Edge Functions

This document tracks the Supabase Edge Functions that backoffice services rely on to avoid duplication and clarify responsibilities.

## `create-processing-jobs`
- **Location**: `supabase/functions/create-processing-jobs/index.ts`
- **Purpose**: After a batch upload completes, enumerate files in `batches/{batchId}` and create one `processing_jobs` row per file. Jobs are created with `status = 'pending'`, and the batch is marked `processing`.
- **Inputs**: JSON body `{ "batch_id": "..." }` plus the caller’s Supabase session (Bearer token + publishable key).
- **Side Effects**:
  - Lists files inside the private payslips bucket.
  - Inserts rows into `processing_jobs`.
  - Updates `batches.status` to `processing`.
  - Returns `{ created: number }`.

## `process_batch`
- **Location**: `supabase/functions/process_batch/index.ts`
- **Purpose**: Cron-triggered worker that picks up pending jobs, downloads each PDF, runs AWS Textract OCR, normalises the result, inserts placeholder payslips/issues, and advances batch state.
- **Inputs**: No body required; invoked on a schedule with service role credentials. Env vars: `JOB_PROCESSOR_BATCH_SIZE`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`.
- **Side Effects**:
  - Selects `processing_jobs` with `status = 'pending'`, marks them `processing`, and processes up to `JOB_PROCESSOR_BATCH_SIZE`.
  - Downloads each file from Storage, calls AWS Textract, normalises output (see `normalizeTextractResponse`), upserts employees, inserts rows into `payslips`, and logs informational `issues`.
  - Updates `processing_jobs.status` to `completed`/`failed` and increments `batches.processed_files`, marking batches `completed` when all files are handled.
  - Returns a summary `{ processed, completed, failed }`.

## `batch-issues-csv`
- **Location**: `supabase/functions/batch-issues-csv/index.ts`
- **Purpose**: Generates a CSV export of all issues associated with a batch so reviewers can download/share them.
- **Inputs**: `GET` request with query parameter `batch_id` plus the caller’s Supabase session (Bearer token + publishable key). Requires the caller to belong to the same organisation as the batch.
- **Side Effects**:
  - Validates the authenticated user’s profile and organisation.
  - Fetches `issues` joined with `employees` for the requested batch.
  - Serialises the dataset via `buildBatchIssuesCsv` and responds with a `text/csv` attachment (`batch-{id}-issues.csv`).

 