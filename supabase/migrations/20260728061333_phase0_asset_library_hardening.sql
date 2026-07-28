-- Phase 0 Asset Library hardening.
--
-- Members are the client-facing role. They may discover and request only
-- approved assets. Admins and approvers retain workflow visibility.
-- Storage repeats the same state gate so an object path cannot bypass the
-- metadata policy.

-- Assets are retained for auditability and for historical generated material.
-- Archiving removes them from discovery and delivery without destroying the
-- original file or breaking an existing content record that refers to it.
alter table public.product_assets
  add column if not exists archived_at timestamptz;

drop policy if exists "org assets read" on public.product_assets;
create policy "role-aware product assets read"
on public.product_assets for select
to authenticated
using (
  org_id = (select public.auth_org_id())
  and (
    (approval_status = 'approved' and archived_at is null)
    or (select public.auth_role()) in ('admin', 'approver')
  )
);

drop policy if exists "org product asset files read" on storage.objects;
drop policy if exists "role-aware product asset files read" on storage.objects;
create policy "role-aware product asset files read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'product-assets'
  and (storage.foldername(name))[1] = (select public.auth_org_id())::text
  and exists (
    select 1
    from public.product_assets as asset
    where asset.org_id = (select public.auth_org_id())
      and asset.storage_path = name
      and (
        (asset.approval_status = 'approved' and asset.archived_at is null)
        or (select public.auth_role()) in ('admin', 'approver')
      )
  )
);

-- The library sorts newly uploaded assets by timestamp and UUID. This index
-- keeps the forthcoming cursor pagination index-backed for every tenant.
create index if not exists product_assets_org_created_id_idx
  on public.product_assets (org_id, created_at desc, id desc)
  where archived_at is null;

-- Collection counts are a compact aggregation instead of a full client-visible
-- scan of product_assets. SECURITY INVOKER keeps the role-aware RLS policy as
-- the source of truth.
create or replace function public.product_asset_scope_counts()
returns table (product_id uuid, asset_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select asset.product_id, count(*)::bigint
  from public.product_assets as asset
  where asset.org_id = (select public.auth_org_id())
    and asset.archived_at is null
  group by asset.product_id;
$$;

revoke all on function public.product_asset_scope_counts() from public, anon;
grant execute on function public.product_asset_scope_counts() to authenticated;
