-- Scope private template bundle assets to the owning organization.

insert into storage.buckets (id, name, public)
values ('template-bundles', 'template-bundles', false)
on conflict (id) do update set public = false;

drop policy if exists "template bundle assets admin read" on storage.objects;
drop policy if exists "template bundle assets admin insert" on storage.objects;
drop policy if exists "template bundle assets admin update" on storage.objects;
drop policy if exists "org template bundle assets read" on storage.objects;
drop policy if exists "admin template bundle assets insert" on storage.objects;
drop policy if exists "admin template bundle assets update" on storage.objects;

create policy "org template bundle assets read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'template-bundles'
    and (storage.foldername(name))[1] = (select public.auth_org_id())::text
  );

create policy "admin template bundle assets insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'template-bundles'
    and (storage.foldername(name))[1] = (select public.auth_org_id())::text
    and (select public.auth_role()) = 'admin'
  );

create policy "admin template bundle assets update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'template-bundles'
    and (storage.foldername(name))[1] = (select public.auth_org_id())::text
    and (select public.auth_role()) = 'admin'
  )
  with check (
    bucket_id = 'template-bundles'
    and (storage.foldername(name))[1] = (select public.auth_org_id())::text
    and (select public.auth_role()) = 'admin'
  );
