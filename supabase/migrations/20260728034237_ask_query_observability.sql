-- Record retrieval quality and latency on the existing Ask audit row. These
-- fields contain operational metadata only; source text remains in documents.
alter table public.knowledge_queries
  add column retrieval_query text,
  add column retrieval_strategy text not null default 'full_text',
  add column answer_model text,
  add column retrieved_paragraph_count integer not null default 0,
  add column answer_latency_ms integer;

alter table public.knowledge_queries
  add constraint knowledge_queries_retrieval_strategy_check
    check (retrieval_strategy in ('hybrid', 'full_text', 'lexical_fallback', 'no_evidence', 'extractive_preview')),
  add constraint knowledge_queries_retrieved_paragraph_count_check
    check (retrieved_paragraph_count >= 0),
  add constraint knowledge_queries_answer_latency_ms_check
    check (answer_latency_ms is null or answer_latency_ms >= 0);

create index knowledge_queries_org_strategy_created_idx
  on public.knowledge_queries (org_id, retrieval_strategy, created_at desc);
