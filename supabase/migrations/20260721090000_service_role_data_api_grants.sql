-- Explicit Data API grants for service_role.
--
-- Newer Supabase environments no longer grant Data API roles automatically
-- (the same change that motivated the explicit `authenticated` grants in
-- 20260720123000_phase1a_tenant_integrity). Production predates the change,
-- so service_role still works there via legacy default privileges — but any
-- freshly created environment (local stack, QA project) leaves service_role
-- without table access, breaking every server action that uses the admin
-- client. Grant explicitly so environments behave identically.

grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to service_role;

-- Approval history stays append-only through security-definer RPCs; the
-- deliberate revoke from 20260713113241_complete_approval_history must
-- survive the blanket grant above.
revoke all on public.generated_content_revisions from service_role;
revoke all on public.generated_content_events from service_role;
