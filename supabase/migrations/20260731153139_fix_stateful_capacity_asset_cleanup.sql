-- Published assets point at their immutable current version, while the version
-- points back to the asset. Detach that pointer only for the explicitly scoped
-- synthetic rows before the validated disposer removes both sides.
create or replace function public.dispose_enterprise_stateful_capacity_fixture(
  p_org_id uuid,
  p_user_ids uuid[],
  p_content_ids uuid[],
  p_asset_ids uuid[],
  p_session_ids uuid[],
  p_query_ids uuid[],
  p_worker_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config(
    'contentgate.enterprise_stateful_capacity_cleanup',
    'on',
    true
  );

  update public.product_assets as asset
  set current_version_id = null
  where asset.org_id = p_org_id
    and asset.id = any(coalesce(p_asset_ids, '{}'::uuid[]))
    and asset.uploaded_by = any(coalesce(p_user_ids, '{}'::uuid[]))
    and asset.title like 'Enterprise stateful QA %';

  return public.dispose_enterprise_stateful_capacity_fixture_v1(
    p_org_id,
    p_user_ids,
    p_content_ids,
    p_asset_ids,
    p_session_ids,
    p_query_ids,
    p_worker_id
  );
end;
$$;

revoke all on function public.dispose_enterprise_stateful_capacity_fixture(
  uuid, uuid[], uuid[], uuid[], uuid[], uuid[], text
) from public, anon, authenticated, service_role;
grant execute on function public.dispose_enterprise_stateful_capacity_fixture(
  uuid, uuid[], uuid[], uuid[], uuid[], uuid[], text
) to service_role;
