-- 0005_payments.sql
-- Bank payment files ingestion for payroll net pay validation

begin;

create table if not exists payment_files (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  batch_id uuid not null references batches(id) on delete cascade,
  source_system text,
  file_name text,
  created_at timestamptz not null default now()
);

create table if not exists payment_records (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  batch_id uuid not null references batches(id) on delete cascade,
  payment_file_id uuid references payment_files(id) on delete cascade,
  employee_id uuid references employees(id) on delete set null,
  employee_ref text,
  amount numeric(14,2),
  currency text,
  reference text,
  created_at timestamptz not null default now()
);

create index if not exists idx_payment_records_batch on payment_records (batch_id);
create index if not exists idx_payment_records_employee on payment_records (employee_id);

commit;
