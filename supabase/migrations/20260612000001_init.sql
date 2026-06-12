-- ContentGate initial schema (PLAN.md Appendix A)

create type user_role as enum ('admin', 'approver', 'member');
create type content_status as enum ('draft', 'in_review', 'approved', 'rejected');

create table organizations (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  industry     text,                      -- shown as the sidebar tag, e.g. "Animal Health"
  created_at   timestamptz not null default now()
);

create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  org_id      uuid not null references organizations(id),
  role        user_role not null default 'member',
  full_name   text,
  created_at  timestamptz not null default now()
);

create table documents (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id),
  uploaded_by   uuid not null references profiles(id),
  title         text not null,
  storage_path  text,                     -- null when content was pasted, not uploaded
  content_text  text,
  paragraphs    jsonb,                    -- [{ "n": 1, "text": "..." }, ...]
  product       text,                     -- optional grouping label shown in the generator brief
  created_at    timestamptz not null default now()
);

create table templates (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id),
  name         text not null,
  description  text,
  prompt_body  text not null,
  output_type  text not null,             -- 'social' | 'email' | 'flyer'
  created_at   timestamptz not null default now()
);

create table generated_content (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null references organizations(id),
  created_by           uuid not null references profiles(id),
  template_id          uuid references templates(id),
  source_document_ids  uuid[] not null default '{}',
  citations            jsonb not null default '[]',
  title                text not null,
  body                 text not null,
  audience             text,
  target_language      text not null default 'en',
  status               content_status not null default 'draft',
  approved_by          uuid references profiles(id),
  approved_at          timestamptz,
  rejection_note       text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table audit_log (
  id          bigint generated always as identity primary key,
  org_id      uuid not null references organizations(id),
  actor_id    uuid not null references profiles(id),
  action      text not null,
  entity_type text not null,
  entity_id   uuid not null,
  detail      jsonb,
  created_at  timestamptz not null default now()
);

create index on documents (org_id);
create index on generated_content (org_id, status);
create index on audit_log (org_id, created_at desc);

-- Helper functions (security definer avoids recursive RLS on profiles)
create or replace function auth_org_id() returns uuid
language sql stable security definer set search_path = public as $$
  select org_id from profiles where id = auth.uid()
$$;

create or replace function auth_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid()
$$;

-- State-machine guard: editing the body of approved content un-approves it
create or replace function revoke_approval_on_edit() returns trigger as $$
begin
  if old.status = 'approved' and new.body is distinct from old.body then
    new.status := 'draft';
    new.approved_by := null;
    new.approved_at := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger generated_content_guard
  before update on generated_content
  for each row execute function revoke_approval_on_edit();

-- New auth user -> profile. Org + role come from invite metadata;
-- prototype fallback: first org, admin if no profiles exist yet.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  target_org uuid;
  target_role user_role;
begin
  target_org := coalesce(
    (new.raw_user_meta_data ->> 'org_id')::uuid,
    (select id from organizations order by created_at limit 1)
  );
  target_role := coalesce(
    (new.raw_user_meta_data ->> 'role')::user_role,
    case when exists (select 1 from profiles) then 'member'::user_role else 'admin'::user_role end
  );
  if target_org is not null then
    insert into profiles (id, org_id, role, full_name)
    values (new.id, target_org, target_role, new.raw_user_meta_data ->> 'full_name');
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- RLS on every table
alter table organizations     enable row level security;
alter table profiles          enable row level security;
alter table documents         enable row level security;
alter table templates         enable row level security;
alter table generated_content enable row level security;
alter table audit_log         enable row level security;

create policy "read own org"      on organizations for select using (id = auth_org_id());
create policy "read org profiles" on profiles      for select using (org_id = auth_org_id());
create policy "update own profile" on profiles     for update using (id = auth.uid());

create policy "org documents read"   on documents for select using (org_id = auth_org_id());
create policy "org documents insert" on documents for insert
  with check (org_id = auth_org_id() and uploaded_by = auth.uid());
create policy "org documents update" on documents for update using (org_id = auth_org_id());
create policy "org documents delete" on documents for delete
  using (org_id = auth_org_id() and auth_role() = 'admin');

create policy "org templates read" on templates for select using (org_id = auth_org_id());

create policy "org content read"   on generated_content for select using (org_id = auth_org_id());
create policy "org content insert" on generated_content for insert
  with check (org_id = auth_org_id() and created_by = auth.uid());
create policy "author or approver update" on generated_content for update
  using (org_id = auth_org_id()
         and (created_by = auth.uid() or auth_role() in ('admin','approver')));

create policy "admins read audit" on audit_log for select
  using (org_id = auth_org_id() and auth_role() = 'admin');
-- audit inserts happen server-side via the service role only

-- Storage: documents bucket, paths are {org_id}/{document_id}
insert into storage.buckets (id, name, public) values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "org folder read" on storage.objects for select
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth_org_id()::text);
create policy "org folder insert" on storage.objects for insert
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth_org_id()::text);
