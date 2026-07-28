-- Composite indexes for the most frequent tenant-scoped list and detail
-- queries. Existing single-column FK indexes remain useful for writes and
-- joins; these avoid sorting/filtering large tenant histories in Studio.

create index if not exists generated_content_org_product_updated_idx
  on public.generated_content (org_id, product_id, updated_at desc);

create index if not exists generated_content_org_created_updated_idx
  on public.generated_content (org_id, created_by, updated_at desc);

create index if not exists generated_content_events_org_content_created_idx
  on public.generated_content_events (org_id, content_id, created_at desc, id desc);

create index if not exists generated_content_revisions_org_content_revision_idx
  on public.generated_content_revisions (org_id, content_id, revision_number desc);
