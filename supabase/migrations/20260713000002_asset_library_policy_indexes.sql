-- Make the Asset Library write boundary explicit and index its uploader link.

create index if not exists product_assets_uploaded_by_idx
  on product_assets (uploaded_by);

drop policy if exists "org assets read" on product_assets;
drop policy if exists "org assets write" on product_assets;
drop policy if exists "admin product assets insert" on product_assets;
drop policy if exists "admin product assets update" on product_assets;
drop policy if exists "admin product assets delete" on product_assets;

create policy "org assets read" on product_assets for select
  to authenticated
  using (org_id = (select auth_org_id()));

create policy "admin product assets insert" on product_assets for insert
  to authenticated
  with check (
    org_id = (select auth_org_id())
    and (select auth_role()) = 'admin'
    and uploaded_by = (select auth.uid())
  );

create policy "admin product assets update" on product_assets for update
  to authenticated
  using (
    org_id = (select auth_org_id())
    and (select auth_role()) = 'admin'
  )
  with check (
    org_id = (select auth_org_id())
    and (select auth_role()) = 'admin'
  );

create policy "admin product assets delete" on product_assets for delete
  to authenticated
  using (
    org_id = (select auth_org_id())
    and (select auth_role()) = 'admin'
  );

