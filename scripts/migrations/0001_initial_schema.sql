-- 0001_initial_schema.sql
-- Core Tally entities derived from architecture.md

begin;

create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'country_code') then
    create type country_code as enum ('IE', 'UK');
  end if;

  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('admin', 'staff');
  end if;

  if not exists (select 1 from pg_type where typname = 'batch_status') then
    create type batch_status as enum ('pending', 'processing', 'completed', 'failed');
  end if;

  if not exists (select 1 from pg_type where typname = 'issue_severity') then
    create type issue_severity as enum ('critical', 'warning', 'info');
  end if;
end$$;

create table if not exists organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key,
  organisation_id uuid not null references organisations(id) on delete restrict,
  role user_role not null default 'staff',
  created_at timestamptz not null default now(),
  constraint profiles_auth_fk
    foreign key (id) references auth.users(id) on delete cascade
);

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  name text not null,
  country country_code not null,
  payroll_system text not null,
  created_at timestamptz not null default now()
);

create table if not exists batches (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  period_label text not null,
  status batch_status not null default 'pending',
  total_files integer not null default 0 check (total_files >= 0),
  processed_files integer not null default 0 check (processed_files >= 0),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  external_employee_ref text,
  name text not null,
  identifier_hash text,
  created_at timestamptz not null default now()
);

create table if not exists payslips (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  batch_id uuid not null references batches(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  pay_date date not null,
  gross_pay numeric(14,2),
  net_pay numeric(14,2),
  paye numeric(14,2),
  usc_or_ni numeric(14,2),
  pension_employee numeric(14,2),
  pension_employer numeric(14,2),
  ytd_gross numeric(14,2),
  ytd_net numeric(14,2),
  ytd_tax numeric(14,2),
  ytd_usc_or_ni numeric(14,2),
  tax_code text,
  prsi_or_ni_category text,
  raw_ocr_json jsonb,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create table if not exists issues (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  batch_id uuid not null references batches(id) on delete cascade,
  employee_id uuid references employees(id) on delete set null,
  payslip_id uuid references payslips(id) on delete set null,
  rule_code text not null,
  severity issue_severity not null,
  description text not null,
  resolved boolean not null default false,
  resolved_by uuid references profiles(id) on delete set null,
  resolved_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  action text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_profiles_org on profiles (organisation_id);
create index if not exists idx_clients_org on clients (organisation_id);
create index if not exists idx_batches_org_client on batches (organisation_id, client_id);
create index if not exists idx_employees_org_client on employees (organisation_id, client_id);
create index if not exists idx_payslips_batch on payslips (batch_id);
create index if not exists idx_payslips_employee on payslips (employee_id);
create index if not exists idx_issues_batch on issues (batch_id);
create index if not exists idx_issues_employee on issues (employee_id);
create index if not exists idx_audit_logs_org on audit_logs (organisation_id);

commit;

