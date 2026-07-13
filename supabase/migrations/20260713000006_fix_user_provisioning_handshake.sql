-- Stage trusted org/role assignments before creating a Supabase Auth user.
create schema if not exists private;

create table if not exists private.user_provisioning (
  email text primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  role public.user_role not null default 'member',
  full_name text,
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  created_at timestamptz not null default now(),
  constraint normalized_provisioning_email check (email = lower(trim(email)))
);

revoke all on schema private from public;
revoke all on table private.user_provisioning from public, anon, authenticated;

create or replace function public.provision_user(
  provision_email text,
  provision_org_id uuid,
  provision_role public.user_role default 'member',
  provision_full_name text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if provision_email is null or trim(provision_email) = '' then
    raise exception 'Provisioning email is required';
  end if;

  if not exists (
    select 1 from public.organizations where id = provision_org_id
  ) then
    raise exception 'Provisioning organization does not exist';
  end if;

  insert into private.user_provisioning (email, org_id, role, full_name, expires_at)
  values (
    lower(trim(provision_email)),
    provision_org_id,
    provision_role,
    nullif(trim(provision_full_name), ''),
    now() + interval '30 minutes'
  )
  on conflict (email) do update
  set org_id = excluded.org_id,
      role = excluded.role,
      full_name = excluded.full_name,
      expires_at = excluded.expires_at,
      created_at = now();
end;
$$;

revoke all on function public.provision_user(text, uuid, public.user_role, text)
  from public, anon, authenticated;
grant execute on function public.provision_user(text, uuid, public.user_role, text)
  to service_role;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  pending private.user_provisioning%rowtype;
begin
  select *
  into pending
  from private.user_provisioning
  where email = lower(trim(new.email))
    and expires_at > now()
  for update;

  if not found then
    raise exception 'User must be provisioned before account creation';
  end if;

  insert into public.profiles (id, org_id, role, full_name)
  values (
    new.id,
    pending.org_id,
    pending.role,
    coalesce(pending.full_name, new.raw_user_meta_data ->> 'full_name')
  );

  delete from private.user_provisioning where email = pending.email;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to supabase_auth_admin;
