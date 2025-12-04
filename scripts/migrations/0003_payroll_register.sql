-- 0003_payroll_register.sql
-- Payroll gross-to-net register ingestion

begin;

create table if not exists payroll_register_entries (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  batch_id uuid not null references batches(id) on delete cascade,
  employee_id uuid references employees(id) on delete set null,
  entry_type text not null default 'employee', -- employee or batch_total
  gross_pay numeric(14,2),
  net_pay numeric(14,2),
  paye numeric(14,2),
  usc_or_ni numeric(14,2),
  nic_employee numeric(14,2),
  nic_employer numeric(14,2),
  student_loan numeric(14,2),
  postgrad_loan numeric(14,2),
  source_file text,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_payroll_register_unique
  on payroll_register_entries (batch_id, employee_id, entry_type);

create index if not exists idx_payroll_register_batch on payroll_register_entries (batch_id);

commit;
