-- Enterprise-beta workspace data lifecycle.
--
-- Customer exports and destructive deletion are platform-operator workflows,
-- never browser operations. Global receipts intentionally do not reference the
-- organization so evidence survives deletion. Storage bytes and Auth users are
-- removed through their supported APIs between prepare and finalize.

alter table public.organizations
  add column legal_hold boolean not null default false,
  add column legal_hold_reference text,
  add column legal_hold_changed_at timestamptz;

alter table public.organizations
  add constraint organizations_legal_hold_state_check
  check (
    (not legal_hold and legal_hold_reference is null)
    or
    (legal_hold and nullif(trim(legal_hold_reference), '') is not null
      and legal_hold_changed_at is not null)
  );

create table public.workspace_data_export_receipts (
  id uuid primary key default gen_random_uuid(),
  target_organization_id uuid not null,
  workspace_key text not null,
  environment text not null,
  requested_by text not null,
  reason text not null,
  archive_sha256 text not null,
  manifest_sha256 text not null,
  archive_bytes bigint not null,
  entry_count integer not null,
  completed_at timestamptz not null default now(),
  constraint workspace_data_export_environment_check
    check (environment in ('staging', 'production')),
  constraint workspace_data_export_workspace_key_check
    check (workspace_key ~ '^[a-z0-9][a-z0-9_-]{1,62}$'),
  constraint workspace_data_export_archive_sha_check
    check (archive_sha256 ~ '^[a-f0-9]{64}$'),
  constraint workspace_data_export_manifest_sha_check
    check (manifest_sha256 ~ '^[a-f0-9]{64}$'),
  constraint workspace_data_export_archive_bytes_check check (archive_bytes > 0),
  constraint workspace_data_export_entry_count_check check (entry_count > 0)
);

create index workspace_data_export_receipts_target_idx
  on public.workspace_data_export_receipts
    (target_organization_id, completed_at desc);

create table public.workspace_deletion_receipts (
  id uuid primary key default gen_random_uuid(),
  target_organization_id uuid not null,
  workspace_key text not null,
  environment text not null,
  requested_by text not null,
  approved_by text not null,
  reason text not null,
  change_id text,
  export_receipt_id uuid not null references public.workspace_data_export_receipts(id),
  export_sha256 text not null,
  status text not null default 'approved',
  row_counts jsonb not null default '{}'::jsonb,
  auth_user_count integer not null default 0,
  storage_object_count integer not null default 0,
  failure_detail text,
  requested_at timestamptz not null default now(),
  prepared_at timestamptz,
  completed_at timestamptz,
  constraint workspace_deletion_environment_check
    check (environment in ('staging', 'production')),
  constraint workspace_deletion_workspace_key_check
    check (workspace_key ~ '^[a-z0-9][a-z0-9_-]{1,62}$'),
  constraint workspace_deletion_export_sha_check
    check (export_sha256 ~ '^[a-f0-9]{64}$'),
  constraint workspace_deletion_distinct_approver_check
    check (lower(trim(requested_by)) <> lower(trim(approved_by))),
  constraint workspace_deletion_status_check
    check (status in ('approved', 'awaiting_auth_cleanup', 'completed', 'failed')),
  constraint workspace_deletion_production_change_check
    check (environment <> 'production' or nullif(trim(change_id), '') is not null)
);

create index workspace_deletion_receipts_target_idx
  on public.workspace_deletion_receipts
    (target_organization_id, requested_at desc);

alter table public.workspace_data_export_receipts enable row level security;
alter table public.workspace_deletion_receipts enable row level security;

revoke all on table public.workspace_data_export_receipts
  from public, anon, authenticated;
revoke all on table public.workspace_deletion_receipts
  from public, anon, authenticated;
grant all on table public.workspace_data_export_receipts to service_role;
grant all on table public.workspace_deletion_receipts to service_role;

-- Supabase Data API projects no longer guarantee broad default grants. The
-- lifecycle exporter is a protected service-role client; grant its read path
-- explicitly without widening browser roles.
grant select on table
  public.asset_media_jobs,
  public.audit_log,
  public.brand_voice_versions,
  public.brand_voices,
  public.campaigns,
  public.documents,
  public.generated_content,
  public.generated_content_events,
  public.generated_content_revisions,
  public.knowledge_chunks,
  public.knowledge_queries,
  public.knowledge_query_feedback,
  public.notebook_sessions,
  public.organization_feature_flags,
  public.product_asset_versions,
  public.product_assets,
  public.product_claims,
  public.product_template_assignments,
  public.product_templates,
  public.products,
  public.profiles,
  public.render_jobs,
  public.template_assets,
  public.template_families,
  public.template_import_runs,
  public.template_variants,
  public.template_versions,
  public.templates,
  public.uiux_measurement_events,
  public.organizations,
  public.onboarding_runs,
  public.onboarding_run_steps
  to service_role;

create or replace function public.list_workspace_storage_objects(
  p_organization_id uuid
)
returns table (
  bucket_id text,
  object_name text,
  size_bytes bigint
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce((select auth.jwt() ->> 'role'), '') <> 'service_role' then
    raise exception 'service role required';
  end if;
  if not exists (
    select 1 from public.organizations where id = p_organization_id
  ) then
    raise exception 'workspace not found';
  end if;

  return query
  select objects.bucket_id,
         objects.name,
         coalesce((objects.metadata ->> 'size')::bigint, 0)
  from storage.objects as objects
  where objects.bucket_id in (
      'documents', 'product-assets', 'rendered-assets', 'template-bundles'
    )
    and objects.name like p_organization_id::text || '/%'
  order by objects.bucket_id, objects.name;
end;
$$;

create or replace function public.record_workspace_data_export(
  p_organization_id uuid,
  p_workspace_key text,
  p_environment text,
  p_requested_by text,
  p_reason text,
  p_archive_sha256 text,
  p_manifest_sha256 text,
  p_archive_bytes bigint,
  p_entry_count integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  receipt_id uuid;
begin
  if coalesce((select auth.jwt() ->> 'role'), '') <> 'service_role' then
    raise exception 'service role required';
  end if;
  if p_environment not in ('staging', 'production') then
    raise exception 'environment must be staging or production';
  end if;
  if nullif(trim(p_requested_by), '') is null
    or nullif(trim(p_reason), '') is null then
    raise exception 'requester and reason are required';
  end if;
  if not exists (
    select 1
    from public.organizations
    where id = p_organization_id
      and workspace_key = p_workspace_key
  ) then
    raise exception 'workspace identity does not match';
  end if;

  insert into public.workspace_data_export_receipts (
    target_organization_id, workspace_key, environment, requested_by,
    reason, archive_sha256, manifest_sha256, archive_bytes, entry_count
  ) values (
    p_organization_id, p_workspace_key, p_environment, trim(p_requested_by),
    trim(p_reason), p_archive_sha256, p_manifest_sha256,
    p_archive_bytes, p_entry_count
  )
  returning id into receipt_id;

  return receipt_id;
end;
$$;

create or replace function public.set_workspace_legal_hold(
  p_organization_id uuid,
  p_workspace_key text,
  p_legal_hold boolean,
  p_reference text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce((select auth.jwt() ->> 'role'), '') <> 'service_role' then
    raise exception 'service role required';
  end if;
  if p_legal_hold and nullif(trim(p_reference), '') is null then
    raise exception 'a legal-hold reference is required';
  end if;

  update public.organizations
  set legal_hold = p_legal_hold,
      legal_hold_reference = case when p_legal_hold then trim(p_reference) else null end,
      legal_hold_changed_at = case when p_legal_hold then now() else null end
  where id = p_organization_id
    and workspace_key = p_workspace_key;

  if not found then raise exception 'workspace identity does not match'; end if;
  return true;
end;
$$;

create or replace function public.begin_workspace_deletion(
  p_organization_id uuid,
  p_workspace_key text,
  p_environment text,
  p_requested_by text,
  p_approved_by text,
  p_reason text,
  p_export_sha256 text,
  p_storage_object_count integer,
  p_change_id text,
  p_confirmation text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_organization public.organizations%rowtype;
  export_receipt public.workspace_data_export_receipts%rowtype;
  receipt_id uuid;
begin
  if coalesce((select auth.jwt() ->> 'role'), '') <> 'service_role' then
    raise exception 'service role required';
  end if;
  if p_environment not in ('staging', 'production') then
    raise exception 'environment must be staging or production';
  end if;
  if p_confirmation <> 'DELETE ' || upper(p_environment) || ' ' || p_workspace_key then
    raise exception 'deletion confirmation does not match';
  end if;
  if nullif(trim(p_requested_by), '') is null
    or nullif(trim(p_approved_by), '') is null
    or nullif(trim(p_reason), '') is null then
    raise exception 'requester, approver, and reason are required';
  end if;
  if lower(trim(p_requested_by)) = lower(trim(p_approved_by)) then
    raise exception 'requester and approver must be different people';
  end if;
  if p_environment = 'production' and nullif(trim(p_change_id), '') is null then
    raise exception 'production deletion requires a change identifier';
  end if;

  select * into target_organization
  from public.organizations
  where id = p_organization_id
    and workspace_key = p_workspace_key
  for update;
  if not found then raise exception 'workspace identity does not match'; end if;
  if target_organization.legal_hold then
    raise exception 'workspace is under legal hold: %', target_organization.legal_hold_reference;
  end if;

  select * into export_receipt
  from public.workspace_data_export_receipts
  where target_organization_id = p_organization_id
    and workspace_key = p_workspace_key
    and environment = p_environment
    and archive_sha256 = p_export_sha256
  order by completed_at desc
  limit 1;
  if export_receipt.id is null then
    raise exception 'a matching completed workspace export receipt is required';
  end if;

  insert into public.workspace_deletion_receipts (
    target_organization_id, workspace_key, environment, requested_by,
    approved_by, reason, change_id, export_receipt_id, export_sha256,
    storage_object_count
  ) values (
    p_organization_id, p_workspace_key, p_environment, trim(p_requested_by),
    trim(p_approved_by), trim(p_reason), nullif(trim(p_change_id), ''),
    export_receipt.id, p_export_sha256, greatest(p_storage_object_count, 0)
  )
  returning id into receipt_id;

  return receipt_id;
end;
$$;

create or replace function public.prepare_workspace_deletion(
  p_receipt_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_receipt public.workspace_deletion_receipts%rowtype;
  target_organization public.organizations%rowtype;
  user_ids jsonb;
  deletion_counts jsonb := '{}'::jsonb;
  deleted_count integer;
  target_table text;
  target_tables text[] := array[
    'generated_content_events', 'generated_content_revisions', 'render_jobs',
    'generated_content', 'knowledge_query_feedback', 'knowledge_queries',
    'notebook_sessions', 'uiux_measurement_events', 'asset_media_jobs',
    'product_asset_versions', 'product_template_assignments',
    'template_import_runs', 'template_assets', 'template_variants',
    'template_versions', 'template_families', 'knowledge_chunks',
    'product_claims', 'documents', 'campaigns', 'product_assets',
    'product_templates', 'brand_voice_versions', 'brand_voices', 'products',
    'templates', 'organization_feature_flags', 'audit_log'
  ];
begin
  if coalesce((select auth.jwt() ->> 'role'), '') <> 'service_role' then
    raise exception 'service role required';
  end if;

  select * into target_receipt
  from public.workspace_deletion_receipts
  where id = p_receipt_id
  for update;
  if not found then raise exception 'deletion receipt not found'; end if;
  if target_receipt.status = 'awaiting_auth_cleanup' then
    select coalesce(jsonb_agg(profiles.id order by profiles.id), '[]'::jsonb)
    into user_ids from public.profiles
    where org_id = target_receipt.target_organization_id;
    return jsonb_build_object(
      'receiptId', target_receipt.id,
      'organizationId', target_receipt.target_organization_id,
      'workspaceKey', target_receipt.workspace_key,
      'userIds', user_ids,
      'rowCounts', target_receipt.row_counts,
      'status', target_receipt.status
    );
  end if;
  if target_receipt.status <> 'approved' then
    raise exception 'deletion receipt is not approved';
  end if;

  select * into target_organization
  from public.organizations
  where id = target_receipt.target_organization_id
    and workspace_key = target_receipt.workspace_key
  for update;
  if not found then raise exception 'workspace identity does not match receipt'; end if;
  if target_organization.legal_hold then
    raise exception 'workspace is under legal hold: %', target_organization.legal_hold_reference;
  end if;

  select coalesce(jsonb_agg(profiles.id order by profiles.id), '[]'::jsonb)
  into user_ids
  from public.profiles
  where org_id = target_receipt.target_organization_id;

  delete from private.onboarding_user_provisioning
  where org_id = target_receipt.target_organization_id;
  get diagnostics deleted_count = row_count;
  deletion_counts := deletion_counts || jsonb_build_object('private.onboarding_user_provisioning', deleted_count);

  update public.brand_voices
  set current_version_id = null
  where org_id = target_receipt.target_organization_id;

  foreach target_table in array target_tables loop
    execute format('delete from public.%I where org_id = $1', target_table)
      using target_receipt.target_organization_id;
    get diagnostics deleted_count = row_count;
    deletion_counts := deletion_counts || jsonb_build_object(target_table, deleted_count);
  end loop;

  select count(*) into deleted_count
  from public.onboarding_run_steps
  where run_id in (
    select id from public.onboarding_runs
    where organization_id = target_receipt.target_organization_id
  );
  deletion_counts := deletion_counts || jsonb_build_object('onboarding_run_steps', deleted_count);

  delete from public.onboarding_runs
  where organization_id = target_receipt.target_organization_id;
  get diagnostics deleted_count = row_count;
  deletion_counts := deletion_counts || jsonb_build_object('onboarding_runs', deleted_count);

  update public.workspace_deletion_receipts
  set status = 'awaiting_auth_cleanup',
      row_counts = deletion_counts,
      auth_user_count = jsonb_array_length(user_ids),
      prepared_at = now()
  where id = target_receipt.id;

  return jsonb_build_object(
    'receiptId', target_receipt.id,
    'organizationId', target_receipt.target_organization_id,
    'workspaceKey', target_receipt.workspace_key,
    'userIds', user_ids,
    'rowCounts', deletion_counts,
    'status', 'awaiting_auth_cleanup'
  );
end;
$$;

create or replace function public.finalize_workspace_deletion(
  p_receipt_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_receipt public.workspace_deletion_receipts%rowtype;
begin
  if coalesce((select auth.jwt() ->> 'role'), '') <> 'service_role' then
    raise exception 'service role required';
  end if;

  select * into target_receipt
  from public.workspace_deletion_receipts
  where id = p_receipt_id
  for update;
  if not found then raise exception 'deletion receipt not found'; end if;
  if target_receipt.status = 'completed' then
    return jsonb_build_object('receiptId', target_receipt.id, 'status', 'completed');
  end if;
  if target_receipt.status <> 'awaiting_auth_cleanup' then
    raise exception 'deletion has not reached Auth cleanup';
  end if;
  if exists (
    select 1 from public.profiles
    where org_id = target_receipt.target_organization_id
  ) then
    raise exception 'delete workspace Auth users before finalizing';
  end if;

  delete from public.organizations
  where id = target_receipt.target_organization_id
    and workspace_key = target_receipt.workspace_key;
  if not found then raise exception 'workspace was not available for final deletion'; end if;

  update public.workspace_deletion_receipts
  set status = 'completed', completed_at = now(), failure_detail = null
  where id = target_receipt.id;

  return jsonb_build_object(
    'receiptId', target_receipt.id,
    'organizationId', target_receipt.target_organization_id,
    'workspaceKey', target_receipt.workspace_key,
    'rowCounts', target_receipt.row_counts,
    'authUserCount', target_receipt.auth_user_count,
    'storageObjectCount', target_receipt.storage_object_count,
    'status', 'completed'
  );
end;
$$;

create or replace function public.record_workspace_deletion_failure(
  p_receipt_id uuid,
  p_failure_detail text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce((select auth.jwt() ->> 'role'), '') <> 'service_role' then
    raise exception 'service role required';
  end if;
  update public.workspace_deletion_receipts
  set status = 'failed',
      failure_detail = left(coalesce(p_failure_detail, 'unspecified failure'), 2000)
  where id = p_receipt_id
    and status <> 'completed';
  if not found then raise exception 'deletion receipt cannot be marked failed'; end if;
  return true;
end;
$$;

revoke all on function public.list_workspace_storage_objects(uuid)
  from public, anon, authenticated;
revoke all on function public.record_workspace_data_export(
  uuid, text, text, text, text, text, text, bigint, integer
) from public, anon, authenticated;
revoke all on function public.set_workspace_legal_hold(uuid, text, boolean, text)
  from public, anon, authenticated;
revoke all on function public.begin_workspace_deletion(
  uuid, text, text, text, text, text, text, integer, text, text
) from public, anon, authenticated;
revoke all on function public.prepare_workspace_deletion(uuid)
  from public, anon, authenticated;
revoke all on function public.finalize_workspace_deletion(uuid)
  from public, anon, authenticated;
revoke all on function public.record_workspace_deletion_failure(uuid, text)
  from public, anon, authenticated;

grant execute on function public.list_workspace_storage_objects(uuid)
  to service_role;
grant execute on function public.record_workspace_data_export(
  uuid, text, text, text, text, text, text, bigint, integer
) to service_role;
grant execute on function public.set_workspace_legal_hold(uuid, text, boolean, text)
  to service_role;
grant execute on function public.begin_workspace_deletion(
  uuid, text, text, text, text, text, text, integer, text, text
) to service_role;
grant execute on function public.prepare_workspace_deletion(uuid)
  to service_role;
grant execute on function public.finalize_workspace_deletion(uuid)
  to service_role;
grant execute on function public.record_workspace_deletion_failure(uuid, text)
  to service_role;
