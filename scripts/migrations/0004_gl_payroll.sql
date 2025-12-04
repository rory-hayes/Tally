-- 0004_gl_payroll.sql
-- GL payroll postings ingestion and reconciliation

begin;

create table if not exists gl_payroll_postings (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  batch_id uuid not null references batches(id) on delete cascade,
  source_system text,
  wages numeric(14,2),
  employer_taxes numeric(14,2),
  pensions numeric(14,2),
  other numeric(14,2),
  currency text,
  source_file text,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_gl_payroll_unique on gl_payroll_postings (batch_id, client_id);

commit;
