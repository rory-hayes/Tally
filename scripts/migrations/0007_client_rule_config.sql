begin;

create table if not exists client_rule_config (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_rule_config_org_client_unique unique (organisation_id, client_id)
);

commit;

