-- Phase 3: media-worker liveness is a release gate, not an inferred log line.
create table if not exists public.asset_media_worker_heartbeats (
  worker_id text primary key,
  last_seen_at timestamptz not null default now(),
  status text not null default 'healthy',
  details jsonb not null default '{}'::jsonb,
  constraint asset_media_worker_heartbeat_status_valid
    check (status in ('healthy', 'degraded', 'stopped'))
);

alter table public.asset_media_worker_heartbeats enable row level security;
revoke all on table public.asset_media_worker_heartbeats from public, anon, authenticated;
