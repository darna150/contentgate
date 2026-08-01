-- Preserve the direct-update membership guard while allowing the validated
-- SECURITY DEFINER lifecycle RPC to perform its audited role update.
--
-- PostgREST executes an authenticated browser write as current_user
-- `authenticated`; the lifecycle RPC is owned by and executes as `postgres`.
-- Browser callers cannot SET ROLE to postgres. The RPC independently enforces
-- active admin, same tenant, AAL2, self-action, and last-admin controls before
-- reaching this trigger.

create or replace function public.protect_profile_membership_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'Profile id cannot be changed';
  end if;

  if (
    new.org_id is distinct from old.org_id
    or new.role is distinct from old.role
  )
    and coalesce((select auth.jwt() ->> 'role'), '') <> 'service_role'
    and current_user <> 'postgres'
  then
    raise exception 'Only trusted server actions may change profile org or role';
  end if;

  return new;
end;
$$;
