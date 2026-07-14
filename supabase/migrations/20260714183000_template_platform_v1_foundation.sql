-- Template Platform v1 foundation.
-- Additive architecture for reusable, versioned template bundles. Existing
-- product_templates/layout_key rendering remains in place during migration.

create table if not exists public.template_families (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  family_key text not null,
  name text not null,
  description text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint template_families_family_key_shape
    check (family_key ~ '^[a-z0-9][a-z0-9_-]*$'),
  constraint template_families_status_valid
    check (status in ('draft', 'active', 'retired')),
  constraint template_families_org_key_unique unique (org_id, family_key)
);

create table if not exists public.template_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  family_id uuid not null references public.template_families(id) on delete cascade,
  version_label text not null,
  status text not null default 'draft',
  schema_version text not null default 'template-bundle-v1',
  source_provider text not null default 'figma',
  source_file_key text,
  source_version text,
  manifest jsonb not null,
  manifest_sha256 text not null,
  validation_report jsonb not null default '{"issues":[]}'::jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  constraint template_versions_status_valid
    check (status in ('draft', 'validating', 'ready', 'published', 'retired')),
  constraint template_versions_source_provider_valid
    check (source_provider in ('figma', 'manual')),
  constraint template_versions_schema_version_valid
    check (schema_version = 'template-bundle-v1'),
  constraint template_versions_manifest_sha_shape
    check (manifest_sha256 ~ '^[a-f0-9]{64}$'),
  constraint template_versions_org_family_label_unique
    unique (org_id, family_id, version_label)
);

create table if not exists public.template_variants (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  template_version_id uuid not null references public.template_versions(id) on delete cascade,
  variant_key text not null,
  label text not null,
  channel text not null,
  width int not null,
  height int not null,
  field_keys jsonb not null default '[]'::jsonb,
  slot_manifest jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint template_variants_variant_key_shape
    check (variant_key ~ '^[a-z0-9][a-z0-9_-]*$'),
  constraint template_variants_channel_valid
    check (channel in ('display_ad', 'document', 'email', 'presentation', 'social')),
  constraint template_variants_dimensions_positive
    check (width > 0 and height > 0),
  constraint template_variants_org_version_key_unique
    unique (org_id, template_version_id, variant_key)
);

create table if not exists public.template_assets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  template_version_id uuid not null references public.template_versions(id) on delete cascade,
  variant_id uuid references public.template_variants(id) on delete cascade,
  asset_key text not null,
  asset_kind text not null,
  storage_path text not null,
  mime_type text,
  width int,
  height int,
  sha256 text not null,
  created_at timestamptz not null default now(),
  constraint template_assets_asset_key_shape
    check (asset_key ~ '^[a-z0-9][a-z0-9_-]*$'),
  constraint template_assets_kind_valid
    check (asset_kind in ('background', 'font', 'image', 'reference')),
  constraint template_assets_sha_shape
    check (sha256 ~ '^[a-f0-9]{64}$'),
  constraint template_assets_dimensions_positive
    check ((width is null or width > 0) and (height is null or height > 0)),
  constraint template_assets_org_version_key_unique
    unique (org_id, template_version_id, asset_key)
);

create table if not exists public.product_template_assignments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  product_id uuid not null references public.products(id) on delete cascade,
  template_family_id uuid not null references public.template_families(id),
  template_version_id uuid not null references public.template_versions(id),
  status text not null default 'active',
  default_variant_key text,
  generation_profile jsonb not null default '{}'::jsonb,
  default_payload jsonb not null default '{}'::jsonb,
  allowed_locales jsonb not null default '["en"]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_template_assignments_status_valid
    check (status in ('active', 'paused', 'retired')),
  constraint product_template_assignments_org_product_family_unique
    unique (org_id, product_id, template_family_id)
);

create table if not exists public.template_import_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  template_version_id uuid references public.template_versions(id) on delete set null,
  source_provider text not null default 'figma',
  status text not null default 'received',
  manifest_sha256 text,
  report jsonb not null default '{"issues":[]}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  constraint template_import_runs_source_provider_valid
    check (source_provider in ('figma', 'manual')),
  constraint template_import_runs_status_valid
    check (status in ('received', 'validating', 'failed', 'ready', 'published')),
  constraint template_import_runs_manifest_sha_shape
    check (manifest_sha256 is null or manifest_sha256 ~ '^[a-f0-9]{64}$')
);

create table if not exists public.render_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  product_id uuid references public.products(id) on delete set null,
  generated_content_id uuid references public.generated_content(id) on delete set null,
  template_version_id uuid not null references public.template_versions(id),
  template_variant_id uuid not null references public.template_variants(id),
  renderer_version text not null,
  input_sha256 text not null,
  output_format text not null default 'png',
  status text not null default 'queued',
  payload jsonb not null,
  diagnostics jsonb not null default '{}'::jsonb,
  output_storage_path text,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint render_jobs_input_sha_shape
    check (input_sha256 ~ '^[a-f0-9]{64}$'),
  constraint render_jobs_format_valid
    check (output_format in ('jpg', 'pdf', 'png', 'svg')),
  constraint render_jobs_status_valid
    check (status in ('queued', 'running', 'failed', 'completed'))
);

alter table public.generated_content
  add column if not exists template_version_id uuid references public.template_versions(id) on delete set null,
  add column if not exists template_variant_id uuid references public.template_variants(id) on delete set null,
  add column if not exists renderer_version text,
  add column if not exists render_input_sha256 text;

alter table public.generated_content
  drop constraint if exists generated_content_render_input_sha_shape,
  add constraint generated_content_render_input_sha_shape
    check (render_input_sha256 is null or render_input_sha256 ~ '^[a-f0-9]{64}$');

create index if not exists template_families_org_status_idx
  on public.template_families (org_id, status);
create index if not exists template_versions_family_status_idx
  on public.template_versions (family_id, status, created_at desc);
create index if not exists template_variants_version_idx
  on public.template_variants (template_version_id, variant_key);
create index if not exists template_assets_version_idx
  on public.template_assets (template_version_id, asset_kind);
create index if not exists product_template_assignments_product_status_idx
  on public.product_template_assignments (product_id, status);
create index if not exists template_import_runs_org_created_idx
  on public.template_import_runs (org_id, created_at desc);
create index if not exists render_jobs_content_created_idx
  on public.render_jobs (generated_content_id, created_at desc);
create index if not exists render_jobs_org_status_created_idx
  on public.render_jobs (org_id, status, created_at desc);
create index if not exists generated_content_template_version_idx
  on public.generated_content (template_version_id, template_variant_id);

alter table public.template_families enable row level security;
alter table public.template_versions enable row level security;
alter table public.template_variants enable row level security;
alter table public.template_assets enable row level security;
alter table public.product_template_assignments enable row level security;
alter table public.template_import_runs enable row level security;
alter table public.render_jobs enable row level security;

drop policy if exists "org template families read" on public.template_families;
create policy "org template families read"
  on public.template_families for select
  using (org_id = auth_org_id());
drop policy if exists "org template versions read" on public.template_versions;
create policy "org template versions read"
  on public.template_versions for select
  using (org_id = auth_org_id());
drop policy if exists "org template variants read" on public.template_variants;
create policy "org template variants read"
  on public.template_variants for select
  using (org_id = auth_org_id());
drop policy if exists "org template assets read" on public.template_assets;
create policy "org template assets read"
  on public.template_assets for select
  using (org_id = auth_org_id());
drop policy if exists "org product template assignments read" on public.product_template_assignments;
create policy "org product template assignments read"
  on public.product_template_assignments for select
  using (org_id = auth_org_id());
drop policy if exists "org template import runs read" on public.template_import_runs;
create policy "org template import runs read"
  on public.template_import_runs for select
  using (org_id = auth_org_id());
drop policy if exists "org render jobs read" on public.render_jobs;
create policy "org render jobs read"
  on public.render_jobs for select
  using (org_id = auth_org_id());

drop policy if exists "org template families admin write" on public.template_families;
create policy "org template families admin write"
  on public.template_families for all
  using (org_id = auth_org_id() and auth_role() = 'admin')
  with check (org_id = auth_org_id() and auth_role() = 'admin');
drop policy if exists "org template versions admin write" on public.template_versions;
create policy "org template versions admin write"
  on public.template_versions for all
  using (org_id = auth_org_id() and auth_role() = 'admin')
  with check (org_id = auth_org_id() and auth_role() = 'admin');
drop policy if exists "org template variants admin write" on public.template_variants;
create policy "org template variants admin write"
  on public.template_variants for all
  using (org_id = auth_org_id() and auth_role() = 'admin')
  with check (org_id = auth_org_id() and auth_role() = 'admin');
drop policy if exists "org template assets admin write" on public.template_assets;
create policy "org template assets admin write"
  on public.template_assets for all
  using (org_id = auth_org_id() and auth_role() = 'admin')
  with check (org_id = auth_org_id() and auth_role() = 'admin');
drop policy if exists "org product template assignments admin write" on public.product_template_assignments;
create policy "org product template assignments admin write"
  on public.product_template_assignments for all
  using (org_id = auth_org_id() and auth_role() = 'admin')
  with check (org_id = auth_org_id() and auth_role() = 'admin');
drop policy if exists "org template import runs admin write" on public.template_import_runs;
create policy "org template import runs admin write"
  on public.template_import_runs for all
  using (org_id = auth_org_id() and auth_role() = 'admin')
  with check (org_id = auth_org_id() and auth_role() = 'admin');
drop policy if exists "org render jobs admin write" on public.render_jobs;
create policy "org render jobs admin write"
  on public.render_jobs for all
  using (org_id = auth_org_id() and auth_role() = 'admin')
  with check (org_id = auth_org_id() and auth_role() = 'admin');
