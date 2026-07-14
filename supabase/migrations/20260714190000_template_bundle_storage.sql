-- Private storage bucket for immutable template bundle assets.

insert into storage.buckets (id, name, public)
values ('template-bundles', 'template-bundles', false)
on conflict (id) do update set public = false;

drop policy if exists "template bundle assets admin read" on storage.objects;
create policy "template bundle assets admin read"
  on storage.objects for select
  using (
    bucket_id = 'template-bundles'
    and (select auth_role()) = 'admin'
  );

drop policy if exists "template bundle assets admin insert" on storage.objects;
create policy "template bundle assets admin insert"
  on storage.objects for insert
  with check (
    bucket_id = 'template-bundles'
    and (select auth_role()) = 'admin'
  );

drop policy if exists "template bundle assets admin update" on storage.objects;
create policy "template bundle assets admin update"
  on storage.objects for update
  using (
    bucket_id = 'template-bundles'
    and (select auth_role()) = 'admin'
  )
  with check (
    bucket_id = 'template-bundles'
    and (select auth_role()) = 'admin'
  );
