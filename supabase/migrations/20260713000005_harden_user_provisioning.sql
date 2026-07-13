-- Only trusted server-side provisioning may assign organization membership or roles.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_org uuid;
  target_role public.user_role;
begin
  begin
    target_org := nullif(new.raw_app_meta_data ->> 'org_id', '')::uuid;
    target_role := coalesce(
      nullif(new.raw_app_meta_data ->> 'role', '')::public.user_role,
      'member'::public.user_role
    );
  exception
    when invalid_text_representation then
      raise exception 'Invalid trusted user provisioning metadata';
  end;

  if target_org is null or not exists (
    select 1 from public.organizations where id = target_org
  ) then
    raise exception 'User must be provisioned with a valid organization';
  end if;

  insert into public.profiles (id, org_id, role, full_name)
  values (
    new.id,
    target_org,
    target_role,
    new.raw_user_meta_data ->> 'full_name'
  );

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to supabase_auth_admin;
