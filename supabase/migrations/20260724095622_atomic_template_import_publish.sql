-- Atomic DB-side writes for template bundle import and publishing.
--
-- Storage uploads are validated and written before the DB commit because
-- Supabase Storage cannot participate in a Postgres transaction. These RPCs
-- make the relational side all-or-nothing so clients never see a partially
-- inserted template family/version/variant/asset/import-run or a half-published
-- family/version pair.

create or replace function public.commit_template_bundle_import(
  p_family jsonb,
  p_version jsonb,
  p_variants jsonb,
  p_assets jsonb,
  p_import_run jsonb
)
returns void
language plpgsql
set search_path = public
as $$
begin
  insert into public.template_families (
    id,
    org_id,
    family_key,
    name,
    description,
    status
  )
  select
    id,
    org_id,
    family_key,
    name,
    description,
    status
  from jsonb_to_record(p_family) as family(
    id uuid,
    org_id uuid,
    family_key text,
    name text,
    description text,
    status text
  )
  on conflict (org_id, family_key) do nothing;

  insert into public.template_versions (
    id,
    org_id,
    family_id,
    version_label,
    status,
    schema_version,
    source_provider,
    source_file_key,
    source_version,
    manifest,
    manifest_sha256,
    validation_report,
    created_by
  )
  select
    id,
    org_id,
    family_id,
    version_label,
    status,
    schema_version,
    source_provider,
    source_file_key,
    source_version,
    manifest,
    manifest_sha256,
    validation_report,
    created_by
  from jsonb_to_record(p_version) as version(
    id uuid,
    org_id uuid,
    family_id uuid,
    version_label text,
    status text,
    schema_version text,
    source_provider text,
    source_file_key text,
    source_version text,
    manifest jsonb,
    manifest_sha256 text,
    validation_report jsonb,
    created_by uuid
  );

  insert into public.template_variants (
    id,
    org_id,
    template_version_id,
    variant_key,
    label,
    channel,
    width,
    height,
    field_keys,
    slot_manifest
  )
  select
    id,
    org_id,
    template_version_id,
    variant_key,
    label,
    channel,
    width,
    height,
    field_keys,
    slot_manifest
  from jsonb_to_recordset(p_variants) as variant(
    id uuid,
    org_id uuid,
    template_version_id uuid,
    variant_key text,
    label text,
    channel text,
    width integer,
    height integer,
    field_keys jsonb,
    slot_manifest jsonb
  );

  insert into public.template_assets (
    id,
    org_id,
    template_version_id,
    variant_id,
    asset_key,
    asset_kind,
    storage_path,
    mime_type,
    width,
    height,
    sha256
  )
  select
    id,
    org_id,
    template_version_id,
    variant_id,
    asset_key,
    asset_kind,
    storage_path,
    mime_type,
    width,
    height,
    sha256
  from jsonb_to_recordset(p_assets) as asset(
    id uuid,
    org_id uuid,
    template_version_id uuid,
    variant_id uuid,
    asset_key text,
    asset_kind text,
    storage_path text,
    mime_type text,
    width integer,
    height integer,
    sha256 text
  );

  insert into public.template_import_runs (
    id,
    org_id,
    template_version_id,
    source_provider,
    status,
    manifest_sha256,
    report,
    created_by
  )
  select
    id,
    org_id,
    template_version_id,
    source_provider,
    status,
    manifest_sha256,
    report,
    created_by
  from jsonb_to_record(p_import_run) as import_run(
    id uuid,
    org_id uuid,
    template_version_id uuid,
    source_provider text,
    status text,
    manifest_sha256 text,
    report jsonb,
    created_by uuid
  );
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
set search_path = public
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
    return query
    select version_row.id, version_row.family_id, version_row.status, true;
    return;
  end if;

  if version_row.status <> 'ready' then
    raise exception 'template version must be ready before publishing; current status: %', version_row.status
      using errcode = '23514';
  end if;

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

revoke all on function public.commit_template_bundle_import(jsonb, jsonb, jsonb, jsonb, jsonb) from public;
revoke all on function public.publish_template_version_atomic(uuid, uuid, timestamptz) from public;
grant execute on function public.commit_template_bundle_import(jsonb, jsonb, jsonb, jsonb, jsonb) to service_role;
grant execute on function public.publish_template_version_atomic(uuid, uuid, timestamptz) to service_role;
