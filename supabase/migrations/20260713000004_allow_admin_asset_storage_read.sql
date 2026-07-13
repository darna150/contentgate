-- The Storage API resolves objects before deleting them. Give admins scoped
-- visibility into their organization folder without reopening public listing.

drop policy if exists "admin product asset files read" on storage.objects;

create policy "admin product asset files read" on storage.objects for select
  to authenticated
  using (
    bucket_id = 'product-assets'
    and (storage.foldername(name))[1] = (select auth_org_id())::text
    and (select auth_role()) = 'admin'
  );

