-- Cover composite tenant foreign keys so parent updates/deletes and tenant
-- joins do not fall back to table scans as organizations grow.
create index if not exists audit_log_org_actor_idx
  on public.audit_log (org_id, actor_id);

create index if not exists documents_org_uploaded_by_idx
  on public.documents (org_id, uploaded_by);

create index if not exists generated_content_org_approved_by_idx
  on public.generated_content (org_id, approved_by);

create index if not exists generated_content_org_product_template_idx
  on public.generated_content (org_id, product_template_id);

create index if not exists generated_content_org_template_variant_idx
  on public.generated_content (org_id, template_variant_id);

create index if not exists generated_content_org_template_version_idx
  on public.generated_content (org_id, template_version_id);

create index if not exists generated_content_events_org_actor_idx
  on public.generated_content_events (org_id, actor_id);

create index if not exists generated_content_revisions_org_actor_idx
  on public.generated_content_revisions (org_id, actor_id);

create index if not exists knowledge_queries_org_product_idx
  on public.knowledge_queries (org_id, product_id);

create index if not exists knowledge_queries_org_user_idx
  on public.knowledge_queries (org_id, user_id);

create index if not exists notebook_sessions_org_product_idx
  on public.notebook_sessions (org_id, product_id);

create index if not exists notebook_sessions_org_user_idx
  on public.notebook_sessions (org_id, user_id);
