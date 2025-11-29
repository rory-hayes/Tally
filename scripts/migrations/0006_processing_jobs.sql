begin;

create type batch_status as enum ('pending', 'processing', 'completed', 'failed');

alter table batches
  alter column status type batch_status
  using status::batch_status;

create table if not exists processing_jobs (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  batch_id uuid not null references batches(id) on delete cascade,
  storage_path text not null,
  status batch_status not null default 'pending',
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists processing_jobs_batch_idx
  on processing_jobs (batch_id);

commit;

