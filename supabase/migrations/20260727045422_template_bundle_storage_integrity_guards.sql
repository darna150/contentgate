-- Storage does not participate in Postgres transactions. Keep publication and
-- active assignment fail-closed by checking that every relational asset row
-- has its corresponding object before the bundle becomes client-visible.

create or replace function public.template_version_storage_integrity(
  p_template_version_id uuid,
  p_org_id uuid
)
returns table (
  asset_count bigint,
  present_asset_count bigint,
  missing_asset_keys text[]
)
language sql
stable
set search_path = public, storage
as $$
  select
    count(template_asset.id) as asset_count,
    count(storage_object.id) as present_asset_count,
    coalesce(
      array_agg(template_asset.asset_key order by template_asset.asset_key)
        filter (where storage_object.id is null),
      '{}'::text[]
    ) as missing_asset_keys
  from public.template_assets as template_asset
  left join storage.objects as storage_object
    on storage_object.bucket_id = 'template-bundles'
   and storage_object.name = template_asset.storage_path
  where template_asset.template_version_id = p_template_version_id
    and template_asset.org_id = p_org_id;
$$;

create or replace function public.assert_template_version_storage_complete(
  p_template_version_id uuid,
  p_org_id uuid
)
returns void
language plpgsql
set search_path = public, storage
as $$
declare
  integrity record;
begin
  select *
  into integrity
  from public.template_version_storage_integrity(p_template_version_id, p_org_id);

  if integrity.asset_count = 0 or integrity.present_asset_count <> integrity.asset_count then
    raise exception 'template version storage is incomplete (% of % assets present; missing: %)',
      integrity.present_asset_count,
      integrity.asset_count,
      array_to_string(integrity.missing_asset_keys, ', ')
      using errcode = '23514';
  end if;
end;
$$;

create or replace function public.publish_template_version_atomic(
  p_template_version_id uuid,
  p_org_id uuid,
  p_published_at timestamptz default now()
)
returns table (
  template_version_id uuid,
  template_family_id uuid,
  status text,
  already_published boolean
)
language plpgsql
set search_path = public, storage
as $$
declare
  version_row public.template_versions%rowtype;
begin
  select *
  into version_row
  from public.template_versions
  where id = p_template_version_id
    and org_id = p_org_id
  for update;

  if not found then
    raise exception 'template version not found' using errcode = 'P0002';
  end if;

  if version_row.status = 'published' then
    perform public.assert_template_version_storage_complete(version_row.id, p_org_id);
    return query
    select version_row.id, version_row.family_id, version_row.status, true;
    return;
  end if;

  if version_row.status <> 'ready' then
    raise exception 'template version must be ready before publishing; current status: %', version_row.status
      using errcode = '23514';
  end if;

  perform public.assert_template_version_storage_complete(version_row.id, p_org_id);

  update public.template_families
  set status = 'active',
      updated_at = p_published_at
  where id = version_row.family_id
    and org_id = p_org_id;

  update public.template_versions
  set status = 'published',
      published_at = p_published_at
  where id = version_row.id
    and org_id = p_org_id;

  return query
  select version_row.id, version_row.family_id, 'published'::text, false;
end;
$$;

create or replace function public.enforce_active_template_assignment_storage_integrity()
returns trigger
language plpgsql
set search_path = public, storage
as $$
begin
  if new.status = 'active' then
    perform public.assert_template_version_storage_complete(new.template_version_id, new.org_id);
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_active_template_assignment_storage_integrity
  on public.product_template_assignments;
create trigger enforce_active_template_assignment_storage_integrity
before insert or update of template_version_id, status
on public.product_template_assignments
for each row
execute function public.enforce_active_template_assignment_storage_integrity();

revoke all on function public.template_version_storage_integrity(uuid, uuid) from public;
revoke all on function public.assert_template_version_storage_complete(uuid, uuid) from public;
revoke all on function public.enforce_active_template_assignment_storage_integrity() from public;
grant execute on function public.template_version_storage_integrity(uuid, uuid) to service_role;
grant execute on function public.assert_template_version_storage_complete(uuid, uuid) to service_role;
grant execute on function public.publish_template_version_atomic(uuid, uuid, timestamptz) to service_role;
