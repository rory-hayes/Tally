-- 0002_contracts.sql
-- Adds employee contract/profile data to enrich rules context

begin;

create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  employee_id uuid not null references employees(id) on delete cascade,
  salary_amount numeric(14,2),
  salary_period text, -- annual, monthly, weekly
  hourly_rate numeric(14,2),
  standard_hours_per_week numeric(8,2),
  effective_from date,
  effective_to date,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id)
);

create index if not exists idx_contracts_org_employee on contracts (organisation_id, employee_id);

alter table if exists payslips
  add column if not exists nic_employee numeric(14,2),
  add column if not exists nic_employer numeric(14,2),
  add column if not exists student_loan numeric(14,2),
  add column if not exists postgrad_loan numeric(14,2);

commit;
