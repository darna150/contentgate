-- The event table intentionally has no client INSERT privilege or INSERT RLS
-- policy. This function is the only write path and validates every value before
-- inserting on behalf of an authenticated caller.
create or replace function public.record_uiux_measurement_event(
  p_event_name text,
  p_properties jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null then
    raise exception 'Authentication required';
  end if;

  select org_id into v_org_id from public.profiles where id = v_actor_id;
  if v_org_id is null then
    raise exception 'Authentication required';
  end if;
  if p_event_name not in (
    'studio_opened', 'studio_preview_ready', 'studio_picker_selected',
    'studio_picker_saved', 'studio_save_completed', 'studio_generation_started',
    'studio_generation_completed', 'studio_generation_failed',
    'studio_format_selected', 'studio_review_submitted', 'review_decision',
    'export_started', 'export_completed', 'preview_error'
  ) then
    raise exception 'Unsupported UI/UX measurement event';
  end if;
  if p_properties ?| array['copy', 'source_text', 'excerpt', 'signed_url', 'email', 'password'] then
    raise exception 'Sensitive measurement properties are not allowed';
  end if;

  insert into public.uiux_measurement_events (org_id, actor_id, event_name, properties)
  values (v_org_id, v_actor_id, p_event_name, coalesce(p_properties, '{}'::jsonb));
end;
$$;

revoke all on function public.record_uiux_measurement_event(text, jsonb)
  from public, anon;
grant execute on function public.record_uiux_measurement_event(text, jsonb)
  to authenticated;
