-- Phase 1: durable, vendor-neutral media-processing queue.
--
-- Browser uploads and the application API never get permission to mark a
-- video rendition complete. A privileged worker claims and completes jobs.

create table if not exists public.asset_media_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  asset_id uuid not null,
  job_type text not null,
  status text not null default 'queued',
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,
  run_after timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  locked_at timestamptz,
  locked_by text,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint asset_media_jobs_org_asset_fkey
    foreign key (org_id, asset_id)
    references public.product_assets (org_id, id)
    on delete cascade,
  constraint asset_media_jobs_type_valid
    check (job_type in ('image_derivatives', 'video_probe', 'video_transcode', 'video_poster')),
  constraint asset_media_jobs_status_valid
    check (status in ('queued', 'running', 'failed', 'completed', 'cancelled')),
  constraint asset_media_jobs_attempts_valid
    check (attempt_count >= 0 and max_attempts between 1 and 10),
  constraint asset_media_jobs_completion_valid
    check (
      (status = 'completed' and completed_at is not null)
      or status <> 'completed'
    )
);

alter table public.product_assets
  add column if not exists preview_storage_path text,
  add column if not exists transcoded_storage_path text;

drop policy if exists "role-aware product asset files read" on storage.objects;
create policy "role-aware product asset files read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'product-assets'
  and (storage.foldername(name))[1] = (select public.auth_org_id())::text
  and exists (
    select 1
    from public.product_assets as asset
    where asset.org_id = (select public.auth_org_id())
      and name in (
        asset.storage_path,
        asset.preview_storage_path,
        asset.poster_storage_path,
        asset.transcoded_storage_path
      )
      and (
        (asset.approval_status = 'approved' and asset.archived_at is null)
        or (select public.auth_role()) in ('admin', 'approver')
      )
  )
);

create unique index if not exists asset_media_jobs_active_type_uidx
  on public.asset_media_jobs (asset_id, job_type)
  where status in ('queued', 'running');

create index if not exists asset_media_jobs_claim_idx
  on public.asset_media_jobs (status, run_after, created_at)
  where status = 'queued';

create index if not exists asset_media_jobs_org_asset_created_idx
  on public.asset_media_jobs (org_id, asset_id, created_at desc);

drop trigger if exists asset_media_jobs_set_updated_at on public.asset_media_jobs;
create trigger asset_media_jobs_set_updated_at
  before update on public.asset_media_jobs
  for each row execute function public.set_product_asset_updated_at();

alter table public.asset_media_jobs enable row level security;

-- Jobs can be inspected by the people who govern the tenant. Mutations are
-- deliberately service-worker only; it uses the server-only service-role key.
create policy "asset media jobs admin read"
  on public.asset_media_jobs for select
  to authenticated
  using (
    org_id = (select public.auth_org_id())
    and (select public.auth_role()) in ('admin', 'approver')
  );

create policy "asset media jobs admin insert"
  on public.asset_media_jobs for insert
  to authenticated
  with check (
    org_id = (select public.auth_org_id())
    and (select public.auth_role()) = 'admin'
  );

create policy "asset media jobs admin retry"
  on public.asset_media_jobs for update
  to authenticated
  using (
    org_id = (select public.auth_org_id())
    and (select public.auth_role()) = 'admin'
    and status = 'failed'
  )
  with check (
    org_id = (select public.auth_org_id())
    and (select public.auth_role()) = 'admin'
    and status = 'queued'
  );

-- Atomically claims one due job. The only caller is the server-only worker
-- using a service-role token; normal application users cannot invoke it.
create or replace function public.claim_asset_media_job(p_worker_id text)
returns public.asset_media_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed public.asset_media_jobs;
begin
  if auth.role() <> 'service_role' then
    raise exception 'media worker credentials required';
  end if;

  -- A crashed container cannot release its row lock. Return abandoned work to
  -- the queue before claiming fresh work so an asset never remains Processing
  -- indefinitely after a worker restart.
  update public.asset_media_jobs
  set status = 'queued',
      locked_at = null,
      locked_by = null,
      started_at = null,
      error_message = 'Worker lease expired; retrying.'
  where status = 'running'
    and locked_at < now() - interval '30 minutes';

  with next_job as (
    select id
    from public.asset_media_jobs
    where status = 'queued'
      and run_after <= now()
    order by run_after, created_at
    for update skip locked
    limit 1
  )
  update public.asset_media_jobs as job
  set status = 'running',
      started_at = now(),
      locked_at = now(),
      locked_by = left(p_worker_id, 120),
      attempt_count = attempt_count + 1,
      error_message = null
  from next_job
  where job.id = next_job.id
  returning job.* into claimed;

  return claimed;
end;
$$;

revoke all on table public.asset_media_jobs from public, anon;
grant select, insert, update on table public.asset_media_jobs to authenticated;
revoke all on function public.claim_asset_media_job(text) from public, anon, authenticated;
grant execute on function public.claim_asset_media_job(text) to service_role;
