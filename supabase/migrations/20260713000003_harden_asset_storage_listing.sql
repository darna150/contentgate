-- Public object URLs do not require a storage.objects SELECT policy. Asset
-- discovery happens through the org-scoped product_assets table instead.

drop policy if exists "product assets read" on storage.objects;
drop policy if exists "admin product asset files insert" on storage.objects;
drop policy if exists "admin product asset files update" on storage.objects;
drop policy if exists "admin product asset files delete" on storage.objects;

create policy "admin product asset files insert" on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'product-assets'
    and (storage.foldername(name))[1] = (select auth_org_id())::text
    and (select auth_role()) = 'admin'
  );

create policy "admin product asset files delete" on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'product-assets'
    and (storage.foldername(name))[1] = (select auth_org_id())::text
    and (select auth_role()) = 'admin'
  );

