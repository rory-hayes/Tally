begin;

alter table batches
  add column if not exists notes text;

commit;


