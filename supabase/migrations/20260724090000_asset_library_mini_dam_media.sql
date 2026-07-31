-- Asset Library mini-DAM media support.
-- Extends the existing product_assets table for brand-wide image/video assets
-- without replacing the current table, bucket, or product workspace flow.

alter table public.product_assets
  add column if not exists media_kind text,
  add column if not exists checksum_sha256 text,
  add column if not exists duration_seconds numeric(10, 3),
  add column if not exists aspect_ratio numeric(12, 6),
  add column if not exists poster_storage_path text,
  add column if not exists category text,
  add column if not exists download_count integer not null default 0,
  add column if not exists last_downloaded_at timestamptz;

update public.product_assets
set media_kind = case
  when coalesce(mime_type, '') like 'video/%' then 'video'
  else 'image'
end
where media_kind is null;

update public.product_assets
set aspect_ratio = round((width_pixels::numeric / nullif(height_pixels, 0)), 6)
where aspect_ratio is null
  and width_pixels is not null
  and height_pixels is not null
  and height_pixels > 0;

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'product_assets_asset_type_check'
  ) then
    alter table public.product_assets
      drop constraint product_assets_asset_type_check;
  end if;

  alter table public.product_assets
    add constraint product_assets_asset_type_check
    check (asset_type in ('logo', 'packshot', 'background', 'image', 'video'));

  if exists (
    select 1 from pg_constraint where conname = 'product_assets_approval_status_check'
  ) then
    alter table public.product_assets
      drop constraint product_assets_approval_status_check;
  end if;

  alter table public.product_assets
    add constraint product_assets_approval_status_check
    check (approval_status in ('processing', 'pending', 'approved', 'rejected', 'archived'));

  if not exists (
    select 1 from pg_constraint where conname = 'product_assets_media_kind_check'
  ) then
    alter table public.product_assets
      add constraint product_assets_media_kind_check
      check (media_kind in ('image', 'video'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'product_assets_checksum_sha256_check'
  ) then
    alter table public.product_assets
      add constraint product_assets_checksum_sha256_check
      check (checksum_sha256 is null or checksum_sha256 ~ '^[a-f0-9]{64}$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'product_assets_duration_check'
  ) then
    alter table public.product_assets
      add constraint product_assets_duration_check
      check (duration_seconds is null or duration_seconds >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'product_assets_aspect_ratio_check'
  ) then
    alter table public.product_assets
      add constraint product_assets_aspect_ratio_check
      check (aspect_ratio is null or aspect_ratio > 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'product_assets_download_count_check'
  ) then
    alter table public.product_assets
      add constraint product_assets_download_count_check
      check (download_count >= 0);
  end if;
end;
$$;

create index if not exists product_assets_mini_dam_browse_idx
  on public.product_assets (org_id, media_kind, approval_status, created_at desc);

create index if not exists product_assets_product_browse_idx
  on public.product_assets (org_id, product_id, media_kind, approval_status, created_at desc);

create index if not exists product_assets_category_idx
  on public.product_assets (org_id, category, created_at desc)
  where category is not null;

create index if not exists product_assets_checksum_idx
  on public.product_assets (org_id, checksum_sha256)
  where checksum_sha256 is not null;

update storage.buckets
set
  public = false,
  file_size_limit = 104857600,
  allowed_mime_types = array[
    'image/avif',
    'image/gif',
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ]
where id = 'product-assets';
