-- Asset Library foundation.
-- Adds governed metadata to the existing product-scoped asset records without
-- changing the current public-read storage behavior.

alter table product_assets
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists alt_text text,
  add column if not exists original_file_name text,
  add column if not exists mime_type text,
  add column if not exists file_size_bytes bigint,
  add column if not exists width_pixels integer,
  add column if not exists height_pixels integer,
  add column if not exists tags text[] not null default '{}',
  add column if not exists approval_status text not null default 'approved',
  add column if not exists uploaded_by uuid references profiles(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

update product_assets
set
  title = coalesce(
    nullif(title, ''),
    initcap(replace(asset_type, '_', ' '))
  ),
  original_file_name = coalesce(
    nullif(original_file_name, ''),
    regexp_replace(
      regexp_replace(storage_path, '^.*/', ''),
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-',
      '',
      'i'
    )
  )
where title is null or title = '' or original_file_name is null or original_file_name = '';

alter table product_assets
  alter column title set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'product_assets_asset_type_check'
  ) then
    alter table product_assets
      add constraint product_assets_asset_type_check
      check (asset_type in ('logo', 'packshot', 'background', 'image'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'product_assets_approval_status_check'
  ) then
    alter table product_assets
      add constraint product_assets_approval_status_check
      check (approval_status in ('pending', 'approved', 'rejected', 'archived'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'product_assets_file_size_check'
  ) then
    alter table product_assets
      add constraint product_assets_file_size_check
      check (file_size_bytes is null or file_size_bytes >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'product_assets_dimensions_check'
  ) then
    alter table product_assets
      add constraint product_assets_dimensions_check
      check (
        (width_pixels is null and height_pixels is null)
        or (width_pixels > 0 and height_pixels > 0)
      );
  end if;
end;
$$;

create index if not exists product_assets_library_filter_idx
  on product_assets (org_id, product_id, approval_status, asset_type, created_at desc);

create index if not exists product_assets_tags_idx
  on product_assets using gin (tags);

create or replace function set_product_asset_updated_at() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists product_assets_set_updated_at on product_assets;
create trigger product_assets_set_updated_at
  before update on product_assets
  for each row execute function set_product_asset_updated_at();

