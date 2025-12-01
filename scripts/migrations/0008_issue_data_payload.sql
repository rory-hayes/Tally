begin;

alter table issues
  add column if not exists data jsonb;

commit;

