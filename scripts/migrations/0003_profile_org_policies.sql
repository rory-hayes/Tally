begin;

drop policy if exists create_organisations_as_authenticated on organisations;

create policy create_organisations_as_authenticated
  on organisations
  for insert
  to authenticated
  with check (auth.uid() is not null);

drop policy if exists self_profile_create on profiles;

create policy self_profile_create
  on profiles
  for insert
  to authenticated
  with check (id = auth.uid());

commit;

