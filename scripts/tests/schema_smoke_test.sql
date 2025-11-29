-- Simple smoke test to verify core tables exist and are queryable.
select 'organisations' as table_name, to_regclass('public.organisations') is not null as exists;
select 'profiles' as table_name, to_regclass('public.profiles') is not null as exists;
select 'clients' as table_name, to_regclass('public.clients') is not null as exists;
select 'batches' as table_name, to_regclass('public.batches') is not null as exists;
select 'employees' as table_name, to_regclass('public.employees') is not null as exists;
select 'payslips' as table_name, to_regclass('public.payslips') is not null as exists;
select 'issues' as table_name, to_regclass('public.issues') is not null as exists;
select 'audit_logs' as table_name, to_regclass('public.audit_logs') is not null as exists;

-- Example no-op query per entity for runtime validation (will return zero rows on fresh DB).
select count(*) as organisation_count from organisations;
select count(*) as profile_count from profiles;
select count(*) as client_count from clients;
select count(*) as batch_count from batches;
select count(*) as employee_count from employees;
select count(*) as payslip_count from payslips;
select count(*) as issue_count from issues;
select count(*) as audit_log_count from audit_logs;

