-- Phase 1A: tenant and compliance integrity foundation.
--
-- This migration is additive. It turns the app's org_id convention into
-- database-enforced tenant boundaries, completes explicit Data API grants for
-- authenticated clients, and normalizes storage policies around org-prefixed
-- object paths.

-- ---------------------------------------------------------------------------
-- Composite tenant keys
-- ---------------------------------------------------------------------------
-- Postgres composite foreign keys need referenced columns to be unique. These
-- indexes make (org_id, id) an addressable tenant-owned identity for every
-- org-scoped table.

create unique index if not exists profiles_org_id_id_uidx
  on public.profiles (org_id, id);
create unique index if not exists documents_org_id_id_uidx
  on public.documents (org_id, id);
create unique index if not exists products_org_id_id_uidx
  on public.products (org_id, id);
create unique index if not exists product_claims_org_id_id_uidx
  on public.product_claims (org_id, id);
create unique index if not exists product_assets_org_id_id_uidx
  on public.product_assets (org_id, id);
create unique index if not exists product_templates_org_id_id_uidx
  on public.product_templates (org_id, id);
create unique index if not exists generated_content_org_id_id_uidx
  on public.generated_content (org_id, id);
create unique index if not exists generated_content_revisions_org_id_id_uidx
  on public.generated_content_revisions (org_id, id);
create unique index if not exists generated_content_events_org_id_id_uidx
  on public.generated_content_events (org_id, id);
create unique index if not exists knowledge_queries_org_id_id_uidx
  on public.knowledge_queries (org_id, id);
create unique index if not exists notebook_sessions_org_id_id_uidx
  on public.notebook_sessions (org_id, id);
create unique index if not exists template_families_org_id_id_uidx
  on public.template_families (org_id, id);
create unique index if not exists template_versions_org_id_id_uidx
  on public.template_versions (org_id, id);
create unique index if not exists template_variants_org_id_id_uidx
  on public.template_variants (org_id, id);
create unique index if not exists template_assets_org_id_id_uidx
  on public.template_assets (org_id, id);
create unique index if not exists product_template_assignments_org_id_id_uidx
  on public.product_template_assignments (org_id, id);
create unique index if not exists template_import_runs_org_id_id_uidx
  on public.template_import_runs (org_id, id);
create unique index if not exists render_jobs_org_id_id_uidx
  on public.render_jobs (org_id, id);

-- Existing data must be clean before the new tenant FKs are installed. These
-- checks fail the migration loudly instead of silently validating bad state.
do $$
begin
  if exists (
    select 1
    from public.documents child
    join public.profiles parent on parent.id = child.uploaded_by
    where parent.org_id <> child.org_id
  ) then
    raise exception 'documents.uploaded_by contains cross-org profile references';
  end if;

  if exists (
    select 1
    from public.documents child
    join public.products parent on parent.id = child.product_id
    where child.product_id is not null and parent.org_id <> child.org_id
  ) then
    raise exception 'documents.product_id contains cross-org product references';
  end if;

  if exists (
    select 1
    from public.generated_content child
    join public.profiles parent on parent.id = child.created_by
    where parent.org_id <> child.org_id
  ) then
    raise exception 'generated_content.created_by contains cross-org profile references';
  end if;

  if exists (
    select 1
    from public.generated_content child
    join public.profiles parent on parent.id = child.approved_by
    where child.approved_by is not null and parent.org_id <> child.org_id
  ) then
    raise exception 'generated_content.approved_by contains cross-org profile references';
  end if;

  if exists (
    select 1
    from public.generated_content child
    join public.products parent on parent.id = child.product_id
    where child.product_id is not null and parent.org_id <> child.org_id
  ) then
    raise exception 'generated_content.product_id contains cross-org product references';
  end if;

  if exists (
    select 1
    from public.generated_content child
    join public.product_templates parent on parent.id = child.product_template_id
    where child.product_template_id is not null and parent.org_id <> child.org_id
  ) then
    raise exception 'generated_content.product_template_id contains cross-org template references';
  end if;

  if exists (
    select 1
    from public.generated_content child
    join public.template_versions parent on parent.id = child.template_version_id
    where child.template_version_id is not null and parent.org_id <> child.org_id
  ) then
    raise exception 'generated_content.template_version_id contains cross-org template version references';
  end if;

  if exists (
    select 1
    from public.generated_content child
    join public.template_variants parent on parent.id = child.template_variant_id
    where child.template_variant_id is not null and parent.org_id <> child.org_id
  ) then
    raise exception 'generated_content.template_variant_id contains cross-org template variant references';
  end if;

  if exists (
    select 1
    from public.audit_log child
    join public.profiles parent on parent.id = child.actor_id
    where parent.org_id <> child.org_id
  ) then
    raise exception 'audit_log.actor_id contains cross-org profile references';
  end if;

  if exists (
    select 1
    from public.knowledge_queries child
    join public.products parent on parent.id = child.product_id
    where child.product_id is not null and parent.org_id <> child.org_id
  ) then
    raise exception 'knowledge_queries.product_id contains cross-org product references';
  end if;

  if exists (
    select 1
    from public.knowledge_queries child
    join public.profiles parent on parent.id = child.user_id
    where parent.org_id <> child.org_id
  ) then
    raise exception 'knowledge_queries.user_id contains cross-org profile references';
  end if;

  if exists (
    select 1
    from public.notebook_sessions child
    join public.profiles parent on parent.id = child.user_id
    where parent.org_id <> child.org_id
  ) then
    raise exception 'notebook_sessions.user_id contains cross-org profile references';
  end if;

  if exists (
    select 1
    from public.notebook_sessions child
    join public.products parent on parent.id = child.product_id
    where parent.org_id <> child.org_id
  ) then
    raise exception 'notebook_sessions.product_id contains cross-org product references';
  end if;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'documents_org_uploaded_by_fkey') then
    alter table public.documents
      add constraint documents_org_uploaded_by_fkey
      foreign key (org_id, uploaded_by) references public.profiles (org_id, id)
      on delete restrict;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'documents_org_product_fkey') then
    alter table public.documents
      add constraint documents_org_product_fkey
      foreign key (org_id, product_id) references public.products (org_id, id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'product_claims_org_product_fkey') then
    alter table public.product_claims
      add constraint product_claims_org_product_fkey
      foreign key (org_id, product_id) references public.products (org_id, id)
      on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'product_assets_org_product_fkey') then
    alter table public.product_assets
      add constraint product_assets_org_product_fkey
      foreign key (org_id, product_id) references public.products (org_id, id)
      on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'product_templates_org_product_fkey') then
    alter table public.product_templates
      add constraint product_templates_org_product_fkey
      foreign key (org_id, product_id) references public.products (org_id, id)
      on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'generated_content_org_created_by_fkey') then
    alter table public.generated_content
      add constraint generated_content_org_created_by_fkey
      foreign key (org_id, created_by) references public.profiles (org_id, id)
      on delete restrict;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'generated_content_org_approved_by_fkey') then
    alter table public.generated_content
      add constraint generated_content_org_approved_by_fkey
      foreign key (org_id, approved_by) references public.profiles (org_id, id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'generated_content_org_product_fkey') then
    alter table public.generated_content
      add constraint generated_content_org_product_fkey
      foreign key (org_id, product_id) references public.products (org_id, id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'generated_content_org_product_template_fkey') then
    alter table public.generated_content
      add constraint generated_content_org_product_template_fkey
      foreign key (org_id, product_template_id) references public.product_templates (org_id, id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'generated_content_org_template_version_fkey') then
    alter table public.generated_content
      add constraint generated_content_org_template_version_fkey
      foreign key (org_id, template_version_id) references public.template_versions (org_id, id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'generated_content_org_template_variant_fkey') then
    alter table public.generated_content
      add constraint generated_content_org_template_variant_fkey
      foreign key (org_id, template_variant_id) references public.template_variants (org_id, id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'audit_log_org_actor_fkey') then
    alter table public.audit_log
      add constraint audit_log_org_actor_fkey
      foreign key (org_id, actor_id) references public.profiles (org_id, id)
      on delete restrict;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'knowledge_queries_org_product_fkey') then
    alter table public.knowledge_queries
      add constraint knowledge_queries_org_product_fkey
      foreign key (org_id, product_id) references public.products (org_id, id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'knowledge_queries_org_user_fkey') then
    alter table public.knowledge_queries
      add constraint knowledge_queries_org_user_fkey
      foreign key (org_id, user_id) references public.profiles (org_id, id)
      on delete restrict;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'notebook_sessions_org_user_fkey') then
    alter table public.notebook_sessions
      add constraint notebook_sessions_org_user_fkey
      foreign key (org_id, user_id) references public.profiles (org_id, id)
      on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'notebook_sessions_org_product_fkey') then
    alter table public.notebook_sessions
      add constraint notebook_sessions_org_product_fkey
      foreign key (org_id, product_id) references public.products (org_id, id)
      on delete cascade;
  end if;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'generated_content_revisions_org_content_fkey') then
    alter table public.generated_content_revisions
      add constraint generated_content_revisions_org_content_fkey
      foreign key (org_id, content_id) references public.generated_content (org_id, id)
      on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'generated_content_revisions_org_actor_fkey') then
    alter table public.generated_content_revisions
      add constraint generated_content_revisions_org_actor_fkey
      foreign key (org_id, actor_id) references public.profiles (org_id, id)
      on delete restrict;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'generated_content_events_org_content_fkey') then
    alter table public.generated_content_events
      add constraint generated_content_events_org_content_fkey
      foreign key (org_id, content_id) references public.generated_content (org_id, id)
      on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'generated_content_events_org_actor_fkey') then
    alter table public.generated_content_events
      add constraint generated_content_events_org_actor_fkey
      foreign key (org_id, actor_id) references public.profiles (org_id, id)
      on delete restrict;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'template_versions_org_family_fkey') then
    alter table public.template_versions
      add constraint template_versions_org_family_fkey
      foreign key (org_id, family_id) references public.template_families (org_id, id)
      on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'template_versions_org_created_by_fkey') then
    alter table public.template_versions
      add constraint template_versions_org_created_by_fkey
      foreign key (org_id, created_by) references public.profiles (org_id, id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'template_variants_org_version_fkey') then
    alter table public.template_variants
      add constraint template_variants_org_version_fkey
      foreign key (org_id, template_version_id) references public.template_versions (org_id, id)
      on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'template_assets_org_version_fkey') then
    alter table public.template_assets
      add constraint template_assets_org_version_fkey
      foreign key (org_id, template_version_id) references public.template_versions (org_id, id)
      on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'template_assets_org_variant_fkey') then
    alter table public.template_assets
      add constraint template_assets_org_variant_fkey
      foreign key (org_id, variant_id) references public.template_variants (org_id, id)
      on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'product_template_assignments_org_product_fkey') then
    alter table public.product_template_assignments
      add constraint product_template_assignments_org_product_fkey
      foreign key (org_id, product_id) references public.products (org_id, id)
      on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'product_template_assignments_org_family_fkey') then
    alter table public.product_template_assignments
      add constraint product_template_assignments_org_family_fkey
      foreign key (org_id, template_family_id) references public.template_families (org_id, id)
      on delete restrict;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'product_template_assignments_org_version_fkey') then
    alter table public.product_template_assignments
      add constraint product_template_assignments_org_version_fkey
      foreign key (org_id, template_version_id) references public.template_versions (org_id, id)
      on delete restrict;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'template_import_runs_org_version_fkey') then
    alter table public.template_import_runs
      add constraint template_import_runs_org_version_fkey
      foreign key (org_id, template_version_id) references public.template_versions (org_id, id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'template_import_runs_org_created_by_fkey') then
    alter table public.template_import_runs
      add constraint template_import_runs_org_created_by_fkey
      foreign key (org_id, created_by) references public.profiles (org_id, id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'render_jobs_org_product_fkey') then
    alter table public.render_jobs
      add constraint render_jobs_org_product_fkey
      foreign key (org_id, product_id) references public.products (org_id, id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'render_jobs_org_content_fkey') then
    alter table public.render_jobs
      add constraint render_jobs_org_content_fkey
      foreign key (org_id, generated_content_id) references public.generated_content (org_id, id);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'render_jobs_org_template_version_fkey') then
    alter table public.render_jobs
      add constraint render_jobs_org_template_version_fkey
      foreign key (org_id, template_version_id) references public.template_versions (org_id, id)
      on delete restrict;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'render_jobs_org_template_variant_fkey') then
    alter table public.render_jobs
      add constraint render_jobs_org_template_variant_fkey
      foreign key (org_id, template_variant_id) references public.template_variants (org_id, id)
      on delete restrict;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Missing status constraints on older core tables
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'products_status_valid') then
    alter table public.products
      add constraint products_status_valid
      check (status in ('active', 'archived'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'product_claims_status_valid') then
    alter table public.product_claims
      add constraint product_claims_status_valid
      check (status in ('approved', 'inactive'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'product_templates_status_valid') then
    alter table public.product_templates
      add constraint product_templates_status_valid
      check (status in ('active', 'inactive'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'templates_output_type_valid') then
    alter table public.templates
      add constraint templates_output_type_valid
      check (output_type in ('social', 'email', 'flyer', 'one_pager', 'presentation'));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Storage policies: private/org-prefixed reads, admin writes
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values
  ('documents', 'documents', false),
  ('product-assets', 'product-assets', false),
  ('rendered-assets', 'rendered-assets', false),
  ('template-bundles', 'template-bundles', false)
on conflict (id) do update set public = false;

drop policy if exists "org folder read" on storage.objects;
drop policy if exists "org folder insert" on storage.objects;
drop policy if exists "org document files read" on storage.objects;
drop policy if exists "admin document files insert" on storage.objects;
drop policy if exists "admin document files update" on storage.objects;
drop policy if exists "admin document files delete" on storage.objects;

create policy "org document files read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select public.auth_org_id())::text
  );

create policy "admin document files insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select public.auth_org_id())::text
    and (select public.auth_role()) = 'admin'
  );

create policy "admin document files update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select public.auth_org_id())::text
    and (select public.auth_role()) = 'admin'
  )
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select public.auth_org_id())::text
    and (select public.auth_role()) = 'admin'
  );

create policy "admin document files delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select public.auth_org_id())::text
    and (select public.auth_role()) = 'admin'
  );

drop policy if exists "product assets read" on storage.objects;
drop policy if exists "org product asset files read" on storage.objects;
drop policy if exists "admin product asset files insert" on storage.objects;
drop policy if exists "admin product asset files update" on storage.objects;
drop policy if exists "admin product asset files delete" on storage.objects;

create policy "org product asset files read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'product-assets'
    and (storage.foldername(name))[1] = (select public.auth_org_id())::text
  );

create policy "admin product asset files insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'product-assets'
    and (storage.foldername(name))[1] = (select public.auth_org_id())::text
    and (select public.auth_role()) = 'admin'
  );

create policy "admin product asset files update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'product-assets'
    and (storage.foldername(name))[1] = (select public.auth_org_id())::text
    and (select public.auth_role()) = 'admin'
  )
  with check (
    bucket_id = 'product-assets'
    and (storage.foldername(name))[1] = (select public.auth_org_id())::text
    and (select public.auth_role()) = 'admin'
  );

create policy "admin product asset files delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'product-assets'
    and (storage.foldername(name))[1] = (select public.auth_org_id())::text
    and (select public.auth_role()) = 'admin'
  );

-- rendered-assets and template-bundles were introduced later; normalize delete
-- policies here so replacement/cleanup does not require service-role bypasses.
drop policy if exists "admin rendered assets delete" on storage.objects;
create policy "admin rendered assets delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'rendered-assets'
    and (storage.foldername(name))[1] = (select public.auth_org_id())::text
    and (select public.auth_role()) = 'admin'
  );

drop policy if exists "admin template bundle assets delete" on storage.objects;
create policy "admin template bundle assets delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'template-bundles'
    and (storage.foldername(name))[1] = (select public.auth_org_id())::text
    and (select public.auth_role()) = 'admin'
  );

-- ---------------------------------------------------------------------------
-- Explicit Data API grants
-- ---------------------------------------------------------------------------
-- RLS remains the row-level authority. These grants only make the intended
-- tables/functions visible to PostgREST after Supabase's Data API grant change.

grant usage on schema public to anon, authenticated;

grant select on table public.organizations to authenticated;
grant select on table public.profiles to authenticated;
grant select on table public.documents to authenticated;
grant select on table public.templates to authenticated;
grant select on table public.generated_content to authenticated;
grant select on table public.audit_log to authenticated;
grant select on table public.products to authenticated;
grant select on table public.product_claims to authenticated;
grant select on table public.product_assets to authenticated;
grant select on table public.product_templates to authenticated;
grant select on table public.knowledge_queries to authenticated;
grant select on table public.notebook_sessions to authenticated;
grant select on table public.generated_content_revisions to authenticated;
grant select on table public.generated_content_events to authenticated;
grant select on table public.template_families to authenticated;
grant select on table public.template_versions to authenticated;
grant select on table public.template_variants to authenticated;
grant select on table public.template_assets to authenticated;
grant select on table public.product_template_assignments to authenticated;
grant select on table public.template_import_runs to authenticated;
grant select on table public.render_jobs to authenticated;

grant insert, update, delete on table public.documents to authenticated;
grant insert, update, delete on table public.generated_content to authenticated;
grant insert, update, delete on table public.products to authenticated;
grant insert, update, delete on table public.product_claims to authenticated;
grant insert, update, delete on table public.product_assets to authenticated;
grant insert, update, delete on table public.product_templates to authenticated;
grant insert, update, delete on table public.knowledge_queries to authenticated;
grant insert, update, delete on table public.notebook_sessions to authenticated;
grant insert, update, delete on table public.template_families to authenticated;
grant insert, update, delete on table public.template_versions to authenticated;
grant insert, update, delete on table public.template_variants to authenticated;
grant insert, update, delete on table public.template_assets to authenticated;
grant insert, update, delete on table public.product_template_assignments to authenticated;
grant insert, update, delete on table public.template_import_runs to authenticated;
grant insert, update, delete on table public.render_jobs to authenticated;

grant usage, select on all sequences in schema public to authenticated;

grant execute on function public.auth_org_id() to authenticated;
grant execute on function public.auth_role() to authenticated;
grant execute on function public.consume_api_rate_limit(text) to authenticated;
grant execute on function public.transition_generated_content(uuid, text, text) to authenticated;
grant execute on function public.record_generated_content_export(uuid, text, text, text) to authenticated;
grant execute on function public.record_render_job_event(uuid, text, text, jsonb, jsonb) to authenticated;
