create table public.knowledge_query_feedback (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  query_id uuid not null,
  user_id uuid not null,
  rating smallint not null check (rating in (-1, 1)),
  note text check (note is null or length(note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (query_id, user_id),
  constraint knowledge_query_feedback_org_query_fkey
    foreign key (org_id, query_id)
    references public.knowledge_queries (org_id, id)
    on delete cascade,
  constraint knowledge_query_feedback_org_user_fkey
    foreign key (org_id, user_id)
    references public.profiles (org_id, id)
    on delete restrict
);

create index knowledge_query_feedback_org_created_idx
  on public.knowledge_query_feedback (org_id, created_at desc);

create index knowledge_query_feedback_org_query_idx
  on public.knowledge_query_feedback (org_id, query_id);

create index knowledge_query_feedback_org_user_idx
  on public.knowledge_query_feedback (org_id, user_id);

alter table public.knowledge_query_feedback enable row level security;

create policy "knowledge feedback read"
on public.knowledge_query_feedback for select
to authenticated
using (
  org_id = (select public.auth_org_id())
  and (
    user_id = (select auth.uid())
    or (select public.auth_role()) = 'admin'
  )
);

create policy "knowledge feedback write own"
on public.knowledge_query_feedback for insert
to authenticated
with check (
  org_id = (select public.auth_org_id())
  and user_id = (select auth.uid())
  and exists (
    select 1
    from public.knowledge_queries query
    where query.id = knowledge_query_feedback.query_id
      and query.org_id = knowledge_query_feedback.org_id
      and query.user_id = (select auth.uid())
  )
);

create policy "knowledge feedback update own"
on public.knowledge_query_feedback for update
to authenticated
using (org_id = (select public.auth_org_id()) and user_id = (select auth.uid()))
with check (org_id = (select public.auth_org_id()) and user_id = (select auth.uid()));

revoke all on table public.knowledge_query_feedback from public;
revoke all on table public.knowledge_query_feedback from anon;
grant select, insert, update on table public.knowledge_query_feedback to authenticated;
grant all on table public.knowledge_query_feedback to service_role;
