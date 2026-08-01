-- Enterprise-beta member lifecycle controls.
--
-- A Supabase Auth ban prevents future sign-in and refresh, but an already
-- issued access-token JWT remains valid until its expiry. access_status is
-- therefore the immediate authorization kill switch: the two shared RLS
-- helpers return null for disabled profiles, removing all tenant capability
-- even while an old JWT is still cryptographically valid.

alter table public.profiles
  add column access_status text,
  add column disabled_at timestamptz,
  add column disabled_by uuid references public.profiles(id) on delete set null;

update public.profiles
set access_status = 'active'
where access_status is null;

alter table public.profiles
  alter column access_status set default 'active',
  alter column access_status set not null,
  add constraint profiles_access_status_check
    check (access_status in ('active', 'disabled')),
  add constraint profiles_disabled_state_check
    check (
      (access_status = 'active' and disabled_at is null and disabled_by is null)
      or
      (access_status = 'disabled' and disabled_at is not null and disabled_by is not null)
    );

create index profiles_org_access_role_idx
  on public.profiles (org_id, access_status, role);

create or replace function public.auth_org_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select profile.org_id
  from public.profiles as profile
  where profile.id = (select auth.uid())
    and profile.access_status = 'active'
$$;

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
    and profile.access_status = 'active'
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
        and profile.access_status = 'active'
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

revoke execute on function public.auth_org_id() from public, anon;
revoke execute on function public.auth_role() from public, anon;
revoke execute on function public.auth_admin_mfa_satisfied()
  from public, anon, service_role;
grant execute on function public.auth_org_id() to authenticated;
grant execute on function public.auth_role() to authenticated;
grant execute on function public.auth_admin_mfa_satisfied() to authenticated;

create or replace function public.admin_change_member_role(
  target_profile_id uuid,
  target_role public.user_role
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_profile public.profiles%rowtype;
  target_profile public.profiles%rowtype;
  active_admin_count integer;
begin
  if actor_id is null then
    raise exception 'authentication required';
  end if;
  if coalesce((select auth.jwt() ->> 'aal'), 'aal1') <> 'aal2' then
    raise exception 'administrator MFA verification is required';
  end if;

  select * into actor_profile
  from public.profiles
  where id = actor_id
    and role = 'admin'::public.user_role
    and access_status = 'active';

  if actor_profile.id is null then
    raise exception 'active administrator access is required';
  end if;
  if target_profile_id = actor_id then
    raise exception 'administrators cannot change their own role';
  end if;

  perform 1
  from public.organizations
  where id = actor_profile.org_id
  for update;

  select * into target_profile
  from public.profiles
  where id = target_profile_id
    and org_id = actor_profile.org_id
  for update;

  if target_profile.id is null then
    raise exception 'member not found in this workspace';
  end if;
  if target_profile.access_status <> 'active' then
    raise exception 'restore the member before changing their role';
  end if;
  if target_profile.role = target_role then
    return true;
  end if;

  if target_profile.role = 'admin'::public.user_role
    and target_role <> 'admin'::public.user_role then
    select count(*) into active_admin_count
    from public.profiles
    where org_id = actor_profile.org_id
      and role = 'admin'::public.user_role
      and access_status = 'active';
    if active_admin_count <= 1 then
      raise exception 'the workspace must retain at least one active administrator';
    end if;
  end if;

  update public.profiles
  set role = target_role
  where id = target_profile.id;

  insert into public.audit_log (
    org_id, actor_id, action, entity_type, entity_id, detail
  ) values (
    actor_profile.org_id,
    actor_id,
    'member_role_changed',
    'profile',
    target_profile.id,
    jsonb_build_object(
      'previous_role', target_profile.role,
      'new_role', target_role
    )
  );

  return true;
end;
$$;

create or replace function public.admin_disable_member(target_profile_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_profile public.profiles%rowtype;
  target_profile public.profiles%rowtype;
  active_admin_count integer;
begin
  if actor_id is null then
    raise exception 'authentication required';
  end if;
  if coalesce((select auth.jwt() ->> 'aal'), 'aal1') <> 'aal2' then
    raise exception 'administrator MFA verification is required';
  end if;

  select * into actor_profile
  from public.profiles
  where id = actor_id
    and role = 'admin'::public.user_role
    and access_status = 'active';

  if actor_profile.id is null then
    raise exception 'active administrator access is required';
  end if;
  if target_profile_id = actor_id then
    raise exception 'administrators cannot disable their own account';
  end if;

  perform 1
  from public.organizations
  where id = actor_profile.org_id
  for update;

  select * into target_profile
  from public.profiles
  where id = target_profile_id
    and org_id = actor_profile.org_id
  for update;

  if target_profile.id is null then
    raise exception 'member not found in this workspace';
  end if;
  if target_profile.access_status = 'disabled' then
    return true;
  end if;

  if target_profile.role = 'admin'::public.user_role then
    select count(*) into active_admin_count
    from public.profiles
    where org_id = actor_profile.org_id
      and role = 'admin'::public.user_role
      and access_status = 'active';
    if active_admin_count <= 1 then
      raise exception 'the workspace must retain at least one active administrator';
    end if;
  end if;

  update public.profiles
  set access_status = 'disabled',
      disabled_at = statement_timestamp(),
      disabled_by = actor_id
  where id = target_profile.id;

  insert into public.audit_log (
    org_id, actor_id, action, entity_type, entity_id, detail
  ) values (
    actor_profile.org_id,
    actor_id,
    'member_disabled',
    'profile',
    target_profile.id,
    jsonb_build_object('role', target_profile.role)
  );

  return true;
end;
$$;

create or replace function public.admin_restore_member(target_profile_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_profile public.profiles%rowtype;
  target_profile public.profiles%rowtype;
begin
  if actor_id is null then
    raise exception 'authentication required';
  end if;
  if coalesce((select auth.jwt() ->> 'aal'), 'aal1') <> 'aal2' then
    raise exception 'administrator MFA verification is required';
  end if;

  select * into actor_profile
  from public.profiles
  where id = actor_id
    and role = 'admin'::public.user_role
    and access_status = 'active';

  if actor_profile.id is null then
    raise exception 'active administrator access is required';
  end if;
  if target_profile_id = actor_id then
    raise exception 'the current administrator is already active';
  end if;

  perform 1
  from public.organizations
  where id = actor_profile.org_id
  for update;

  select * into target_profile
  from public.profiles
  where id = target_profile_id
    and org_id = actor_profile.org_id
  for update;

  if target_profile.id is null then
    raise exception 'member not found in this workspace';
  end if;
  if target_profile.access_status = 'active' then
    return true;
  end if;

  update public.profiles
  set access_status = 'active',
      disabled_at = null,
      disabled_by = null
  where id = target_profile.id;

  insert into public.audit_log (
    org_id, actor_id, action, entity_type, entity_id, detail
  ) values (
    actor_profile.org_id,
    actor_id,
    'member_restored',
    'profile',
    target_profile.id,
    jsonb_build_object('role', target_profile.role)
  );

  return true;
end;
$$;

revoke all on function public.admin_change_member_role(uuid, public.user_role)
  from public, anon, service_role;
revoke all on function public.admin_disable_member(uuid)
  from public, anon, service_role;
revoke all on function public.admin_restore_member(uuid)
  from public, anon, service_role;
grant execute on function public.admin_change_member_role(uuid, public.user_role)
  to authenticated;
grant execute on function public.admin_disable_member(uuid)
  to authenticated;
grant execute on function public.admin_restore_member(uuid)
  to authenticated;
