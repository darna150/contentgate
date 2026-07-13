-- Ensure every current legacy record has explicit create/generate timeline
-- events. Some June records predated reliable application audit writes.

insert into public.generated_content_events (
  org_id,
  content_id,
  actor_id,
  actor_name,
  revision_number,
  event_type,
  detail,
  created_at
)
select
  content.org_id,
  content.id,
  content.created_by,
  coalesce(nullif(profile.full_name, ''), 'Unknown user'),
  1,
  'content.created',
  jsonb_build_object('backfilled', true, 'source', 'legacy_baseline'),
  content.created_at
from public.generated_content content
left join public.profiles profile on profile.id = content.created_by
where not exists (
  select 1
  from public.generated_content_events event
  where event.content_id = content.id
    and event.event_type = 'content.created'
);

insert into public.generated_content_events (
  org_id,
  content_id,
  actor_id,
  actor_name,
  revision_number,
  event_type,
  detail,
  created_at
)
select
  content.org_id,
  content.id,
  content.created_by,
  coalesce(nullif(profile.full_name, ''), 'Unknown user'),
  1,
  'content.generated',
  jsonb_build_object('backfilled', true, 'source', 'legacy_baseline'),
  content.created_at
from public.generated_content content
left join public.profiles profile on profile.id = content.created_by
where not exists (
  select 1
  from public.generated_content_events event
  where event.content_id = content.id
    and event.event_type = 'content.generated'
);
