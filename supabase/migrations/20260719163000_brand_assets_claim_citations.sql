-- Redesign v2 data-model support:
-- 1) Brand-wide assets are product_assets rows with product_id = null.
-- 2) Approved claims can trace to a numbered source-document paragraph.

alter table public.product_assets
  alter column product_id drop not null;

alter table public.product_claims
  add column if not exists source_document_id uuid references public.documents(id) on delete set null,
  add column if not exists source_paragraph_n integer,
  add column if not exists source_excerpt text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'product_claims_source_paragraph_n_check'
  ) then
    alter table public.product_claims
      add constraint product_claims_source_paragraph_n_check
      check (source_paragraph_n is null or source_paragraph_n > 0);
  end if;
end;
$$;

create index if not exists product_assets_brand_library_idx
  on public.product_assets (org_id, approval_status, asset_type, created_at desc)
  where product_id is null;

create index if not exists product_claims_source_document_idx
  on public.product_claims (source_document_id);

with paragraph_sources as (
  select
    doc.id as document_id,
    doc.product_id,
    paragraph.n,
    paragraph.text
  from public.documents doc
  cross join lateral jsonb_to_recordset(coalesce(doc.paragraphs, '[]'::jsonb))
    as paragraph(n integer, text text)
  where doc.product_id is not null
),
claim_matches as (
  select distinct on (claim.id)
    claim.id as claim_id,
    paragraph_sources.document_id,
    paragraph_sources.n,
    paragraph_sources.text
  from public.product_claims claim
  join paragraph_sources
    on paragraph_sources.product_id = claim.product_id
   and paragraph_sources.text ilike '%' || claim.claim_text || '%'
  where claim.source_document_id is null
  order by claim.id, paragraph_sources.document_id, paragraph_sources.n
)
update public.product_claims claim
set
  source_document_id = claim_matches.document_id,
  source_paragraph_n = claim_matches.n,
  source_excerpt = claim_matches.text
from claim_matches
where claim.id = claim_matches.claim_id;
