-- Phase 2: immutable asset versions and recoverable lifecycle state.

create table if not exists public.product_asset_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  asset_id uuid not null,
  version_number integer not null,
  storage_path text not null,
  preview_storage_path text,
  poster_storage_path text,
  transcoded_storage_path text,
  mime_type text not null,
  file_size_bytes bigint not null,
  checksum_sha256 text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  constraint product_asset_versions_org_asset_fkey
    foreign key (org_id, asset_id)
    references public.product_assets (org_id, id)
    on delete cascade,
  constraint product_asset_versions_number_valid check (version_number > 0),
  constraint product_asset_versions_size_valid check (file_size_bytes > 0),
  constraint product_asset_versions_checksum_valid
    check (checksum_sha256 is null or checksum_sha256 ~ '^[a-f0-9]{64}$'),
  unique (asset_id, version_number),
  unique (org_id, id)
);

alter table public.product_assets
  add column if not exists current_version_id uuid,
  add column if not exists purge_after timestamptz,
  add column if not exists purged_at timestamptz;

insert into public.product_asset_versions (
  org_id, asset_id, version_number, storage_path, preview_storage_path,
  poster_storage_path, transcoded_storage_path, mime_type, file_size_bytes,
  checksum_sha256, created_at, created_by
)
select
  asset.org_id, asset.id, 1, asset.storage_path, asset.preview_storage_path,
  asset.poster_storage_path, asset.transcoded_storage_path, asset.mime_type,
  asset.file_size_bytes, asset.checksum_sha256, asset.created_at, asset.uploaded_by
from public.product_assets as asset
where not exists (
  select 1 from public.product_asset_versions as version
  where version.asset_id = asset.id
);

update public.product_assets as asset
set current_version_id = version.id
from public.product_asset_versions as version
where version.asset_id = asset.id
  and version.version_number = 1
  and asset.current_version_id is null;

alter table public.product_assets
  drop constraint if exists product_assets_current_version_fkey,
  add constraint product_assets_current_version_fkey
    foreign key (org_id, current_version_id)
    references public.product_asset_versions (org_id, id)
    on delete restrict;

create index if not exists product_asset_versions_asset_created_idx
  on public.product_asset_versions (asset_id, version_number desc);
create index if not exists product_assets_purge_due_idx
  on public.product_assets (purge_after)
  where archived_at is not null and purged_at is null;

alter table public.product_asset_versions enable row level security;
create policy "role-aware asset versions read"
  on public.product_asset_versions for select
  to authenticated
  using (
    org_id = (select public.auth_org_id())
    and exists (
      select 1 from public.product_assets as asset
      where asset.id = asset_id
        and asset.org_id = (select public.auth_org_id())
        and (
          (asset.approval_status = 'approved' and asset.archived_at is null)
          or (select public.auth_role()) in ('admin', 'approver')
        )
    )
  );

grant select on table public.product_asset_versions to authenticated;
revoke all on table public.product_asset_versions from public, anon;

-- Published originals are append-only. The sole client-side deletion exception
-- is cancellation of the caller's own incomplete direct upload.
drop policy if exists "admin product asset files update" on storage.objects;
drop policy if exists "admin product asset files delete" on storage.objects;
drop policy if exists "owner processing product asset files delete" on storage.objects;
create policy "owner processing product asset files delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'product-assets'
    and exists (
      select 1 from public.product_assets as asset
      where asset.storage_path = name
        and asset.org_id = (select public.auth_org_id())
        and asset.uploaded_by = (select auth.uid())
        and asset.approval_status = 'processing'
        and asset.current_version_id is null
    )
  );
