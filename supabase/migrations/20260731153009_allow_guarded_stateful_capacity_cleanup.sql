-- Preserve append-only history for every normal caller while allowing the
-- narrowly validated, service-only staging disposer to remove its own bounded
-- synthetic evidence and identities.
create or replace function public.prevent_content_history_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'postgres'
     and current_setting(
       'contentgate.enterprise_stateful_capacity_cleanup',
       true
     ) = 'on' then
    return old;
  end if;
  raise exception 'generated content history is immutable';
end;
$$;

revoke execute on function public.prevent_content_history_mutation()
  from public, anon, authenticated, service_role;

alter function public.dispose_enterprise_stateful_capacity_fixture(
  uuid, uuid[], uuid[], uuid[], uuid[], uuid[], text
) rename to dispose_enterprise_stateful_capacity_fixture_v1;

revoke all on function public.dispose_enterprise_stateful_capacity_fixture_v1(
  uuid, uuid[], uuid[], uuid[], uuid[], uuid[], text
) from public, anon, authenticated, service_role;

create function public.dispose_enterprise_stateful_capacity_fixture(
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
