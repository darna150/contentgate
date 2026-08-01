-- A disabled profile must lose every authenticated database capability even
-- when the caller still holds a cryptographically valid access token issued
-- before the disable action. RLS already uses auth_org_id(), which fails
-- closed for disabled profiles. These older SECURITY DEFINER RPCs predate the
-- lifecycle control and therefore need the same explicit active-profile gate.

create or replace function public.enable_admin_mfa_requirement()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_org_id uuid;
begin
  if actor_id is null then
    raise exception 'authentication required';
  end if;
  if coalesce((select auth.jwt() ->> 'aal'), 'aal1') <> 'aal2' then
    raise exception 'administrator MFA verification is required';
  end if;

  select profile.org_id into target_org_id
  from public.profiles as profile
  where profile.id = actor_id
    and profile.role = 'admin'::public.user_role
    and profile.access_status = 'active';

  if target_org_id is null then
    raise exception 'active administrator access is required';
  end if;

  update public.organizations
  set require_admin_mfa = true
  where id = target_org_id;

  insert into public.audit_log (
    org_id, actor_id, action, entity_type, entity_id, detail
  ) values (
    target_org_id,
    actor_id,
    'admin_mfa_required',
    'organization',
    target_org_id,
    jsonb_build_object('required', true)
  );

  return true;
end;
$$;

create or replace function public.consume_api_rate_limit(p_scope text)
returns table (
  allowed boolean,
  request_limit integer,
  remaining integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  rate_actor_id uuid := (select auth.uid());
  rate_limit integer;
  window_seconds integer;
  rate_window_start timestamptz;
  current_count integer;
  retry_seconds integer;
begin
  if rate_actor_id is null then
    raise exception 'authentication required';
  end if;
  if not exists (
    select 1
    from public.profiles as profile
    where profile.id = rate_actor_id
      and profile.access_status = 'active'
  ) then
    raise exception 'active account access is required';
  end if;

  case p_scope
    when 'knowledge.ask' then
      rate_limit := 10;
      window_seconds := 60;
    when 'content.generate' then
      rate_limit := 20;
      window_seconds := 300;
    when 'legacy.generate' then
      rate_limit := 3;
      window_seconds := 300;
    else
      raise exception 'unsupported rate limit scope';
  end case;

  rate_window_start := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / window_seconds) * window_seconds
  );

  insert into private.api_rate_limits (
    scope, actor_id, window_start, request_count
  ) values (
    p_scope, rate_actor_id, rate_window_start, 1
  )
  on conflict (scope, actor_id, window_start)
  do update set request_count = private.api_rate_limits.request_count + 1
  returning request_count into current_count;

  delete from private.api_rate_limits
  where actor_id = rate_actor_id
    and window_start < clock_timestamp() - interval '1 day';

  retry_seconds := greatest(
    1,
    ceil(extract(epoch from (
      rate_window_start + make_interval(secs => window_seconds) - clock_timestamp()
    )))::integer
  );

  return query select
    current_count <= rate_limit,
    rate_limit,
    greatest(rate_limit - current_count, 0),
    retry_seconds;
end;
$$;

create or replace function public.transition_generated_content(
  p_content_id uuid,
  p_action text,
  p_note text default null
)
returns table(status public.content_status, revision_number integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  workflow_actor_id uuid := (select auth.uid());
  workflow_actor_org uuid;
  workflow_actor_role public.user_role;
  workflow_actor_name text;
  content_row public.generated_content%rowtype;
begin
  if workflow_actor_id is null then
    raise exception 'authentication required';
  end if;

  select profile.org_id, profile.role,
         coalesce(nullif(profile.full_name, ''), 'Unknown user')
  into workflow_actor_org, workflow_actor_role, workflow_actor_name
  from public.profiles profile
  where profile.id = workflow_actor_id
    and profile.access_status = 'active';

  if workflow_actor_org is null then
    raise exception 'active account access is required';
  end if;

  select content.*
  into content_row
  from public.generated_content content
  where content.id = p_content_id
  for update;

  if content_row.id is null or content_row.org_id <> workflow_actor_org then
    raise exception 'content not found';
  end if;

  if p_action = 'submit' then
    if content_row.status not in ('draft', 'rejected') then
      raise exception 'only draft or rejected content can be submitted';
    end if;
    if content_row.created_by <> workflow_actor_id and workflow_actor_role <> 'admin' then
      raise exception 'only the author or an admin can submit this content';
    end if;

    update public.generated_content
    set status = 'in_review', rejection_note = null,
        approved_by = null, approved_at = null
    where id = p_content_id;

    insert into public.generated_content_events (
      org_id, content_id, actor_id, actor_name, revision_number, event_type, detail
    ) values (
      content_row.org_id, content_row.id, workflow_actor_id, workflow_actor_name,
      content_row.current_revision_number, 'content.submitted', '{}'::jsonb
    );
  elsif p_action = 'approve' then
    if workflow_actor_role not in ('admin', 'approver') then
      raise exception 'only approvers can approve content';
    end if;
    if content_row.status <> 'in_review' then
      raise exception 'only content in review can be approved';
    end if;

    update public.generated_content
    set status = 'approved', approved_by = workflow_actor_id,
        approved_at = now(), rejection_note = null
    where id = p_content_id;

    insert into public.generated_content_events (
      org_id, content_id, actor_id, actor_name, revision_number, event_type, detail
    ) values (
      content_row.org_id, content_row.id, workflow_actor_id, workflow_actor_name,
      content_row.current_revision_number, 'content.approved', '{}'::jsonb
    );
  elsif p_action = 'reject' then
    if workflow_actor_role not in ('admin', 'approver') then
      raise exception 'only approvers can reject content';
    end if;
    if content_row.status <> 'in_review' then
      raise exception 'only content in review can be rejected';
    end if;
    if nullif(btrim(p_note), '') is null then
      raise exception 'a rejection note is required';
    end if;
    if length(p_note) > 2000 then
      raise exception 'rejection note is too long';
    end if;

    update public.generated_content
    set status = 'rejected', rejection_note = btrim(p_note),
        approved_by = null, approved_at = null
    where id = p_content_id;

    insert into public.generated_content_events (
      org_id, content_id, actor_id, actor_name, revision_number, event_type, detail
    ) values (
      content_row.org_id, content_row.id, workflow_actor_id, workflow_actor_name,
      content_row.current_revision_number, 'content.rejected',
      jsonb_build_object('note', btrim(p_note))
    );
  else
    raise exception 'unsupported workflow action';
  end if;

  return query
  select content.status, content.current_revision_number
  from public.generated_content content
  where content.id = p_content_id;
end;
$$;

create or replace function public.record_generated_content_export(
  p_content_id uuid,
  p_format text,
  p_size text default null,
  p_surface text default 'api'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  export_actor_id uuid := (select auth.uid());
  export_actor_org uuid;
  export_actor_name text;
  content_row public.generated_content%rowtype;
begin
  if export_actor_id is null then
    raise exception 'authentication required';
  end if;
  if p_format not in ('md', 'clipboard_text', 'png', 'jpeg', 'pdf') then
    raise exception 'unsupported export format';
  end if;
  if p_size is not null and length(p_size) > 50 then
    raise exception 'invalid export size';
  end if;
  if p_surface not in ('api', 'content_detail', 'studio') then
    raise exception 'unsupported export surface';
  end if;

  select profile.org_id,
         coalesce(nullif(profile.full_name, ''), 'Unknown user')
  into export_actor_org, export_actor_name
  from public.profiles profile
  where profile.id = export_actor_id
    and profile.access_status = 'active';

  if export_actor_org is null then
    raise exception 'active account access is required';
  end if;

  select content.*
  into content_row
  from public.generated_content content
  where content.id = p_content_id
  for share;

  if content_row.id is null or content_row.org_id <> export_actor_org then
    raise exception 'content not found';
  end if;
  if content_row.status <> 'approved'
     or content_row.approved_revision_number is null
     or content_row.approved_revision_number <> content_row.current_revision_number then
    raise exception 'only the currently approved revision can be exported';
  end if;

  insert into public.generated_content_events (
    org_id, content_id, actor_id, actor_name, revision_number, event_type, detail
  ) values (
    content_row.org_id,
    content_row.id,
    export_actor_id,
    export_actor_name,
    content_row.current_revision_number,
    'content.exported',
    jsonb_strip_nulls(jsonb_build_object(
      'format', p_format,
      'size', p_size,
      'surface', p_surface
    ))
  );

  return content_row.current_revision_number;
end;
$$;

create or replace function public.record_product_asset_download(p_asset_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  caller_org_id uuid;
  caller_role text;
  asset_org_id uuid;
  asset_status text;
begin
  if caller_id is null then
    raise exception 'authentication required';
  end if;

  select profile.org_id, profile.role
    into caller_org_id, caller_role
  from public.profiles as profile
  where profile.id = caller_id
    and profile.access_status = 'active';

  if caller_org_id is null then
    raise exception 'active account access is required';
  end if;

  select asset.org_id, asset.approval_status
    into asset_org_id, asset_status
  from public.product_assets as asset
  where asset.id = p_asset_id;

  if asset_org_id is null or asset_org_id <> caller_org_id then
    raise exception 'asset not found';
  end if;

  if asset_status <> 'approved' and caller_role <> 'admin' then
    raise exception 'this asset can be downloaded after approval';
  end if;

  update public.product_assets
  set
    download_count = coalesce(download_count, 0) + 1,
    last_downloaded_at = now()
  where id = p_asset_id
    and org_id = caller_org_id;
end;
$$;

create or replace function public.record_uiux_measurement_event(
  p_event_name text,
  p_properties jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_actor_id uuid := (select auth.uid());
begin
  if v_actor_id is null then
    raise exception 'authentication required';
  end if;

  select profile.org_id into v_org_id
  from public.profiles as profile
  where profile.id = v_actor_id
    and profile.access_status = 'active';
  if v_org_id is null then
    raise exception 'active account access is required';
  end if;
  if p_event_name not in (
    'studio_opened', 'studio_preview_ready', 'studio_picker_selected',
    'studio_picker_saved', 'studio_save_completed', 'studio_generation_started',
    'studio_generation_completed', 'studio_generation_failed',
    'studio_format_selected', 'studio_review_submitted', 'review_decision',
    'export_started', 'export_completed', 'preview_error'
  ) then
    raise exception 'unsupported UI/UX measurement event';
  end if;
  if p_properties ?| array['copy', 'source_text', 'excerpt', 'signed_url', 'email', 'password'] then
    raise exception 'sensitive measurement properties are not allowed';
  end if;

  insert into public.uiux_measurement_events (org_id, actor_id, event_name, properties)
  values (v_org_id, v_actor_id, p_event_name, coalesce(p_properties, '{}'::jsonb));
end;
$$;

-- CREATE OR REPLACE preserves existing ACLs, but repeat the intended narrow
-- grants so a drifted environment fails back to the same explicit contract.
revoke all on function public.enable_admin_mfa_requirement()
  from public, anon, service_role;
revoke all on function public.consume_api_rate_limit(text)
  from public, anon, service_role;
revoke all on function public.transition_generated_content(uuid, text, text)
  from public, anon, service_role;
revoke all on function public.record_generated_content_export(uuid, text, text, text)
  from public, anon, service_role;
revoke all on function public.record_product_asset_download(uuid)
  from public, anon, service_role;
revoke all on function public.record_uiux_measurement_event(text, jsonb)
  from public, anon, service_role;

grant execute on function public.enable_admin_mfa_requirement()
  to authenticated;
grant execute on function public.consume_api_rate_limit(text)
  to authenticated;
grant execute on function public.transition_generated_content(uuid, text, text)
  to authenticated;
grant execute on function public.record_generated_content_export(uuid, text, text, text)
  to authenticated;
grant execute on function public.record_product_asset_download(uuid)
  to authenticated;
grant execute on function public.record_uiux_measurement_event(text, jsonb)
  to authenticated;
