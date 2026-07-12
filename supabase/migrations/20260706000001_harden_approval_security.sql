-- Harden the live approval/security model.
-- Additive/idempotent: safe to apply after the existing production migrations.

-- ---------------------------------------------------------------------------
-- Profiles: users may edit profile display data, but never their own org/role.
-- ---------------------------------------------------------------------------
create or replace function protect_profile_membership_fields() returns trigger
language plpgsql security invoker set search_path = public, auth as $$
begin
  if new.id is distinct from old.id then
    raise exception 'Profile id cannot be changed';
  end if;

  if (
    new.org_id is distinct from old.org_id
    or new.role is distinct from old.role
  ) and coalesce(auth.role()::text, '') <> 'service_role' then
    raise exception 'Only trusted server actions may change profile org or role';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_membership_fields on profiles;
create trigger protect_profile_membership_fields
  before update on profiles
  for each row execute function protect_profile_membership_fields();

drop policy if exists "update own profile" on profiles;
drop policy if exists "update own profile name" on profiles;
create policy "update own profile name" on profiles for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and org_id = auth_org_id()
    and role = auth_role()
  );

revoke update on profiles from anon, authenticated;
grant update (full_name) on profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Documents: approved source material is a compliance input, so only admins
-- may insert/update it through authenticated clients.
-- ---------------------------------------------------------------------------
drop policy if exists "org documents insert" on documents;
drop policy if exists "org documents update" on documents;
drop policy if exists "admin documents insert" on documents;
drop policy if exists "admin documents update" on documents;

create policy "admin documents insert" on documents for insert
  with check (
    org_id = auth_org_id()
    and uploaded_by = auth.uid()
    and auth_role() = 'admin'
  );

create policy "admin documents update" on documents for update
  using (org_id = auth_org_id() and auth_role() = 'admin')
  with check (org_id = auth_org_id() and auth_role() = 'admin');

-- Document storage follows the same admin-only write boundary.
drop policy if exists "org folder insert" on storage.objects;
drop policy if exists "admin document files insert" on storage.objects;
drop policy if exists "admin document files delete" on storage.objects;

create policy "admin document files insert" on storage.objects for insert
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth_org_id()::text
    and auth_role() = 'admin'
  );

create policy "admin document files delete" on storage.objects for delete
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth_org_id()::text
    and auth_role() = 'admin'
  );

-- Product asset files are public-readable, but only admins should write,
-- update, or delete brand assets in storage.
drop policy if exists "product assets write" on storage.objects;
drop policy if exists "product assets update" on storage.objects;
drop policy if exists "product assets delete" on storage.objects;
drop policy if exists "admin product asset files insert" on storage.objects;
drop policy if exists "admin product asset files update" on storage.objects;
drop policy if exists "admin product asset files delete" on storage.objects;

create policy "admin product asset files insert" on storage.objects for insert
  with check (
    bucket_id = 'product-assets'
    and (storage.foldername(name))[1] = auth_org_id()::text
    and auth_role() = 'admin'
  );

create policy "admin product asset files update" on storage.objects for update
  using (
    bucket_id = 'product-assets'
    and (storage.foldername(name))[1] = auth_org_id()::text
    and auth_role() = 'admin'
  )
  with check (
    bucket_id = 'product-assets'
    and (storage.foldername(name))[1] = auth_org_id()::text
    and auth_role() = 'admin'
  );

create policy "admin product asset files delete" on storage.objects for delete
  using (
    bucket_id = 'product-assets'
    and (storage.foldername(name))[1] = auth_org_id()::text
    and auth_role() = 'admin'
  );

-- ---------------------------------------------------------------------------
-- Generated content: authenticated clients may create/edit only drafts. Review
-- and approval transitions happen through trusted server actions.
-- ---------------------------------------------------------------------------
drop policy if exists "org content insert" on generated_content;
drop policy if exists "author or approver update" on generated_content;
drop policy if exists "authors create draft content" on generated_content;
drop policy if exists "authors edit own draft content" on generated_content;

create policy "authors create draft content" on generated_content for insert
  with check (
    org_id = auth_org_id()
    and created_by = auth.uid()
    and status = 'draft'
    and approved_by is null
    and approved_at is null
  );

create policy "authors edit own draft content" on generated_content for update
  using (
    org_id = auth_org_id()
    and created_by = auth.uid()
    and status in ('draft', 'rejected', 'approved')
  )
  with check (
    org_id = auth_org_id()
    and created_by = auth.uid()
    and status in ('draft', 'rejected')
    and approved_by is null
    and approved_at is null
  );
