-- Phase 7 launch-readiness security and operational controls.

-- Keep tenant lookup helpers callable by signed-in users for RLS evaluation,
-- but remove anonymous RPC access and mutable schema resolution.
create or replace function public.auth_org_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select profile.org_id
  from public.profiles profile
  where profile.id = (select auth.uid())
$$;

create or replace function public.auth_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select profile.role
  from public.profiles profile
  where profile.id = (select auth.uid())
$$;

revoke execute on function public.auth_org_id() from public, anon;
revoke execute on function public.auth_role() from public, anon;
grant execute on function public.auth_org_id() to authenticated;
grant execute on function public.auth_role() to authenticated;

-- New public functions must opt into their callable roles explicitly.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated, service_role;

-- Private, atomic fixed-window counters for expensive AI routes.
create table if not exists private.api_rate_limits (
  scope text not null,
  actor_id uuid not null references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  primary key (scope, actor_id, window_start)
);

alter table private.api_rate_limits enable row level security;
revoke all on table private.api_rate_limits from public, anon, authenticated, service_role;

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

  case p_scope
    when 'knowledge.ask' then
      rate_limit := 10;
      window_seconds := 60;
    when 'content.generate' then
      rate_limit := 5;
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

revoke execute on function public.consume_api_rate_limit(text)
  from public, anon, service_role;
grant execute on function public.consume_api_rate_limit(text) to authenticated;

-- Enforce upload restrictions at Storage as well as in application code.
update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array[
      'image/avif',
      'image/gif',
      'image/jpeg',
      'image/png',
      'image/webp'
    ]::text[]
where id = 'product-assets';

update storage.buckets
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = array[
      'application/pdf',
      'application/rtf',
      'application/vnd.oasis.opendocument.presentation',
      'application/vnd.oasis.opendocument.spreadsheet',
      'application/vnd.oasis.opendocument.text',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/csv',
      'text/html',
      'text/markdown',
      'text/plain'
    ]::text[]
where id = 'documents';

-- Optimize the highest-frequency RLS policies by evaluating auth helpers once
-- per statement instead of once per candidate row.
drop policy if exists "update own profile name" on public.profiles;
create policy "update own profile name"
on public.profiles for update
to authenticated
using (id = (select auth.uid()))
with check (
  id = (select auth.uid())
  and org_id = (select public.auth_org_id())
  and role = (select public.auth_role())
);

drop policy if exists "admin documents insert" on public.documents;
create policy "admin documents insert"
on public.documents for insert
to authenticated
with check (
  org_id = (select public.auth_org_id())
  and uploaded_by = (select auth.uid())
  and (select public.auth_role()) = 'admin'
);

drop policy if exists "admin documents update" on public.documents;
create policy "admin documents update"
on public.documents for update
to authenticated
using (
  org_id = (select public.auth_org_id())
  and (select public.auth_role()) = 'admin'
)
with check (
  org_id = (select public.auth_org_id())
  and (select public.auth_role()) = 'admin'
);

drop policy if exists "knowledge queries insert" on public.knowledge_queries;
create policy "knowledge queries insert"
on public.knowledge_queries for insert
to authenticated
with check (
  org_id = (select public.auth_org_id())
  and user_id = (select auth.uid())
);

drop policy if exists "knowledge queries read" on public.knowledge_queries;
create policy "knowledge queries read"
on public.knowledge_queries for select
to authenticated
using (
  org_id = (select public.auth_org_id())
  and (
    (select public.auth_role()) = 'admin'
    or user_id = (select auth.uid())
  )
);

drop policy if exists "authors create draft content" on public.generated_content;
create policy "authors create draft content"
on public.generated_content for insert
to authenticated
with check (
  org_id = (select public.auth_org_id())
  and created_by = (select auth.uid())
  and status = 'draft'
  and approved_by is null
  and approved_at is null
);

drop policy if exists "authors edit own draft content" on public.generated_content;
create policy "authors edit own draft content"
on public.generated_content for update
to authenticated
using (
  org_id = (select public.auth_org_id())
  and created_by = (select auth.uid())
  and status in ('draft', 'rejected', 'approved')
)
with check (
  org_id = (select public.auth_org_id())
  and created_by = (select auth.uid())
  and status in ('draft', 'rejected')
  and approved_by is null
  and approved_at is null
);

-- Cover existing foreign keys used during deletes and workflow joins.
create index if not exists user_provisioning_org_id_idx
  on private.user_provisioning(org_id);
create index if not exists audit_log_actor_id_idx
  on public.audit_log(actor_id);
create index if not exists documents_uploaded_by_idx
  on public.documents(uploaded_by);
create index if not exists generated_content_approved_by_idx
  on public.generated_content(approved_by);
create index if not exists generated_content_created_by_idx
  on public.generated_content(created_by);
create index if not exists generated_content_product_template_id_idx
  on public.generated_content(product_template_id);
create index if not exists generated_content_template_id_idx
  on public.generated_content(template_id);
create index if not exists knowledge_queries_user_id_idx
  on public.knowledge_queries(user_id);
create index if not exists product_claims_org_id_idx
  on public.product_claims(org_id);
create index if not exists product_templates_org_id_idx
  on public.product_templates(org_id);
create index if not exists profiles_org_id_idx
  on public.profiles(org_id);
create index if not exists templates_org_id_idx
  on public.templates(org_id);
