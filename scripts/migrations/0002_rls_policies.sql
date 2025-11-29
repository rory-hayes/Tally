-- 0002_rls_policies.sql
-- Enables RLS and enforces organisation-level isolation.

begin;

create or replace function public.current_user_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organisation_id
  from profiles
  where id = auth.uid();
$$;

grant execute on function public.current_user_org_id() to authenticated;

alter table organisations enable row level security;
alter table profiles enable row level security;
alter table clients enable row level security;
alter table batches enable row level security;
alter table employees enable row level security;
alter table payslips enable row level security;
alter table issues enable row level security;
alter table audit_logs enable row level security;

create policy org_members_select_organisations
  on organisations
  for select
  to authenticated
  using (
    auth.uid() is not null
    and id = public.current_user_org_id()
  );

create policy org_members_manage_profiles
  on profiles
  for all
  to authenticated
  using (
    auth.uid() is not null
    and organisation_id = public.current_user_org_id()
  )
  with check (
    auth.uid() is not null
    and organisation_id = public.current_user_org_id()
  );

create policy org_members_manage_clients
  on clients
  for all
  to authenticated
  using (
    auth.uid() is not null
    and organisation_id = public.current_user_org_id()
  )
  with check (
    auth.uid() is not null
    and organisation_id = public.current_user_org_id()
  );

create policy org_members_manage_batches
  on batches
  for all
  to authenticated
  using (
    auth.uid() is not null
    and organisation_id = public.current_user_org_id()
  )
  with check (
    auth.uid() is not null
    and organisation_id = public.current_user_org_id()
  );

create policy org_members_manage_employees
  on employees
  for all
  to authenticated
  using (
    auth.uid() is not null
    and organisation_id = public.current_user_org_id()
  )
  with check (
    auth.uid() is not null
    and organisation_id = public.current_user_org_id()
  );

create policy org_members_manage_payslips
  on payslips
  for all
  to authenticated
  using (
    auth.uid() is not null
    and organisation_id = public.current_user_org_id()
  )
  with check (
    auth.uid() is not null
    and organisation_id = public.current_user_org_id()
  );

create policy org_members_manage_issues
  on issues
  for all
  to authenticated
  using (
    auth.uid() is not null
    and organisation_id = public.current_user_org_id()
  )
  with check (
    auth.uid() is not null
    and organisation_id = public.current_user_org_id()
  );

create policy org_members_manage_audit_logs
  on audit_logs
  for all
  to authenticated
  using (
    auth.uid() is not null
    and organisation_id = public.current_user_org_id()
  )
  with check (
    auth.uid() is not null
    and organisation_id = public.current_user_org_id()
  );

commit;

