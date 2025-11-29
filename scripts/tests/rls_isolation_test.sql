-- rls_isolation_test.sql
-- Verifies that users from different organisations cannot read each other's rows.

begin;

insert into organisations (id, name)
values
  ('11111111-1111-1111-1111-111111111111', 'Org Alpha'),
  ('22222222-2222-2222-2222-222222222222', 'Org Beta')
on conflict (id) do nothing;

insert into auth.users (id, email, aud, role, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'alpha@example.com', 'authenticated', 'authenticated', '{}'::jsonb, '{"provider":"email","providers":["email"]}'::jsonb, now(), now()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'beta@example.com', 'authenticated', 'authenticated', '{}'::jsonb, '{"provider":"email","providers":["email"]}'::jsonb, now(), now())
on conflict (id) do nothing;

insert into profiles (id, organisation_id, role)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'staff')
on conflict (id) do nothing;

insert into clients (id, organisation_id, name, country, payroll_system)
values
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Alpha Client', 'IE', 'Sage'),
  ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'Beta Client', 'UK', 'BrightPay')
on conflict (id) do nothing;

-- Simulate user from Org Alpha.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
select set_config('request.jwt.claims', json_build_object('sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')::text, true);

select 'alpha_visible_clients' as label,
       coalesce(json_agg(name order by name), '[]'::json) as clients
from clients;

-- Switch session to Org Beta user.
select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);
select set_config('request.jwt.claims', json_build_object('sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')::text, true);

select 'beta_visible_clients' as label,
       coalesce(json_agg(name order by name), '[]'::json) as clients
from clients;

rollback;

