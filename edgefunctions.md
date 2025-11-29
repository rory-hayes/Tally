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

## `process-ocr-jobs`
- **Location**: `supabase/functions/process-ocr-jobs/index.ts`
- **Purpose**: Cron-triggered worker that picks up pending jobs, downloads each PDF, runs OCR, normalises the result, inserts payslips, and advances batch state.
- **Inputs**: No body required; invoked on a schedule with service role credentials. Optional env vars: `JOB_PROCESSOR_BATCH_SIZE`, `OCR_API_URL`, `OCR_API_KEY`.
- **Side Effects**:
  - Selects `processing_jobs` with `status = 'pending'`, marks them `processing`, and processes up to `JOB_PROCESSOR_BATCH_SIZE`.
  - Downloads each file from Storage, calls the OCR endpoint (or stub), normalises output, upserts employees, and inserts rows into `payslips`.
  - Updates `processing_jobs.status` to `completed`/`failed` and increments `batches.processed_files`, marking batches `completed` when all files are handled.
  - Returns a summary `{ processed, completed, failed }`.

 