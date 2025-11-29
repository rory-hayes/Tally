begin;

create or replace function public.create_organisation_for_current_user(
  in organisation_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  insert into organisations (name)
  values (organisation_name)
  returning id into new_org_id;

  insert into profiles (id, organisation_id, role)
  values (current_user_id, new_org_id, 'admin')
  on conflict (id) do update
    set organisation_id = excluded.organisation_id,
        role = excluded.role;

  return new_org_id;
end;
$$;

grant execute on function public.create_organisation_for_current_user(text)
  to authenticated;

commit;


