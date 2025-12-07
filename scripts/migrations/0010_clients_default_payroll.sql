-- 0010_clients_default_payroll.sql
-- Ensure clients.payroll_system defaults to "Unknown" to avoid NOT NULL violations

begin;

alter table if exists clients
  alter column payroll_system set default 'Unknown';

update clients
  set payroll_system = 'Unknown'
  where payroll_system is null;

commit;

