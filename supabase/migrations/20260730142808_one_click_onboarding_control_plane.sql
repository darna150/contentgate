-- One-click onboarding control plane.
--
-- The package uses stable human keys while this migration resolves database
-- identities. Provisioning is resumable by (environment, blueprint_sha256),
-- core tenant rows are applied in one transaction, and control-plane records
-- remain service-role-only.

alter table public.organizations
  add column if not exists workspace_key text;

alter table public.products
  add column if not exists product_key text;

alter table public.documents
  add column if not exists document_key text;

alter table public.product_claims
  add column if not exists claim_key text;

alter table public.product_assets
  add column if not exists asset_key text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'organizations_workspace_key_shape') then
    alter table public.organizations
      add constraint organizations_workspace_key_shape
      check (workspace_key is null or workspace_key ~ '^[a-z0-9][a-z0-9_-]{1,62}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'products_product_key_shape') then
    alter table public.products
      add constraint products_product_key_shape
      check (product_key is null or product_key ~ '^[a-z0-9][a-z0-9_-]{1,62}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'documents_document_key_shape') then
    alter table public.documents
      add constraint documents_document_key_shape
      check (document_key is null or document_key ~ '^[a-z0-9][a-z0-9_-]{1,62}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'product_claims_claim_key_shape') then
    alter table public.product_claims
      add constraint product_claims_claim_key_shape
      check (claim_key is null or claim_key ~ '^[a-z0-9][a-z0-9_-]{1,62}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'product_assets_asset_key_shape') then
    alter table public.product_assets
      add constraint product_assets_asset_key_shape
      check (asset_key is null or asset_key ~ '^[a-z0-9][a-z0-9_-]{1,62}$');
  end if;
end;
$$;

create unique index if not exists organizations_workspace_key_uidx
  on public.organizations (workspace_key) where workspace_key is not null;
create unique index if not exists products_org_product_key_uidx
  on public.products (org_id, product_key) where product_key is not null;
create unique index if not exists documents_org_document_key_uidx
  on public.documents (org_id, document_key) where document_key is not null;
create unique index if not exists product_claims_org_claim_key_uidx
  on public.product_claims (org_id, claim_key) where claim_key is not null;
create unique index if not exists product_assets_org_asset_key_uidx
  on public.product_assets (org_id, asset_key) where asset_key is not null;

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  product_id uuid not null,
  campaign_key text not null,
  name text not null,
  status text not null default 'draft',
  brief text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaigns_key_shape check (campaign_key ~ '^[a-z0-9][a-z0-9_-]{1,62}$'),
  constraint campaigns_status_valid check (status in ('draft', 'active', 'archived')),
  constraint campaigns_org_key_unique unique (org_id, campaign_key),
  constraint campaigns_org_product_fkey
    foreign key (org_id, product_id) references public.products (org_id, id) on delete cascade
);

create unique index if not exists campaigns_org_id_id_uidx
  on public.campaigns (org_id, id);
create index if not exists campaigns_product_status_idx
  on public.campaigns (product_id, status, updated_at desc);

alter table public.generated_content
  add column if not exists campaign_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'generated_content_org_campaign_fkey') then
    alter table public.generated_content
      add constraint generated_content_org_campaign_fkey
      foreign key (org_id, campaign_id) references public.campaigns (org_id, id) on delete set null;
  end if;
end;
$$;

create index if not exists generated_content_campaign_idx
  on public.generated_content (campaign_id, created_at desc);

alter table public.campaigns enable row level security;
drop policy if exists "org campaigns read" on public.campaigns;
create policy "org campaigns read"
  on public.campaigns for select to authenticated
  using (org_id = (select public.auth_org_id()));
drop policy if exists "org campaigns admin write" on public.campaigns;
create policy "org campaigns admin write"
  on public.campaigns for all to authenticated
  using (org_id = (select public.auth_org_id()) and (select public.auth_role()) = 'admin')
  with check (org_id = (select public.auth_org_id()) and (select public.auth_role()) = 'admin');

revoke all on table public.campaigns from public, anon;
grant select, insert, update, delete on table public.campaigns to authenticated;
grant all on table public.campaigns to service_role;

create table if not exists public.onboarding_runs (
  id uuid primary key default gen_random_uuid(),
  environment text not null,
  schema_version text not null,
  blueprint_sha256 text not null,
  workspace_key text not null,
  organization_id uuid references public.organizations(id) on delete set null,
  operator_user_id uuid,
  operator_email text,
  status text not null default 'received',
  current_step text not null default 'received',
  blueprint jsonb not null,
  report jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint onboarding_runs_environment_valid
    check (environment in ('development', 'staging', 'production')),
  constraint onboarding_runs_schema_version_valid
    check (schema_version = 'contentgate-workspace-v1'),
  constraint onboarding_runs_sha_shape
    check (blueprint_sha256 ~ '^[a-f0-9]{64}$'),
  constraint onboarding_runs_workspace_key_shape
    check (workspace_key ~ '^[a-z0-9][a-z0-9_-]{1,62}$'),
  constraint onboarding_runs_status_valid
    check (status in ('received', 'provisioning', 'completed', 'failed', 'rolling_back', 'rolled_back')),
  constraint onboarding_runs_environment_sha_unique unique (environment, blueprint_sha256)
);

create table if not exists public.onboarding_run_steps (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.onboarding_runs(id) on delete cascade,
  step_key text not null,
  status text not null,
  attempt integer not null default 1,
  detail jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint onboarding_run_steps_status_valid
    check (status in ('running', 'completed', 'failed', 'compensated')),
  constraint onboarding_run_steps_attempt_positive check (attempt > 0),
  constraint onboarding_run_steps_run_key_attempt_unique unique (run_id, step_key, attempt)
);

create table if not exists public.onboarding_package_uploads (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  operator_user_id uuid not null,
  file_name text not null,
  file_size_bytes bigint not null,
  status text not null default 'awaiting_upload',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 hours'),
  consumed_at timestamptz,
  constraint onboarding_package_uploads_size_valid
    check (file_size_bytes > 0 and file_size_bytes <= 52428800),
  constraint onboarding_package_uploads_status_valid
    check (status in ('awaiting_upload', 'preflight_passed', 'consumed', 'discarded', 'expired'))
);

create index if not exists onboarding_runs_workspace_created_idx
  on public.onboarding_runs (workspace_key, created_at desc);
create index if not exists onboarding_run_steps_run_started_idx
  on public.onboarding_run_steps (run_id, started_at);
create index if not exists onboarding_package_uploads_expiry_idx
  on public.onboarding_package_uploads (status, expires_at)
  where status in ('awaiting_upload', 'preflight_passed');

alter table public.onboarding_runs enable row level security;
alter table public.onboarding_run_steps enable row level security;
alter table public.onboarding_package_uploads enable row level security;

-- These tables intentionally have no authenticated policies. They contain
-- cross-tenant package contents and operator diagnostics.
revoke all on table public.onboarding_runs from public, anon, authenticated;
revoke all on table public.onboarding_run_steps from public, anon, authenticated;
revoke all on table public.onboarding_package_uploads from public, anon, authenticated;
revoke all on sequence public.onboarding_run_steps_id_seq from public, anon, authenticated;
grant all on table public.onboarding_runs to service_role;
grant all on table public.onboarding_run_steps to service_role;
grant all on table public.onboarding_package_uploads to service_role;
grant usage, select on sequence public.onboarding_run_steps_id_seq to service_role;

create table if not exists private.onboarding_user_provisioning (
  token uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.onboarding_runs(id) on delete cascade,
  email text not null,
  org_id uuid not null references public.organizations(id) on delete cascade,
  role public.user_role not null default 'member',
  full_name text,
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  created_at timestamptz not null default now(),
  constraint onboarding_user_provisioning_email_normalized
    check (email = lower(trim(email))),
  constraint onboarding_user_provisioning_run_email_unique
    unique (run_id, email)
);

revoke all on table private.onboarding_user_provisioning
  from public, anon, authenticated, service_role;

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
) values (
  'onboarding-packages',
  'onboarding-packages',
  false,
  52428800,
  array['application/zip', 'application/x-zip-compressed']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Operators upload through short-lived signed URLs minted by an authorized
-- server action. No browser role receives direct bucket policies.

create or replace function public.begin_onboarding_run(
  p_environment text,
  p_blueprint_sha256 text,
  p_blueprint jsonb,
  p_operator_user_id uuid default null,
  p_operator_email text default null
)
returns table (
  run_id uuid,
  organization_id uuid,
  run_status text,
  resumed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing public.onboarding_runs%rowtype;
  created_run_id uuid;
  created_org_id uuid;
  workspace jsonb;
  target_key text;
begin
  if p_environment not in ('development', 'staging', 'production') then
    raise exception 'Unsupported onboarding environment';
  end if;
  if p_blueprint_sha256 is null or p_blueprint_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception 'A valid blueprint SHA-256 is required';
  end if;
  if p_blueprint ->> 'schemaVersion' <> 'contentgate-workspace-v1' then
    raise exception 'Unsupported workspace blueprint version';
  end if;

  workspace := p_blueprint -> 'workspace';
  target_key := workspace ->> 'key';
  if target_key is null or target_key !~ '^[a-z0-9][a-z0-9_-]{1,62}$' then
    raise exception 'A valid workspace key is required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_environment || ':' || target_key, 0));

  select * into existing
  from public.onboarding_runs
  where environment = p_environment and blueprint_sha256 = p_blueprint_sha256
  for update;

  if found then
    if existing.status = 'completed' then
      return query select existing.id, existing.organization_id, existing.status, true;
      return;
    end if;

    if existing.status = 'provisioning'
      and existing.organization_id is not null
      and exists (select 1 from public.organizations where id = existing.organization_id)
    then
      return query select existing.id, existing.organization_id, existing.status, true;
      return;
    end if;

    if exists (
      select 1 from public.organizations
      where workspace_key = target_key
        and id is distinct from existing.organization_id
    ) then
      raise exception 'Workspace key "%" was claimed by another run', target_key;
    end if;

    if existing.organization_id is null
      or not exists (select 1 from public.organizations where id = existing.organization_id)
    then
      insert into public.organizations (workspace_key, name, industry)
      values (target_key, workspace ->> 'name', nullif(trim(workspace ->> 'industry'), ''))
      returning id into created_org_id;
    else
      created_org_id := existing.organization_id;
    end if;

    update public.onboarding_runs
    set organization_id = created_org_id,
        status = 'provisioning',
        current_step = 'workspace',
        report = '{}'::jsonb,
        error_message = null,
        updated_at = now(),
        completed_at = null
    where id = existing.id;
    insert into public.onboarding_run_steps (
      run_id, step_key, status, attempt, completed_at, detail
    ) values (
      existing.id,
      'workspace',
      'completed',
      (select coalesce(max(attempt), 0) + 1 from public.onboarding_run_steps where run_id = existing.id and step_key = 'workspace'),
      now(),
      jsonb_build_object('organizationId', created_org_id, 'resumed', true)
    );
    return query select existing.id, created_org_id, 'provisioning'::text, true;
    return;
  end if;

  if exists (select 1 from public.organizations where workspace_key = target_key) then
    raise exception 'Workspace key "%" already exists with a different blueprint', target_key;
  end if;

  insert into public.onboarding_runs (
    environment, schema_version, blueprint_sha256, workspace_key,
    operator_user_id, operator_email, status, current_step, blueprint
  ) values (
    p_environment, 'contentgate-workspace-v1', p_blueprint_sha256, target_key,
    p_operator_user_id, lower(nullif(trim(p_operator_email), '')),
    'provisioning', 'workspace', p_blueprint
  ) returning id into created_run_id;

  insert into public.organizations (workspace_key, name, industry)
  values (target_key, workspace ->> 'name', nullif(trim(workspace ->> 'industry'), ''))
  returning id into created_org_id;

  update public.onboarding_runs
  set organization_id = created_org_id, updated_at = now()
  where id = created_run_id;

  insert into public.onboarding_run_steps (run_id, step_key, status, completed_at, detail)
  values (created_run_id, 'workspace', 'completed', now(), jsonb_build_object('organizationId', created_org_id));

  return query select created_run_id, created_org_id, 'provisioning'::text, false;
end;
$$;

create or replace function public.record_onboarding_step(
  p_run_id uuid,
  p_step_key text,
  p_status text,
  p_detail jsonb default '{}'::jsonb,
  p_error_message text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_attempt integer;
begin
  if p_status not in ('running', 'completed', 'failed', 'compensated') then
    raise exception 'Unsupported onboarding step status';
  end if;
  if not exists (select 1 from public.onboarding_runs where id = p_run_id) then
    raise exception 'Onboarding run not found';
  end if;
  select coalesce(max(attempt), 0) + 1 into next_attempt
  from public.onboarding_run_steps where run_id = p_run_id and step_key = p_step_key;
  insert into public.onboarding_run_steps (
    run_id, step_key, status, attempt, detail, error_message, completed_at
  ) values (
    p_run_id, p_step_key, p_status, next_attempt, coalesce(p_detail, '{}'::jsonb),
    p_error_message, case when p_status = 'running' then null else now() end
  );
  update public.onboarding_runs
  set current_step = p_step_key, updated_at = now(),
      error_message = case when p_status = 'failed' then p_error_message else error_message end
  where id = p_run_id;
end;
$$;

create or replace function public.apply_onboarding_blueprint(
  p_run_id uuid,
  p_uploader_id uuid,
  p_resolved_documents jsonb default '[]'::jsonb,
  p_resolved_assets jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_run public.onboarding_runs%rowtype;
  org_id uuid;
  item jsonb;
  resolved jsonb;
  product_id uuid;
  document_id uuid;
  source_document_id uuid;
  source_paragraph_n integer;
  source_excerpt text;
  product_map jsonb := '{}'::jsonb;
  campaign_map jsonb := '{}'::jsonb;
  document_map jsonb := '{}'::jsonb;
  claim_map jsonb := '{}'::jsonb;
  asset_map jsonb := '{}'::jsonb;
begin
  select * into target_run from public.onboarding_runs where id = p_run_id for update;
  if not found then raise exception 'Onboarding run not found'; end if;
  if target_run.status = 'completed' then return target_run.report; end if;
  if target_run.status <> 'provisioning' then
    raise exception 'Onboarding run is not provisionable (status=%)', target_run.status;
  end if;
  org_id := target_run.organization_id;
  if not exists (
    select 1 from public.profiles where id = p_uploader_id and profiles.org_id = org_id
  ) then
    raise exception 'Uploader must be a profile in the provisioned workspace';
  end if;

  for item in select value from jsonb_array_elements(coalesce(target_run.blueprint -> 'products', '[]'::jsonb))
  loop
    insert into public.products (org_id, product_key, name, description, disclaimer_text, status)
    values (
      org_id, item ->> 'key', item ->> 'name', nullif(item ->> 'description', ''),
      nullif(item ->> 'disclaimer', ''), 'active'
    )
    on conflict (org_id, product_key) where product_key is not null do update
      set name = excluded.name,
          description = excluded.description,
          disclaimer_text = excluded.disclaimer_text
    returning id into product_id;
    product_map := product_map || jsonb_build_object(item ->> 'key', product_id);
  end loop;

  for item in select value from jsonb_array_elements(coalesce(target_run.blueprint -> 'campaigns', '[]'::jsonb))
  loop
    product_id := (product_map ->> (item ->> 'productKey'))::uuid;
    if product_id is null then raise exception 'Campaign has an unresolved product reference'; end if;
    insert into public.campaigns (org_id, product_id, campaign_key, name, status, brief)
    values (
      org_id, product_id, item ->> 'key', item ->> 'name',
      coalesce(item ->> 'status', 'draft'), nullif(item ->> 'brief', '')
    )
    on conflict (org_id, campaign_key) do update
      set product_id = excluded.product_id,
          name = excluded.name,
          status = excluded.status,
          brief = excluded.brief,
          updated_at = now()
    returning id into document_id;
    campaign_map := campaign_map || jsonb_build_object(item ->> 'key', document_id);
  end loop;

  for item in select value from jsonb_array_elements(coalesce(target_run.blueprint -> 'documents', '[]'::jsonb))
  loop
    resolved := null;
    select value into resolved
    from jsonb_array_elements(coalesce(p_resolved_documents, '[]'::jsonb))
    where value ->> 'key' = item ->> 'key'
    limit 1;
    if nullif(item ->> 'content', '') is null and resolved is null then
      raise exception 'Document "%" was not resolved', item ->> 'key';
    end if;
    product_id := case when item ? 'productKey' then (product_map ->> (item ->> 'productKey'))::uuid else null end;
    insert into public.documents (
      org_id, uploaded_by, document_key, title, product_id, storage_path,
      content_text, paragraphs, file_type, approval_status
    ) values (
      org_id, p_uploader_id, item ->> 'key', item ->> 'title', product_id,
      nullif(resolved ->> 'storagePath', ''),
      coalesce(nullif(item ->> 'content', ''), resolved ->> 'content'),
      coalesce(resolved -> 'paragraphs', '[]'::jsonb),
      coalesce(nullif(resolved ->> 'fileType', ''), 'text'),
      coalesce(item ->> 'approvalStatus', 'approved')
    )
    on conflict (org_id, document_key) where document_key is not null do update
      set title = excluded.title,
          product_id = excluded.product_id,
          storage_path = excluded.storage_path,
          content_text = excluded.content_text,
          paragraphs = excluded.paragraphs,
          file_type = excluded.file_type,
          approval_status = excluded.approval_status
    returning id into document_id;
    document_map := document_map || jsonb_build_object(item ->> 'key', document_id);
  end loop;

  for item in select value from jsonb_array_elements(coalesce(target_run.blueprint -> 'claims', '[]'::jsonb))
  loop
    product_id := (product_map ->> (item ->> 'productKey'))::uuid;
    source_document_id := case when item ? 'sourceDocumentKey'
      then (document_map ->> (item ->> 'sourceDocumentKey'))::uuid else null end;
    source_paragraph_n := case when item ? 'sourceParagraph' then (item ->> 'sourceParagraph')::integer else null end;
    source_excerpt := null;
    if source_document_id is not null and source_paragraph_n is not null then
      select paragraph ->> 'text' into source_excerpt
      from public.documents document,
        jsonb_array_elements(coalesce(document.paragraphs, '[]'::jsonb)) paragraph
      where document.id = source_document_id
        and (paragraph ->> 'n')::integer = source_paragraph_n
      limit 1;
      if source_excerpt is null then
        raise exception 'Claim "%" references a missing source paragraph', item ->> 'key';
      end if;
    end if;
    insert into public.product_claims (
      org_id, product_id, claim_key, claim_text, status,
      source_document_id, source_paragraph_n, source_excerpt
    ) values (
      org_id, product_id, item ->> 'key', item ->> 'text',
      coalesce(item ->> 'status', 'approved'), source_document_id,
      source_paragraph_n, source_excerpt
    )
    on conflict (org_id, claim_key) where claim_key is not null do update
      set product_id = excluded.product_id,
          claim_text = excluded.claim_text,
          status = excluded.status,
          source_document_id = excluded.source_document_id,
          source_paragraph_n = excluded.source_paragraph_n,
          source_excerpt = excluded.source_excerpt
    returning id into document_id;
    claim_map := claim_map || jsonb_build_object(item ->> 'key', document_id);
  end loop;

  for item in select value from jsonb_array_elements(coalesce(target_run.blueprint -> 'assets', '[]'::jsonb))
  loop
    resolved := null;
    select value into resolved
    from jsonb_array_elements(coalesce(p_resolved_assets, '[]'::jsonb))
    where value ->> 'key' = item ->> 'key'
    limit 1;
    if resolved is null or nullif(resolved ->> 'storagePath', '') is null then
      raise exception 'Asset "%" was not uploaded', item ->> 'key';
    end if;
    product_id := case when item ? 'productKey' then (product_map ->> (item ->> 'productKey'))::uuid else null end;
    insert into public.product_assets (
      org_id, product_id, asset_key, asset_type, storage_path, title, alt_text,
      original_file_name, mime_type, file_size_bytes, width_pixels, height_pixels,
      tags, approval_status, uploaded_by
    ) values (
      org_id, product_id, item ->> 'key', item ->> 'type', resolved ->> 'storagePath',
      coalesce(nullif(item ->> 'title', ''), resolved ->> 'originalFileName', item ->> 'key'),
      nullif(item ->> 'altText', ''), resolved ->> 'originalFileName', resolved ->> 'mimeType',
      nullif(resolved ->> 'fileSizeBytes', '')::bigint,
      nullif(resolved ->> 'widthPixels', '')::integer,
      nullif(resolved ->> 'heightPixels', '')::integer,
      coalesce(array(select jsonb_array_elements_text(coalesce(item -> 'tags', '[]'::jsonb))), '{}'::text[]),
      coalesce(item ->> 'approvalStatus', 'approved'), p_uploader_id
    )
    on conflict (org_id, asset_key) where asset_key is not null do update
      set product_id = excluded.product_id,
          asset_type = excluded.asset_type,
          storage_path = excluded.storage_path,
          title = excluded.title,
          alt_text = excluded.alt_text,
          original_file_name = excluded.original_file_name,
          mime_type = excluded.mime_type,
          file_size_bytes = excluded.file_size_bytes,
          width_pixels = excluded.width_pixels,
          height_pixels = excluded.height_pixels,
          tags = excluded.tags,
          approval_status = excluded.approval_status,
          uploaded_by = excluded.uploaded_by
    returning id into document_id;
    asset_map := asset_map || jsonb_build_object(item ->> 'key', document_id);
  end loop;

  target_run.report := jsonb_build_object(
    'organizationId', org_id,
    'products', product_map,
    'campaigns', campaign_map,
    'documents', document_map,
    'claims', claim_map,
    'assets', asset_map
  );
  update public.onboarding_runs
  set report = target_run.report, current_step = 'core_data', updated_at = now()
  where id = p_run_id;
  insert into public.onboarding_run_steps (run_id, step_key, status, completed_at, detail)
  values (p_run_id, 'core_data', 'completed', now(), target_run.report)
  on conflict (run_id, step_key, attempt) do nothing;
  return target_run.report;
end;
$$;

create or replace function public.complete_onboarding_run(
  p_run_id uuid,
  p_report jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.onboarding_runs
  set status = 'completed', current_step = 'completed',
      report = report || coalesce(p_report, '{}'::jsonb),
      error_message = null, updated_at = now(), completed_at = now()
  where id = p_run_id and status = 'provisioning';
  if not found then raise exception 'Provisionable onboarding run not found'; end if;
  insert into public.onboarding_run_steps (run_id, step_key, status, completed_at)
  values (p_run_id, 'completed', 'completed', now());
end;
$$;

-- Template bundle imports previously used five independent Data API writes.
-- Keep storage outside the transaction, but make all relational bundle rows
-- atomic so a failed version/variant/asset insert cannot leave partial schema.
create or replace function public.insert_compiled_template_bundle(p_rows jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  family jsonb := p_rows -> 'family';
  version jsonb := p_rows -> 'version';
  import_run jsonb := p_rows -> 'importRun';
  actual_family_id uuid;
begin
  insert into public.template_families (
    id, org_id, family_key, name, description, status
  ) values (
    (family ->> 'id')::uuid,
    (family ->> 'org_id')::uuid,
    family ->> 'family_key',
    family ->> 'name',
    nullif(family ->> 'description', ''),
    family ->> 'status'
  )
  on conflict (org_id, family_key) do update
  set name = excluded.name,
      description = excluded.description,
      updated_at = now()
  returning id into actual_family_id;

  if actual_family_id <> (version ->> 'family_id')::uuid then
    raise exception 'Compiled template family identity does not match the existing family';
  end if;

  insert into public.template_versions (
    id, org_id, family_id, version_label, status, schema_version,
    source_provider, source_file_key, source_version, manifest,
    manifest_sha256, validation_report, published_at, created_by
  ) values (
    (version ->> 'id')::uuid,
    (version ->> 'org_id')::uuid,
    actual_family_id,
    version ->> 'version_label',
    version ->> 'status',
    version ->> 'schema_version',
    version ->> 'source_provider',
    nullif(version ->> 'source_file_key', ''),
    nullif(version ->> 'source_version', ''),
    version -> 'manifest',
    version ->> 'manifest_sha256',
    version -> 'validation_report',
    nullif(version ->> 'published_at', '')::timestamptz,
    nullif(version ->> 'created_by', '')::uuid
  );

  insert into public.template_variants (
    id, org_id, template_version_id, variant_key, label, channel,
    width, height, field_keys, slot_manifest
  )
  select
    row.id, row.org_id, row.template_version_id, row.variant_key, row.label,
    row.channel, row.width, row.height, row.field_keys, row.slot_manifest
  from jsonb_to_recordset(coalesce(p_rows -> 'variants', '[]'::jsonb)) as row(
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
    id, org_id, template_version_id, variant_id, asset_key, asset_kind,
    storage_path, mime_type, width, height, sha256
  )
  select
    row.id, row.org_id, row.template_version_id, row.variant_id,
    row.asset_key, row.asset_kind, row.storage_path, row.mime_type,
    row.width, row.height, row.sha256
  from jsonb_to_recordset(coalesce(p_rows -> 'assets', '[]'::jsonb)) as row(
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
    id, org_id, template_version_id, source_provider, status,
    manifest_sha256, report, created_by
  ) values (
    (import_run ->> 'id')::uuid,
    (import_run ->> 'org_id')::uuid,
    nullif(import_run ->> 'template_version_id', '')::uuid,
    import_run ->> 'source_provider',
    import_run ->> 'status',
    nullif(import_run ->> 'manifest_sha256', ''),
    import_run -> 'report',
    nullif(import_run ->> 'created_by', '')::uuid
  );
end;
$$;

create or replace function public.mark_onboarding_run_failed(
  p_run_id uuid,
  p_step_key text,
  p_error_message text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.onboarding_runs
  set status = 'failed', current_step = p_step_key,
      error_message = left(p_error_message, 4000), updated_at = now()
  where id = p_run_id and status <> 'completed';
  if not found then raise exception 'Mutable onboarding run not found'; end if;
  perform public.record_onboarding_step(
    p_run_id, p_step_key, 'failed', '{}'::jsonb, left(p_error_message, 4000)
  );
end;
$$;

create or replace function public.rollback_onboarding_run(p_run_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_run public.onboarding_runs%rowtype;
  org_id uuid;
begin
  select * into target_run from public.onboarding_runs where id = p_run_id for update;
  if not found then raise exception 'Onboarding run not found'; end if;
  if target_run.status = 'completed' then
    raise exception 'Completed onboarding runs cannot be rolled back automatically';
  end if;
  org_id := target_run.organization_id;
  update public.onboarding_runs
  set status = 'rolling_back', current_step = 'rollback', updated_at = now()
  where id = p_run_id;

  if org_id is not null then
    delete from public.product_template_assignments where product_template_assignments.org_id = org_id;
    delete from public.render_jobs where render_jobs.org_id = org_id;
    delete from public.template_import_runs where template_import_runs.org_id = org_id;
    delete from public.template_families where template_families.org_id = org_id;
    delete from public.documents where documents.org_id = org_id;
    delete from public.campaigns where campaigns.org_id = org_id;
    delete from public.product_assets where product_assets.org_id = org_id;
    delete from public.products where products.org_id = org_id;
    delete from public.templates where templates.org_id = org_id;
    delete from public.audit_log where audit_log.org_id = org_id;
    if exists (select 1 from public.profiles where profiles.org_id = org_id) then
      -- Auth deletion owns profile deletion. Return after removing the rows
      -- that would otherwise block that cascade, then call this function a
      -- second time to remove the now-empty organization.
      update public.onboarding_runs
      set status = 'rolling_back', current_step = 'delete_users', updated_at = now()
      where id = p_run_id;
      perform public.record_onboarding_step(
        p_run_id, 'rollback_tenant_data', 'completed',
        jsonb_build_object('organizationId', org_id), null
      );
      return;
    end if;
    delete from public.organizations where organizations.id = org_id;
  end if;

  update public.onboarding_runs
  set status = 'rolled_back', current_step = 'rolled_back',
      organization_id = null, updated_at = now(), completed_at = now()
  where id = p_run_id;
  perform public.record_onboarding_step(
    p_run_id, 'rollback', 'compensated',
    jsonb_build_object('organizationId', org_id), null
  );
end;
$$;

-- Avoid scanning the Auth directory as the platform grows. Supabase Auth
-- normalizes email addresses before storing them, so this equality can use
-- the Auth email index. The function exposes only the two identifiers needed
-- by the provisioning saga and is callable only with the service-role key.
create or replace function public.find_onboarding_user_by_email(p_email text)
returns table (user_id uuid, organization_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select users.id, profiles.org_id
  from auth.users as users
  left join public.profiles as profiles on profiles.id = users.id
  where users.email = lower(trim(p_email))
  limit 1
$$;

create or replace function public.stage_onboarding_user(
  p_run_id uuid,
  p_email text,
  p_org_id uuid,
  p_role public.user_role default 'member',
  p_full_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  staged_token uuid;
begin
  if p_email is null or trim(p_email) = '' then
    raise exception 'Onboarding user email is required';
  end if;
  if not exists (
    select 1 from public.onboarding_runs
    where id = p_run_id
      and organization_id = p_org_id
      and status = 'provisioning'
  ) then
    raise exception 'Onboarding run is not provisioning this organization';
  end if;

  insert into private.onboarding_user_provisioning (
    run_id, email, org_id, role, full_name, expires_at
  ) values (
    p_run_id,
    lower(trim(p_email)),
    p_org_id,
    p_role,
    nullif(trim(p_full_name), ''),
    now() + interval '30 minutes'
  )
  on conflict (run_id, email) do update
  set org_id = excluded.org_id,
      role = excluded.role,
      full_name = excluded.full_name,
      expires_at = excluded.expires_at
  returning token into staged_token;

  return staged_token;
end;
$$;

-- Keep the existing invite handshake intact while giving onboarding a
-- per-run capability token. Two concurrent packages can stage the same email,
-- but neither token can ever assign the other run's organization.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  onboarding_token uuid;
  onboarding_pending private.onboarding_user_provisioning%rowtype;
  pending private.user_provisioning%rowtype;
begin
  if nullif(new.raw_user_meta_data ->> 'onboarding_token', '') is not null then
    begin
      onboarding_token := (new.raw_user_meta_data ->> 'onboarding_token')::uuid;
    exception when invalid_text_representation then
      raise exception 'Invalid onboarding provisioning token';
    end;

    select * into onboarding_pending
    from private.onboarding_user_provisioning
    where token = onboarding_token
      and email = lower(trim(new.email))
      and expires_at > now()
    for update;

    if not found then
      raise exception 'Onboarding user provisioning is missing or expired';
    end if;

    insert into public.profiles (id, org_id, role, full_name)
    values (
      new.id,
      onboarding_pending.org_id,
      onboarding_pending.role,
      coalesce(onboarding_pending.full_name, new.raw_user_meta_data ->> 'full_name')
    );
    delete from private.onboarding_user_provisioning
    where token = onboarding_pending.token;
    return new;
  end if;

  select * into pending
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

revoke all on function public.begin_onboarding_run(text, text, jsonb, uuid, text)
  from public, anon, authenticated;
revoke all on function public.record_onboarding_step(uuid, text, text, jsonb, text)
  from public, anon, authenticated;
revoke all on function public.apply_onboarding_blueprint(uuid, uuid, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function public.complete_onboarding_run(uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.mark_onboarding_run_failed(uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.rollback_onboarding_run(uuid)
  from public, anon, authenticated;
revoke all on function public.insert_compiled_template_bundle(jsonb)
  from public, anon, authenticated;
revoke all on function public.find_onboarding_user_by_email(text)
  from public, anon, authenticated;
revoke all on function public.stage_onboarding_user(uuid, text, uuid, public.user_role, text)
  from public, anon, authenticated;
revoke all on function public.handle_new_user()
  from public, anon, authenticated;

grant execute on function public.begin_onboarding_run(text, text, jsonb, uuid, text)
  to service_role;
grant execute on function public.record_onboarding_step(uuid, text, text, jsonb, text)
  to service_role;
grant execute on function public.apply_onboarding_blueprint(uuid, uuid, jsonb, jsonb)
  to service_role;
grant execute on function public.complete_onboarding_run(uuid, jsonb)
  to service_role;
grant execute on function public.mark_onboarding_run_failed(uuid, text, text)
  to service_role;
grant execute on function public.rollback_onboarding_run(uuid)
  to service_role;
grant execute on function public.insert_compiled_template_bundle(jsonb)
  to service_role;
grant execute on function public.find_onboarding_user_by_email(text)
  to service_role;
grant execute on function public.stage_onboarding_user(uuid, text, uuid, public.user_role, text)
  to service_role;
grant execute on function public.handle_new_user()
  to supabase_auth_admin;
