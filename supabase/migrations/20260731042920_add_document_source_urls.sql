-- Preserve the origin of AI-assisted webpage imports without changing the
-- approved paragraph/citation boundary used by Knowledge Hub retrieval.

alter table public.documents
  add column if not exists source_url text;

alter table public.documents
  drop constraint if exists documents_source_url_http_check;

alter table public.documents
  add constraint documents_source_url_http_check
  check (source_url is null or source_url ~ '^https?://[^[:space:]]+$');
