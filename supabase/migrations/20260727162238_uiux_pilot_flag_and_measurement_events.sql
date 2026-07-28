-- Pilot rollout controls and privacy-safe UI/UX measurement.
-- Event payloads deliberately exclude copy, source text, signed URLs, emails,
-- and any other participant-provided content.

create table if not exists public.organization_feature_flags (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  uiux_campaign_pilot_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

alter table public.organization_feature_flags enable row level security;

create policy "org feature flags read"
  on public.organization_feature_flags
  for select
  to authenticated
  using (org_id = (select public.auth_org_id()));

revoke all on public.organization_feature_flags from anon, authenticated;
grant select on public.organization_feature_flags to authenticated;

create table if not exists public.uiux_measurement_events (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  event_name text not null check (event_name in (
    'studio_opened',
    'studio_preview_ready',
    'studio_picker_selected',
    'studio_picker_saved',
    'studio_save_completed',
    'studio_generation_started',
    'studio_generation_completed',
    'studio_generation_failed',
    'studio_format_selected',
    'studio_review_submitted',
    'review_decision',
    'export_started',
    'export_completed',
    'preview_error'
  )),
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists uiux_measurement_events_org_created_idx
  on public.uiux_measurement_events (org_id, created_at desc);
create index if not exists uiux_measurement_events_org_event_created_idx
  on public.uiux_measurement_events (org_id, event_name, created_at desc);

alter table public.uiux_measurement_events enable row level security;

create policy "org uiux measurement events read"
  on public.uiux_measurement_events
  for select
  to authenticated
  using (
    org_id = (select public.auth_org_id())
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'admin'
    )
  );

revoke all on public.uiux_measurement_events from anon, authenticated;
grant select on public.uiux_measurement_events to authenticated;

create or replace function public.record_uiux_measurement_event(
  p_event_name text,
  p_properties jsonb default '{}'::jsonb
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select org_id into v_org_id from public.profiles where id = auth.uid();
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
  values (v_org_id, auth.uid(), p_event_name, coalesce(p_properties, '{}'::jsonb));
end;
$$;

revoke all on function public.record_uiux_measurement_event(text, jsonb)
  from public, anon;
grant execute on function public.record_uiux_measurement_event(text, jsonb)
  to authenticated;
