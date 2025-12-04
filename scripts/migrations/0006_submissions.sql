-- 0006_submissions.sql
-- Submission summaries for ROS (IE) and RTI (UK)

begin;

create table if not exists ros_submission_summaries (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  batch_id uuid not null references batches(id) on delete cascade,
  tax_year integer,
  paye_total numeric(14,2),
  usc_total numeric(14,2),
  employee_count integer,
  source_file text,
  created_at timestamptz not null default now()
);

create table if not exists rti_submission_summaries (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  batch_id uuid not null references batches(id) on delete cascade,
  tax_year integer,
  paye_total numeric(14,2),
  ni_total numeric(14,2),
  employee_count integer,
  source_file text,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_ros_submission_unique on ros_submission_summaries (batch_id, client_id);
create unique index if not exists idx_rti_submission_unique on rti_submission_summaries (batch_id, client_id);

commit;
