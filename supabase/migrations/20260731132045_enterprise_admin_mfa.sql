-- Enterprise-beta administrator MFA enforcement.
--
-- Existing organizations remain opt-in to avoid locking out their current
-- administrators before enrollment. Newly created organizations default to
-- enforcement. Once enabled, auth_role() deliberately degrades an AAL1 admin
-- to member capability so every existing admin-specific RLS policy also
-- becomes MFA-aware without widening browser privileges.

alter table public.organizations
  add column if not exists require_admin_mfa boolean;

update public.organizations
set require_admin_mfa = false
where require_admin_mfa is null;

alter table public.organizations
  alter column require_admin_mfa set default true,
  alter column require_admin_mfa set not null;

create or replace function public.auth_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when profile.role = 'admin'::public.user_role
      and organization.require_admin_mfa
      and coalesce((select auth.jwt() ->> 'aal'), 'aal1') <> 'aal2'
      then 'member'::public.user_role
    else profile.role
  end
  from public.profiles as profile
  join public.organizations as organization on organization.id = profile.org_id
  where profile.id = (select auth.uid())
$$;

create or replace function public.auth_admin_mfa_satisfied()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select profile.role = 'admin'::public.user_role
        and (
          not organization.require_admin_mfa
          or coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
        )
      from public.profiles as profile
      join public.organizations as organization on organization.id = profile.org_id
      where profile.id = (select auth.uid())
    ),
    false
  )
$$;

revoke execute on function public.auth_role() from public, anon;
revoke execute on function public.auth_admin_mfa_satisfied() from public, anon, service_role;
grant execute on function public.auth_role() to authenticated;
grant execute on function public.auth_admin_mfa_satisfied() to authenticated;

grant select (require_admin_mfa) on table public.organizations to authenticated;

create or replace function public.enable_admin_mfa_requirement()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_org_id uuid;
begin
  if actor_id is null then
    raise exception 'authentication required';
  end if;
  if coalesce((select auth.jwt() ->> 'aal'), 'aal1') <> 'aal2' then
    raise exception 'administrator MFA verification is required';
  end if;

  select profile.org_id into target_org_id
  from public.profiles as profile
  where profile.id = actor_id
    and profile.role = 'admin'::public.user_role;

  if target_org_id is null then
    raise exception 'administrator access is required';
  end if;

  update public.organizations
  set require_admin_mfa = true
  where id = target_org_id;

  insert into public.audit_log (
    org_id, actor_id, action, entity_type, entity_id, detail
  ) values (
    target_org_id,
    actor_id,
    'admin_mfa_required',
    'organization',
    target_org_id,
    jsonb_build_object('required', true)
  );

  return true;
end;
$$;

revoke all on function public.enable_admin_mfa_requirement()
  from public, anon, service_role;
grant execute on function public.enable_admin_mfa_requirement()
  to authenticated;
