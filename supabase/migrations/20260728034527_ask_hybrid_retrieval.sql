create extension if not exists vector with schema extensions;

create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  document_id uuid not null references public.documents(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  paragraph_n integer not null check (paragraph_n >= 1),
  paragraph_text text not null check (length(trim(paragraph_text)) > 0),
  search_vector tsvector generated always as (to_tsvector('simple', coalesce(paragraph_text, ''))) stored,
  embedding extensions.vector(1536) not null,
  embedding_model text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id, paragraph_n)
);

create index knowledge_chunks_keyword_idx on public.knowledge_chunks using gin (search_vector);
create index knowledge_chunks_embedding_idx on public.knowledge_chunks using hnsw (embedding vector_cosine_ops);
create index knowledge_chunks_org_product_document_idx on public.knowledge_chunks (org_id, product_id, document_id);

alter table public.knowledge_chunks enable row level security;
create policy "knowledge chunks read organization sources"
on public.knowledge_chunks for select to authenticated
using (org_id = (select public.auth_org_id()));

revoke all on table public.knowledge_chunks from public;
revoke all on table public.knowledge_chunks from anon;
grant select on table public.knowledge_chunks to authenticated;
grant all on table public.knowledge_chunks to service_role;

create or replace function public.search_product_knowledge_hybrid(
  p_product_id uuid,
  p_query text,
  p_query_embedding extensions.vector(1536),
  p_limit integer default 12
)
returns table (document_id uuid, document_title text, paragraph_n integer, paragraph_text text, relevance double precision)
language sql stable security invoker set search_path = ''
as $$
  with eligible as (
    select chunk.id, chunk.document_id, document.title as document_title, chunk.paragraph_n,
      chunk.paragraph_text, chunk.search_vector, chunk.embedding
    from public.knowledge_chunks chunk
    join public.documents document on document.id = chunk.document_id
    where chunk.org_id = (select public.auth_org_id())
      and document.org_id = (select public.auth_org_id())
      and document.approval_status = 'approved'
      and (p_product_id is null or chunk.product_id = p_product_id or chunk.product_id is null)
  ), keyword as (
    select id, row_number() over (order by ts_rank_cd(search_vector, websearch_to_tsquery('simple', p_query)) desc) as rank_ix
    from eligible where search_vector @@ websearch_to_tsquery('simple', p_query)
    limit least(greatest(p_limit, 1), 30) * 2
  ), semantic as (
    select id, row_number() over (order by embedding OPERATOR(extensions.<=>) p_query_embedding) as rank_ix
    from eligible limit least(greatest(p_limit, 1), 30) * 2
  ), fused as (
    select coalesce(keyword.id, semantic.id) as id,
      coalesce(1.0 / (50 + keyword.rank_ix), 0.0) + coalesce(1.0 / (50 + semantic.rank_ix), 0.0) as score
    from keyword full outer join semantic on semantic.id = keyword.id
  )
  select eligible.document_id, eligible.document_title, eligible.paragraph_n, eligible.paragraph_text,
    fused.score::double precision as relevance
  from fused join eligible on eligible.id = fused.id
  order by fused.score desc, eligible.document_id, eligible.paragraph_n
  limit least(greatest(p_limit, 1), 30)
$$;

revoke all on function public.search_product_knowledge_hybrid(uuid, text, extensions.vector, integer) from public;
revoke all on function public.search_product_knowledge_hybrid(uuid, text, extensions.vector, integer) from anon;
grant execute on function public.search_product_knowledge_hybrid(uuid, text, extensions.vector, integer) to authenticated;
grant execute on function public.search_product_knowledge_hybrid(uuid, text, extensions.vector, integer) to service_role;
