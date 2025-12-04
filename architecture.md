# architecture.md – Tally Full Architecture (MVP + Rules Engine Extension)

## 1. High-Level Overview

Tally is a B2B SaaS platform for accountants and payroll bureaus in Ireland and the UK.  
It performs **automated payroll verification and reconciliation** by:

- Extracting structured data from payslip PDFs (OCR)
- Normalising the data into a consistent internal schema
- Comparing each payslip against prior periods
- Applying a rule engine (IE/UK tax rules + reconciliation rules)
- Generating human-readable issues and audit reports

Tally does **not** compute payroll — it verifies outputs from external payroll systems.

### Technology Summary

- **Frontend**: Next.js (React), Ant Design, deployed on Vercel  
- **Backend**: Supabase  
  - Postgres (application DB)
  - Auth (multi-tenant users)
  - Storage (payslips)
  - Edge Functions (OCR + pipeline + ingestion)
  - Cron jobs (background processing)
- **OCR**: AWS Textract (via Edge Functions)
- **Pure Logic Layer**:
  - Normalisation of OCR → internal schema  
  - Diff engine  
  - Rules engine (country/year aware)  
  - Reconciliation logic (post-MVP expansion)

The architecture is designed to scale from a lightweight MVP to a robust, enterprise-grade system capable of reconciling large payroll datasets and integrating multiple upstream sources (GL, RTI/ROS, bank files, etc.).

---

## 2. Multi-Tenancy Model

Tally is multi-tenant at the organisation → client → employee hierarchy.

- **Organisation**  
  Represents an accounting practice.  
  Each user belongs to exactly one organisation.

- **Client**  
  A company serviced by the accountant.  
  All batches, payslips, employees, issues belong to a client.

### Enforcement

- All tables contain `organisation_id` to enforce row-level scoping.
- Supabase **Row Level Security (RLS)** restricts all queries.
- Service-level logic in Edge Functions re-validates org ownership.

This ensures that:
- Organisations cannot access each other’s clients or data.
- Even malicious frontend modifications cannot bypass RLS.

---

## 3. Core Entities (MVP)

### organisations
- `id`
- `name`
- `created_at`

### users (profiles)
- `id` (Supabase auth)
- `organisation_id`
- `email`
- `role` (`admin`, `staff`)
- `created_at`

### clients
- `id`
- `organisation_id`
- `name`
- `country` (`IE`, `UK`)
- `payroll_system`
- `created_at`

### batches
- `id`
- `organisation_id`
- `client_id`
- `period_label` (e.g. "2025-04")
- `status` (`pending`, `processing`, `completed`, `failed`)
- `error` (nullable)
- `total_files`
- `processed_files`
- `created_at`
- `updated_at`
- `completed_at` (nullable)

### processing_jobs
(One row per payslip file)
- `id`
- `organisation_id`
- `client_id`
- `batch_id`
- `storage_path`
- `employee_id` (nullable until OCR resolves)
- `status` (`pending`, `processing`, `completed`, `failed`)
- `error` (nullable)
- `created_at`
- `updated_at`

### employees
- `id`
- `organisation_id`
- `client_id`
- `external_employee_ref`
- `name`
- `identifier_hash` (hashed PPS/NINO)
- `created_at`

### payslips
- `id`
- `organisation_id`
- `client_id`
- `batch_id`
- `employee_id`
- `pay_date`
- Financial fields:
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
  - `tax_code` (UK)
  - `prsi_or_ni_category`
- `raw_ocr_json` (JSONB)
- `storage_path`
- `created_at`

### issues
- `id`
- `organisation_id`
- `client_id`
- `batch_id`
- `employee_id`
- `payslip_id`
- `rule_code`
- `severity` (`critical`, `warning`, `info`)
- `description`
- `data` (JSONB structured evidence)
- `resolved` (bool)
- `resolved_by` (nullable)
- `resolved_at`
- `note`
- `created_at`

### audit_logs
Event logging for compliance & traceability.

---

## 4. Processing Pipeline

### Step 1 — Upload
- Frontend uploads PDFs to Supabase Storage.
- Batch created with `status="pending"`.

### Step 2 — Job Seeding
- `start_batch_processing(batchId)` enumerates uploaded files.
- Creates one `processing_jobs` row per PDF.

### Step 3 — Cron Pipeline (process_next_jobs)
For each pending job:
1. Download PDF bytes from Storage  
2. Call AWS Textract  
3. Normalise into internal schema  
4. Resolve employee identity  
5. Insert payslip  
6. Load previous payslip → calculate diff  
7. Run rules engine → create issues  
8. Update job status  
9. Increment batch progress

When all jobs complete → mark batch completed.

---

## 5. Rules Engine Architecture

The rules engine runs during pipeline processing after each payslip is inserted.

### Components

- **RuleRegistry**  
  A set of `RuleDefinition` objects:
  - `code`
  - `severity`
  - `categories`
  - `descriptionTemplate`
  - `appliesTo` (country + tax years)
  - `evaluate(context)`

- **RuleConfig**  
  - Thresholds (large change %, tolerances)
  - Client overrides
  - Default country/year settings

- **Jurisdiction Config**  
  - IE PAYE/USC/PRSI config per year  
  - UK PAYE/NIC/Student Loan config per year  

- **RuleContext**  
  Contains:
  - `country`
  - `taxYear`
  - `currentPayslip`
  - `previousPayslip`
  - `diff`
  - `config`
  - `contractProfile`
  - `registerRow`
  - `glSummary`
  - `bankPaymentRecord`
  - `submissionSummary`

### MVP Rules
- NET_CHANGE_LARGE  
- GROSS_CHANGE_LARGE  
- TAX_SPIKE_WITHOUT_GROSS  
- USC_SPIKE_WITHOUT_GROSS / NI_SPIKE  
- PRSI_OR_NI_CATEGORY_CHANGE  
- YTD_REGRESSION  
- PENSION_EMPLOYEE_HIGH  
- PENSION_EMPLOYER_HIGH  

### Extended Rules (Post-MVP)
(Defined fully in `tally_rules_engine_roadmap.html`)

- IE PAYE/USC/PRSI recalculation  
- UK PAYE/NIC/Student Loans recalculation  
- Contract compliance  
- Payroll register reconciliation  
- GL reconciliation  
- Bank reconciliation  
- ROS/RTI reconciliation  

---

## 6. Planned Entities (Post-MVP)

These support the extended reconciliation engine:

### client_rule_config
- Overrides for thresholds and rule packs.

### contracts / employee_profiles
- Salary/hourly info, standard hours, pension schemes, etc.

### payroll_register_entries
Gross-to-net report rows.

### gl_postings
Accounting system payroll postings.

### payment_records
Bank disbursement records (SEPA/BACS).

### ros_submission_summaries / rti_submission_summaries
Statutory submission totals (IE/UK).

---

## 7. Migration Path to AWS

When scale demands:

- Move Storage → S3  
- Replace Edge cron with SQS + Lambda workers  
- Replace Supabase Postgres → AWS RDS  
- Add internal API Gateway for private backend  

Architecture intentionally isolates the heavy work (OCR + rules) to make this easy.

