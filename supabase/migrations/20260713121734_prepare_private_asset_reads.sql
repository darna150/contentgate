-- Allow every signed-in org member to request a short-lived asset URL.
-- The bucket remains public until the compatible application build is live.

drop policy if exists "admin product asset files read" on storage.objects;
drop policy if exists "org product asset files read" on storage.objects;
create policy "org product asset files read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'product-assets'
  and (storage.foldername(name))[1] = (select public.auth_org_id())::text
);
