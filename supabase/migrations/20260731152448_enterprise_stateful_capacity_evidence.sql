-- Make a completed approved download and its immutable workflow receipt one
-- database transaction. The render route is the only caller and invokes this
-- function only after the output object has been stored successfully.
create or replace function public.record_render_job_event(
  p_content_id uuid,
  p_output_format text,
  p_input_sha256 text,
  p_payload jsonb default '{}'::jsonb,
  p_diagnostics jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  content_row record;
  inserted_id uuid;
  normalized_format text;
  output_path text;
  export_actor_id uuid := (select auth.uid());
  export_actor_name text;
  export_surface text;
begin
  normalized_format := case
    when p_output_format = 'jpeg' then 'jpg'
    else p_output_format
  end;

  if normalized_format not in ('jpg', 'pdf', 'png', 'svg') then
    raise exception 'unsupported render format';
  end if;
  if p_input_sha256 is null or p_input_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid render input hash';
  end if;
  if export_actor_id is null then
    raise exception 'authentication required';
  end if;

  output_path := nullif(p_payload->>'output_storage_path', '');
  export_surface := case
    when p_payload->>'surface' in ('api', 'content_detail', 'studio')
      then p_payload->>'surface'
    else 'api'
  end;

  select
    content.id,
    content.org_id,
    content.product_id,
    content.template_version_id,
    content.template_variant_id,
    content.renderer_version,
    content.status,
    content.current_revision_number,
    content.approved_revision_number,
    coalesce(nullif(profile.full_name, ''), 'Unknown user') as actor_name
  into content_row
  from public.generated_content as content
  join public.profiles as profile
    on profile.id = export_actor_id
   and profile.org_id = content.org_id
  where content.id = p_content_id
    and content.org_id = public.auth_org_id();

  if not found then
    raise exception 'content not found';
  end if;
  export_actor_name := content_row.actor_name;

  if content_row.status <> 'approved'
     or content_row.approved_revision_number is null
     or content_row.approved_revision_number <> content_row.current_revision_number then
    raise exception 'only the currently approved revision can be rendered';
  end if;
  if content_row.template_version_id is null
     or content_row.template_variant_id is null then
    raise exception 'render jobs require a platform template version and variant';
  end if;
  if output_path is not null
     and output_path !~ ('^' || content_row.org_id::text || '/') then
    raise exception 'render output path must be scoped to the content organization';
  end if;

  insert into public.render_jobs (
    org_id,
    product_id,
    generated_content_id,
    template_version_id,
    template_variant_id,
    renderer_version,
    input_sha256,
    output_format,
    status,
    payload,
    diagnostics,
    output_storage_path,
    completed_at
  )
  values (
    content_row.org_id,
    content_row.product_id,
    content_row.id,
    content_row.template_version_id,
    content_row.template_variant_id,
    coalesce(content_row.renderer_version, 'template-platform-v1'),
    p_input_sha256,
    normalized_format,
    'completed',
    coalesce(p_payload, '{}'::jsonb),
    coalesce(p_diagnostics, '{}'::jsonb),
    output_path,
    now()
  )
  returning id into inserted_id;

  insert into public.generated_content_events (
    org_id,
    content_id,
    actor_id,
    actor_name,
    revision_number,
    event_type,
    detail
  ) values (
    content_row.org_id,
    content_row.id,
    export_actor_id,
    export_actor_name,
    content_row.current_revision_number,
    'content.exported',
    jsonb_strip_nulls(jsonb_build_object(
      'format', case when normalized_format = 'jpg' then 'jpeg' else normalized_format end,
      'size', nullif(p_payload->>'variant_key', ''),
      'surface', export_surface,
      'render_job_id', inserted_id,
      'input_sha256', p_input_sha256
    ))
  );

  return inserted_id;
end;
$$;

revoke all on function public.record_render_job_event(uuid, text, text, jsonb, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.record_render_job_event(uuid, text, text, jsonb, jsonb)
  to authenticated;

-- Append-only history must stay protected from general service clients. This
-- narrow release-QA disposer permits cleanup only for bounded synthetic users
-- in the canonical demo organization. Storage objects and Auth identities are
-- removed separately through their supported APIs.
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
declare
  expected_org_id constant uuid := '77777777-7777-4777-8777-777777777777';
  matched_count integer;
  target_content_ids uuid[] := '{}'::uuid[];
  target_asset_ids uuid[] := '{}'::uuid[];
  target_session_ids uuid[] := '{}'::uuid[];
  target_query_ids uuid[] := '{}'::uuid[];
begin
  if p_org_id <> expected_org_id then
    raise exception 'stateful capacity cleanup is restricted to the canonical demo organization';
  end if;
  if coalesce(cardinality(p_user_ids), 0) not between 1 and 3
     or coalesce(cardinality(p_content_ids), 0) > 2
     or coalesce(cardinality(p_asset_ids), 0) > 2
     or coalesce(cardinality(p_session_ids), 0) > 2
     or coalesce(cardinality(p_query_ids), 0) > 2 then
    raise exception 'stateful capacity cleanup exceeds its bounded fixture envelope';
  end if;
  if p_worker_id is not null and p_worker_id !~ '^enterprise-capacity-[a-f0-9]{8}$' then
    raise exception 'stateful capacity cleanup worker id is invalid';
  end if;

  select count(*) into matched_count
  from public.profiles as profile
  where profile.org_id = p_org_id
    and profile.id = any(p_user_ids)
    and profile.full_name like 'Enterprise stateful %';
  if matched_count <> cardinality(p_user_ids) then
    raise exception 'stateful capacity cleanup user scope is invalid';
  end if;

  select coalesce(array_agg(content.id), '{}'::uuid[]) into target_content_ids
  from public.generated_content as content
  where content.org_id = p_org_id
    and content.created_by = any(p_user_ids);
  if cardinality(target_content_ids) > 2
     or not (coalesce(p_content_ids, '{}'::uuid[]) <@ target_content_ids) then
    raise exception 'stateful capacity cleanup content scope is invalid';
  end if;

  select coalesce(array_agg(asset.id), '{}'::uuid[]) into target_asset_ids
  from public.product_assets as asset
  where asset.org_id = p_org_id
    and asset.uploaded_by = any(p_user_ids)
    and asset.title like 'Enterprise stateful QA %';
  if cardinality(target_asset_ids) > 2
     or not (coalesce(p_asset_ids, '{}'::uuid[]) <@ target_asset_ids) then
    raise exception 'stateful capacity cleanup asset scope is invalid';
  end if;

  select coalesce(array_agg(session.id), '{}'::uuid[]) into target_session_ids
  from public.notebook_sessions as session
  where session.org_id = p_org_id
    and session.user_id = any(p_user_ids)
    and session.title like 'Enterprise capacity %';
  if cardinality(target_session_ids) > 2
     or not (coalesce(p_session_ids, '{}'::uuid[]) <@ target_session_ids) then
    raise exception 'stateful capacity cleanup notebook scope is invalid';
  end if;

  select coalesce(array_agg(knowledge_query.id), '{}'::uuid[]) into target_query_ids
  from public.knowledge_queries as knowledge_query
  where knowledge_query.org_id = p_org_id
    and knowledge_query.user_id = any(p_user_ids);
  if cardinality(target_query_ids) > 2
     or not (coalesce(p_query_ids, '{}'::uuid[]) <@ target_query_ids) then
    raise exception 'stateful capacity cleanup query scope is invalid';
  end if;

  delete from public.knowledge_query_feedback
  where org_id = p_org_id and query_id = any(target_query_ids);
  delete from public.knowledge_queries
  where org_id = p_org_id and id = any(target_query_ids);
  delete from public.notebook_sessions
  where org_id = p_org_id and id = any(target_session_ids);
  delete from public.render_jobs
  where org_id = p_org_id and generated_content_id = any(target_content_ids);
  delete from public.generated_content_events
  where org_id = p_org_id and content_id = any(target_content_ids);
  delete from public.generated_content_revisions
  where org_id = p_org_id and content_id = any(target_content_ids);
  delete from public.generated_content
  where org_id = p_org_id and id = any(target_content_ids);
  delete from public.product_asset_versions
  where org_id = p_org_id and asset_id = any(target_asset_ids);
  delete from public.asset_media_jobs
  where org_id = p_org_id and asset_id = any(target_asset_ids);
  delete from public.product_assets
  where org_id = p_org_id and id = any(target_asset_ids);
  delete from public.audit_log
  where org_id = p_org_id and actor_id = any(p_user_ids);
  delete from public.uiux_measurement_events
  where org_id = p_org_id and actor_id = any(p_user_ids);
  if p_worker_id is not null then
    delete from public.asset_media_worker_heartbeats
    where worker_id = p_worker_id;
  end if;

  return jsonb_build_object(
    'status', 'disposed',
    'organization_id', p_org_id,
    'user_count', cardinality(p_user_ids),
    'content_count', cardinality(target_content_ids),
    'asset_count', cardinality(target_asset_ids),
    'session_count', cardinality(target_session_ids),
    'query_count', cardinality(target_query_ids)
  );
end;
$$;

revoke all on function public.dispose_enterprise_stateful_capacity_fixture(
  uuid, uuid[], uuid[], uuid[], uuid[], uuid[], text
) from public, anon, authenticated, service_role;
grant execute on function public.dispose_enterprise_stateful_capacity_fixture(
  uuid, uuid[], uuid[], uuid[], uuid[], uuid[], text
) to service_role;
