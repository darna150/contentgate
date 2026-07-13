-- Complete generated-content revision history and workflow auditability.
-- Revisions and events are append-only; workflow state changes and exports are
-- recorded transactionally against an exact content revision.

alter table public.generated_content
  add column current_revision_number integer not null default 1,
  add column approved_revision_number integer;

alter table public.generated_content
  add constraint generated_content_current_revision_positive
    check (current_revision_number > 0),
  add constraint generated_content_approved_revision_valid
    check (
      approved_revision_number is null
      or approved_revision_number between 1 and current_revision_number
    );

update public.generated_content
set approved_revision_number = current_revision_number
where status = 'approved';

create table public.generated_content_revisions (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations(id),
  content_id uuid not null references public.generated_content(id),
  revision_number integer not null check (revision_number > 0),
  actor_id uuid not null,
  actor_name text not null,
  change_kind text not null check (
    change_kind in ('baseline', 'generated', 'regenerated', 'manual_edit')
  ),
  title text not null,
  body text not null,
  audience text,
  target_language text not null,
  product_id uuid,
  product_template_id uuid,
  source_document_ids uuid[] not null default '{}',
  citations jsonb not null default '[]'::jsonb,
  structured_fields jsonb not null default '{}'::jsonb,
  prompt_context jsonb not null default '{}'::jsonb,
  status_at_capture public.content_status not null,
  created_at timestamptz not null default now(),
  unique (content_id, revision_number)
);

create table public.generated_content_events (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations(id),
  content_id uuid not null references public.generated_content(id),
  actor_id uuid not null,
  actor_name text not null,
  revision_number integer not null check (revision_number > 0),
  event_type text not null check (
    event_type in (
      'content.created',
      'content.generated',
      'content.edited',
      'content.submitted',
      'content.approved',
      'content.rejected',
      'content.approval_revoked',
      'content.exported'
    )
  ),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index generated_content_revisions_content_revision_idx
  on public.generated_content_revisions (content_id, revision_number desc);
create index generated_content_revisions_org_created_idx
  on public.generated_content_revisions (org_id, created_at desc);
create index generated_content_events_content_created_idx
  on public.generated_content_events (content_id, created_at desc, id desc);
create index generated_content_events_org_created_idx
  on public.generated_content_events (org_id, created_at desc);
create index generated_content_events_actor_idx
  on public.generated_content_events (actor_id);

-- Existing rows become an honest baseline snapshot. Historical audit events are
-- preserved below, but earlier content bodies cannot be reconstructed.
insert into public.generated_content_revisions (
  org_id,
  content_id,
  revision_number,
  actor_id,
  actor_name,
  change_kind,
  title,
  body,
  audience,
  target_language,
  product_id,
  product_template_id,
  source_document_ids,
  citations,
  structured_fields,
  prompt_context,
  status_at_capture,
  created_at
)
select
  content.org_id,
  content.id,
  content.current_revision_number,
  content.created_by,
  coalesce(nullif(profile.full_name, ''), 'Unknown user'),
  'baseline',
  content.title,
  content.body,
  content.audience,
  content.target_language,
  content.product_id,
  content.product_template_id,
  content.source_document_ids,
  content.citations,
  content.structured_fields,
  content.prompt_context,
  content.status,
  now()
from public.generated_content content
left join public.profiles profile on profile.id = content.created_by;

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
  audit.org_id,
  audit.entity_id,
  audit.actor_id,
  coalesce(nullif(profile.full_name, ''), 'Unknown user'),
  content.current_revision_number,
  case audit.action
    when 'content.revised' then 'content.generated'
    else audit.action
  end,
  coalesce(audit.detail, '{}'::jsonb) || jsonb_build_object('backfilled', true),
  audit.created_at
from public.audit_log audit
join public.generated_content content on content.id = audit.entity_id
left join public.profiles profile on profile.id = audit.actor_id
where audit.entity_type = 'generated_content'
  and audit.action in (
    'content.created',
    'content.revised',
    'content.edited',
    'content.submitted',
    'content.approved',
    'content.rejected',
    'content.exported'
  );

alter table public.generated_content_revisions enable row level security;
alter table public.generated_content_events enable row level security;

create policy "org content revisions read"
  on public.generated_content_revisions
  for select
  to authenticated
  using (org_id = (select public.auth_org_id()));

create policy "org content events read"
  on public.generated_content_events
  for select
  to authenticated
  using (org_id = (select public.auth_org_id()));

revoke all on public.generated_content_revisions from anon, authenticated;
revoke all on public.generated_content_events from anon, authenticated;
revoke all on sequence public.generated_content_revisions_id_seq from anon, authenticated;
revoke all on sequence public.generated_content_events_id_seq from anon, authenticated;
grant select on public.generated_content_revisions to authenticated;
grant select on public.generated_content_events to authenticated;
revoke all on public.generated_content_revisions from service_role;
revoke all on public.generated_content_events from service_role;
grant select, insert on public.generated_content_revisions to service_role;
grant select, insert on public.generated_content_events to service_role;
grant usage, select on sequence public.generated_content_revisions_id_seq to service_role;
grant usage, select on sequence public.generated_content_events_id_seq to service_role;

create or replace function public.prevent_content_history_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'generated content history is immutable';
end;
$$;

create trigger prevent_generated_content_revision_mutation
  before update or delete on public.generated_content_revisions
  for each row execute function public.prevent_content_history_mutation();

create trigger prevent_generated_content_event_mutation
  before update or delete on public.generated_content_events
  for each row execute function public.prevent_content_history_mutation();

revoke execute on function public.prevent_content_history_mutation() from public, anon, authenticated, service_role;

-- Keep revision counters and approval pointers server-owned. Any content-bearing
-- edit increments the revision; editing an approved revision starts a new draft.
create or replace function public.revoke_approval_on_edit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  content_changed boolean;
begin
  content_changed :=
    new.title is distinct from old.title
    or new.body is distinct from old.body
    or new.audience is distinct from old.audience
    or new.target_language is distinct from old.target_language
    or new.product_id is distinct from old.product_id
    or new.product_template_id is distinct from old.product_template_id
    or new.source_document_ids is distinct from old.source_document_ids
    or new.citations is distinct from old.citations
    or new.structured_fields is distinct from old.structured_fields
    or new.prompt_context is distinct from old.prompt_context;

  -- Direct authenticated table updates may edit content, but cannot promote or
  -- otherwise rewrite workflow state. Security-definer workflow RPCs run as
  -- the function owner and are the only supported status transition path.
  if current_user = 'authenticated' then
    new.status := old.status;
    new.approved_by := old.approved_by;
    new.approved_at := old.approved_at;
    new.rejection_note := old.rejection_note;
  end if;

  new.current_revision_number := old.current_revision_number;

  if content_changed then
    new.current_revision_number := old.current_revision_number + 1;
    if old.status = 'approved' then
      new.status := 'draft';
      new.approved_by := null;
      new.approved_at := null;
      new.rejection_note := null;
    end if;
  end if;

  if new.status = 'approved' then
    new.approved_revision_number := new.current_revision_number;
  else
    new.approved_revision_number := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists revoke_approval_on_edit on public.generated_content;
drop trigger if exists generated_content_guard on public.generated_content;
create trigger generated_content_guard
  before update on public.generated_content
  for each row execute function public.revoke_approval_on_edit();

revoke execute on function public.revoke_approval_on_edit() from public, anon, authenticated, service_role;

create or replace function public.capture_generated_content_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  history_actor_id uuid;
  history_actor_name text;
  content_changed boolean;
  generated_change boolean;
  history_change_kind text;
begin
  history_actor_id := coalesce((select auth.uid()), new.created_by);
  select coalesce(nullif(profile.full_name, ''), 'Unknown user')
  into history_actor_name
  from public.profiles profile
  where profile.id = history_actor_id;
  history_actor_name := coalesce(history_actor_name, 'Unknown user');

  if tg_op = 'INSERT' then
    insert into public.generated_content_revisions (
      org_id, content_id, revision_number, actor_id, actor_name, change_kind,
      title, body, audience, target_language, product_id, product_template_id,
      source_document_ids, citations, structured_fields, prompt_context,
      status_at_capture
    ) values (
      new.org_id, new.id, new.current_revision_number, history_actor_id,
      history_actor_name, 'generated', new.title, new.body, new.audience,
      new.target_language, new.product_id, new.product_template_id,
      new.source_document_ids, new.citations, new.structured_fields,
      new.prompt_context, new.status
    );

    insert into public.generated_content_events (
      org_id, content_id, actor_id, actor_name, revision_number, event_type, detail
    ) values
      (
        new.org_id, new.id, history_actor_id, history_actor_name,
        new.current_revision_number, 'content.created', '{}'::jsonb
      ),
      (
        new.org_id, new.id, history_actor_id, history_actor_name,
        new.current_revision_number, 'content.generated',
        jsonb_build_object('change_kind', 'initial_generation')
      );
    return new;
  end if;

  content_changed := new.current_revision_number > old.current_revision_number;
  if not content_changed then
    return new;
  end if;

  generated_change :=
    new.prompt_context ->> 'compliance_state' = 'generated'
    and new.prompt_context -> 'generated_fields'
      is distinct from old.prompt_context -> 'generated_fields';
  history_change_kind := case when generated_change then 'regenerated' else 'manual_edit' end;

  insert into public.generated_content_revisions (
    org_id, content_id, revision_number, actor_id, actor_name, change_kind,
    title, body, audience, target_language, product_id, product_template_id,
    source_document_ids, citations, structured_fields, prompt_context,
    status_at_capture
  ) values (
    new.org_id, new.id, new.current_revision_number, history_actor_id,
    history_actor_name, history_change_kind, new.title, new.body, new.audience,
    new.target_language, new.product_id, new.product_template_id,
    new.source_document_ids, new.citations, new.structured_fields,
    new.prompt_context, new.status
  );

  if old.status = 'approved' and new.status = 'draft' then
    insert into public.generated_content_events (
      org_id, content_id, actor_id, actor_name, revision_number, event_type, detail
    ) values (
      new.org_id, new.id, history_actor_id, history_actor_name,
      new.current_revision_number, 'content.approval_revoked',
      jsonb_build_object('previous_approved_revision', old.approved_revision_number)
    );
  end if;

  insert into public.generated_content_events (
    org_id, content_id, actor_id, actor_name, revision_number, event_type, detail
  ) values (
    new.org_id,
    new.id,
    history_actor_id,
    history_actor_name,
    new.current_revision_number,
    case when generated_change then 'content.generated' else 'content.edited' end,
    jsonb_build_object(
      'change_kind', history_change_kind,
      'manually_edited_fields',
      coalesce(new.prompt_context -> 'manually_edited_fields', '[]'::jsonb)
    )
  );

  return new;
end;
$$;

create trigger capture_generated_content_history
  after insert or update on public.generated_content
  for each row execute function public.capture_generated_content_history();

revoke execute on function public.capture_generated_content_history() from public, anon, authenticated, service_role;

-- Every canonical content event is also written to the existing organization
-- audit log, keeping the broader admin audit surface complete.
create or replace function public.mirror_generated_content_event_to_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_log (
    org_id, actor_id, action, entity_type, entity_id, detail, created_at
  ) values (
    new.org_id,
    new.actor_id,
    new.event_type,
    'generated_content',
    new.content_id,
    new.detail || jsonb_build_object('revision_number', new.revision_number),
    new.created_at
  );
  return new;
end;
$$;

create trigger mirror_generated_content_event_to_audit
  after insert on public.generated_content_events
  for each row execute function public.mirror_generated_content_event_to_audit();

revoke execute on function public.mirror_generated_content_event_to_audit() from public, anon, authenticated, service_role;

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
  where profile.id = workflow_actor_id;

  if workflow_actor_org is null then
    raise exception 'profile not found';
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

revoke all on function public.transition_generated_content(uuid, text, text) from public, anon, service_role;
grant execute on function public.transition_generated_content(uuid, text, text) to authenticated;

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
  where profile.id = export_actor_id;

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

revoke all on function public.record_generated_content_export(uuid, text, text, text) from public, anon, service_role;
grant execute on function public.record_generated_content_export(uuid, text, text, text) to authenticated;
