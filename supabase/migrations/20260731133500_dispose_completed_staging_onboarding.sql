create or replace function public.dispose_completed_onboarding_run(
  p_run_id uuid,
  p_confirmation text,
  p_finalize boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_run public.onboarding_runs%rowtype;
  target_org_id uuid;
  target_workspace_key text;
  disposable_user_ids jsonb;
begin
  select * into target_run
  from public.onboarding_runs
  where id = p_run_id
  for update;
  if not found then raise exception 'Onboarding run not found'; end if;
  if target_run.environment <> 'staging' or target_run.status <> 'completed' then
    raise exception 'Only completed staging onboarding runs can be disposed';
  end if;
  if target_run.workspace_key !~ '^qa-onboarding-' then
    raise exception 'Only qa-onboarding-* workspaces can be disposed';
  end if;
  if p_confirmation <> 'DELETE STAGING ' || target_run.workspace_key then
    raise exception 'Disposable onboarding cleanup confirmation does not match';
  end if;

  if target_run.organization_id is null then
    if target_run.report #>> '{disposal,status}' = 'completed' then
      return jsonb_build_object(
        'runId', target_run.id,
        'workspaceKey', target_run.workspace_key,
        'status', 'already_disposed'
      );
    end if;
    raise exception 'Completed onboarding run has no organization to dispose';
  end if;
  target_org_id := target_run.organization_id;

  select organizations.workspace_key into target_workspace_key
  from public.organizations
  where organizations.id = target_org_id;
  if target_workspace_key is distinct from target_run.workspace_key then
    raise exception 'Onboarding run organization does not match its workspace key';
  end if;

  select coalesce(jsonb_agg(profiles.id order by profiles.id), '[]'::jsonb)
  into disposable_user_ids
  from public.profiles
  where profiles.org_id = target_org_id;

  if p_finalize then
    if jsonb_array_length(disposable_user_ids) > 0 then
      raise exception 'Delete disposable Auth users before finalizing cleanup';
    end if;
    delete from public.organizations
    where organizations.id = target_org_id
      and organizations.workspace_key = target_run.workspace_key;
    update public.onboarding_runs
    set report = jsonb_set(
          coalesce(report, '{}'::jsonb),
          '{disposal}',
          jsonb_build_object('status', 'completed', 'disposedAt', now()),
          true
        ),
        updated_at = now()
    where id = target_run.id;
    return jsonb_build_object(
      'runId', target_run.id,
      'organizationId', target_org_id,
      'workspaceKey', target_run.workspace_key,
      'status', 'disposed'
    );
  end if;

  delete from public.generated_content_events where org_id = target_org_id;
  delete from public.generated_content_revisions where org_id = target_org_id;
  delete from public.render_jobs where org_id = target_org_id;
  delete from public.generated_content where org_id = target_org_id;
  delete from public.knowledge_query_feedback where org_id = target_org_id;
  delete from public.knowledge_queries where org_id = target_org_id;
  delete from public.notebook_sessions where org_id = target_org_id;
  delete from public.uiux_measurement_events where org_id = target_org_id;
  delete from public.asset_media_jobs where org_id = target_org_id;
  delete from public.product_asset_versions where org_id = target_org_id;
  delete from public.product_template_assignments where org_id = target_org_id;
  delete from public.template_import_runs where org_id = target_org_id;
  delete from public.template_assets where org_id = target_org_id;
  delete from public.template_variants where org_id = target_org_id;
  delete from public.template_versions where org_id = target_org_id;
  delete from public.template_families where org_id = target_org_id;
  delete from public.knowledge_chunks where org_id = target_org_id;
  delete from public.product_claims where org_id = target_org_id;
  delete from public.documents where org_id = target_org_id;
  delete from public.campaigns where org_id = target_org_id;
  delete from public.product_assets where org_id = target_org_id;
  delete from public.product_templates where org_id = target_org_id;
  update public.brand_voices set current_version_id = null where org_id = target_org_id;
  delete from public.brand_voice_versions where org_id = target_org_id;
  delete from public.brand_voices where org_id = target_org_id;
  delete from public.products where org_id = target_org_id;
  delete from public.templates where org_id = target_org_id;
  delete from public.organization_feature_flags where org_id = target_org_id;
  delete from public.audit_log where org_id = target_org_id;

  update public.onboarding_runs
  set report = jsonb_set(
        coalesce(report, '{}'::jsonb),
        '{disposal}',
        jsonb_build_object('status', 'awaiting_auth_cleanup', 'preparedAt', now()),
        true
      ),
      updated_at = now()
  where id = target_run.id;

  return jsonb_build_object(
    'runId', target_run.id,
    'organizationId', target_org_id,
    'workspaceKey', target_run.workspace_key,
    'userIds', disposable_user_ids,
    'status', 'awaiting_auth_cleanup'
  );
end;
$$;

revoke all on function public.dispose_completed_onboarding_run(uuid, text, boolean)
  from public, anon, authenticated;
grant execute on function public.dispose_completed_onboarding_run(uuid, text, boolean)
  to service_role;
