-- One versioned, publishable brand voice per client organization.
-- Drafts are editable; published versions are immutable and can be reactivated
-- to provide a lightweight rollback path.

create table public.brand_voices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null default 'Primary brand voice',
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brand_voices_one_per_org unique (org_id),
  constraint brand_voices_name_length check (char_length(name) between 1 and 120)
);

create unique index brand_voices_org_id_id_uidx
  on public.brand_voices (org_id, id);

create table public.brand_voice_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  brand_voice_id uuid not null,
  version_number integer not null,
  status text not null default 'draft',
  schema_version integer not null default 1,
  profile jsonb not null default '{}'::jsonb,
  created_by uuid not null,
  published_by uuid,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  constraint brand_voice_versions_number_positive check (version_number > 0),
  constraint brand_voice_versions_status_valid check (status in ('draft', 'published')),
  constraint brand_voice_versions_schema_supported check (schema_version = 1),
  constraint brand_voice_versions_profile_object check (jsonb_typeof(profile) = 'object'),
  constraint brand_voice_versions_voice_number_unique unique (brand_voice_id, version_number),
  constraint brand_voice_versions_org_voice_fkey
    foreign key (org_id, brand_voice_id)
    references public.brand_voices (org_id, id)
    on delete cascade,
  constraint brand_voice_versions_org_created_by_fkey
    foreign key (org_id, created_by)
    references public.profiles (org_id, id)
    on delete restrict,
  constraint brand_voice_versions_org_published_by_fkey
    foreign key (org_id, published_by)
    references public.profiles (org_id, id)
    on delete restrict
);

create unique index brand_voice_versions_org_id_id_uidx
  on public.brand_voice_versions (org_id, id);
create index brand_voice_versions_org_voice_idx
  on public.brand_voice_versions (org_id, brand_voice_id);
create index brand_voice_versions_org_created_by_idx
  on public.brand_voice_versions (org_id, created_by);
create index brand_voice_versions_org_published_by_idx
  on public.brand_voice_versions (org_id, published_by)
  where published_by is not null;
create index brand_voice_versions_voice_status_idx
  on public.brand_voice_versions (brand_voice_id, status, version_number desc);
create unique index brand_voice_versions_one_draft_per_voice_uidx
  on public.brand_voice_versions (brand_voice_id)
  where status = 'draft';

alter table public.brand_voices
  add constraint brand_voices_org_current_version_fkey
  foreign key (org_id, current_version_id)
  references public.brand_voice_versions (org_id, id);

alter table public.generated_content
  add column brand_voice_version_id uuid;

alter table public.generated_content
  add constraint generated_content_org_brand_voice_version_fkey
  foreign key (org_id, brand_voice_version_id)
  references public.brand_voice_versions (org_id, id);

create index generated_content_brand_voice_version_idx
  on public.generated_content (org_id, brand_voice_version_id)
  where brand_voice_version_id is not null;

create or replace function public.set_brand_voice_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger brand_voices_set_updated_at
  before update on public.brand_voices
  for each row execute function public.set_brand_voice_updated_at();

create or replace function public.keep_published_brand_voice_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'published' and new is distinct from old then
    raise exception 'Published brand voice versions are immutable';
  end if;
  if new.org_id is distinct from old.org_id
    or new.brand_voice_id is distinct from old.brand_voice_id
    or new.version_number is distinct from old.version_number
    or new.schema_version is distinct from old.schema_version
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at then
    raise exception 'Brand voice version identity is immutable';
  end if;
  if old.status = 'draft'
    and new.status = 'published'
    and (new.published_by is null or new.published_at is null) then
    raise exception 'Published brand voice versions require publisher metadata';
  end if;
  return new;
end;
$$;

create trigger brand_voice_versions_keep_published_immutable
  before update on public.brand_voice_versions
  for each row execute function public.keep_published_brand_voice_immutable();

alter table public.brand_voices enable row level security;
alter table public.brand_voice_versions enable row level security;

create policy "org brand voices read"
  on public.brand_voices for select
  to authenticated
  using (org_id = (select public.auth_org_id()));

create policy "admins create brand voices"
  on public.brand_voices for insert
  to authenticated
  with check (
    org_id = (select public.auth_org_id())
    and (select public.auth_role()) = 'admin'
  );

create policy "admins update brand voices"
  on public.brand_voices for update
  to authenticated
  using (
    org_id = (select public.auth_org_id())
    and (select public.auth_role()) = 'admin'
  )
  with check (
    org_id = (select public.auth_org_id())
    and (select public.auth_role()) = 'admin'
  );

create policy "org brand voice versions read"
  on public.brand_voice_versions for select
  to authenticated
  using (org_id = (select public.auth_org_id()));

create policy "admins create brand voice versions"
  on public.brand_voice_versions for insert
  to authenticated
  with check (
    org_id = (select public.auth_org_id())
    and created_by = auth.uid()
    and (select public.auth_role()) = 'admin'
  );

create policy "admins update draft brand voice versions"
  on public.brand_voice_versions for update
  to authenticated
  using (
    org_id = (select public.auth_org_id())
    and (select public.auth_role()) = 'admin'
  )
  with check (
    org_id = (select public.auth_org_id())
    and (select public.auth_role()) = 'admin'
  );

-- Publish a draft or reactivate a historical published version atomically.
-- SECURITY INVOKER keeps RLS and the caller's privileges in force.
create or replace function public.activate_brand_voice_version(p_version_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_voice_id uuid;
  target_status text;
begin
  if (select public.auth_role()) is distinct from 'admin' then
    raise exception 'Admins only';
  end if;

  select brand_voice_id, status
    into target_voice_id, target_status
  from public.brand_voice_versions
  where id = p_version_id
    and org_id = (select public.auth_org_id());

  if target_voice_id is null then
    raise exception 'Brand voice version not found';
  end if;

  if target_status = 'draft' then
    update public.brand_voice_versions
      set status = 'published',
          published_by = auth.uid(),
          published_at = now()
    where id = p_version_id;
  end if;

  update public.brand_voices
    set current_version_id = p_version_id
  where id = target_voice_id
    and org_id = (select public.auth_org_id());
end;
$$;

grant select, insert, update on table public.brand_voices to authenticated;
grant select, insert, update on table public.brand_voice_versions to authenticated;

revoke execute on function public.set_brand_voice_updated_at() from public, anon, authenticated;
revoke execute on function public.keep_published_brand_voice_immutable() from public, anon, authenticated;
revoke execute on function public.activate_brand_voice_version(uuid) from public, anon;
grant execute on function public.activate_brand_voice_version(uuid) to authenticated;
