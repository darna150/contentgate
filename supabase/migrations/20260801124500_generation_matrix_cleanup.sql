-- The all-format generation gate creates one draft per active template
-- variant, which intentionally exceeds the two-row envelope of the generic
-- stateful-capacity fixture disposer. Give that gate its own narrower cleanup:
-- one canonical-demo user, an exact synthetic email/name pattern, and at most
-- 64 content rows owned by that user. No production/customer identity can
-- satisfy this contract accidentally.
create or replace function public.dispose_generation_matrix_fixture(
  p_org_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_org_id constant uuid := '77777777-7777-4777-8777-777777777777';
  target_content_ids uuid[] := '{}'::uuid[];
  identity_is_valid boolean := false;
begin
  if p_org_id <> expected_org_id then
    raise exception 'generation matrix cleanup is restricted to the canonical demo organization';
  end if;

  select exists(
    select 1
    from public.profiles as profile
    join auth.users as auth_user on auth_user.id = profile.id
    where profile.id = p_user_id
      and profile.org_id = p_org_id
      and profile.full_name like 'Generation matrix %'
      and auth_user.email ~ '^generation-matrix-[a-f0-9]{8}@contentgate[.]example$'
  ) into identity_is_valid;
  if not identity_is_valid then
    raise exception 'generation matrix cleanup identity scope is invalid';
  end if;

  select coalesce(array_agg(content.id), '{}'::uuid[])
  into target_content_ids
  from public.generated_content as content
  where content.org_id = p_org_id
    and content.created_by = p_user_id;
  if cardinality(target_content_ids) > 64 then
    raise exception 'generation matrix cleanup exceeds 64 generated rows';
  end if;

  perform set_config('contentgate.enterprise_stateful_capacity_cleanup', 'on', true);
  delete from public.render_jobs
  where org_id = p_org_id and generated_content_id = any(target_content_ids);
  delete from public.generated_content_events
  where org_id = p_org_id and content_id = any(target_content_ids);
  delete from public.generated_content_revisions
  where org_id = p_org_id and content_id = any(target_content_ids);
  delete from public.generated_content
  where org_id = p_org_id and id = any(target_content_ids);
  delete from public.audit_log
  where org_id = p_org_id and actor_id = p_user_id;
  delete from public.uiux_measurement_events
  where org_id = p_org_id and actor_id = p_user_id;

  return jsonb_build_object(
    'status', 'disposed',
    'organization_id', p_org_id,
    'user_id', p_user_id,
    'content_count', cardinality(target_content_ids)
  );
end;
$$;

revoke all on function public.dispose_generation_matrix_fixture(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.dispose_generation_matrix_fixture(uuid, uuid)
  to service_role;
