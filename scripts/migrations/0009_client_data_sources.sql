-- 0009_client_data_sources.sql
-- Adds client-level data source mappings, batch-level file tracking, rule config snapshots, and batch metadata fields.

begin;

-- Extend batches with pay_date, frequency, and selected rule packs snapshot
alter table if exists batches
  add column if not exists pay_date date,
  add column if not exists pay_frequency text,
  add column if not exists selected_rule_packs jsonb default '[]'::jsonb;

-- Client-level data source mappings
create table if not exists client_data_sources (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  type text not null,
  template_name text,
  mapping_config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_data_sources_unique unique (organisation_id, client_id, type)
);

create index if not exists idx_client_data_sources_client on client_data_sources (client_id);

-- Batch-level uploaded files (payslips and monthly artefacts)
create table if not exists batch_data_files (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  batch_id uuid not null references batches(id) on delete cascade,
  type text not null,
  storage_path text not null,
  original_filename text,
  uploaded_at timestamptz not null default now(),
  parsed_status text not null default 'pending',
  parsed_error text,
  meta jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_batch_data_files_batch on batch_data_files (batch_id);
create index if not exists idx_batch_data_files_type on batch_data_files (type);

-- Batch rule configuration snapshot for reproducibility
create table if not exists batch_rule_config_snapshot (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  batch_id uuid not null references batches(id) on delete cascade,
  country text,
  rule_pack_ids jsonb not null default '[]'::jsonb,
  resolved_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint batch_rule_config_snapshot_unique unique (batch_id)
);

create index if not exists idx_batch_rule_config_snapshot_batch on batch_rule_config_snapshot (batch_id);

commit;
