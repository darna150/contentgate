alter table public.knowledge_queries
  add column retrieval_query_count integer not null default 1,
  add column verified_claim_count integer not null default 0,
  add constraint knowledge_queries_retrieval_query_count_check
    check (retrieval_query_count between 1 and 3),
  add constraint knowledge_queries_verified_claim_count_check
    check (verified_claim_count >= 0);

alter table public.knowledge_query_feedback
  add column reason text,
  add constraint knowledge_query_feedback_reason_check
    check (reason is null or reason in ('inaccurate', 'incomplete', 'wrong_source', 'unclear', 'too_slow', 'other'));

create index knowledge_query_feedback_org_rating_created_idx
  on public.knowledge_query_feedback (org_id, rating, created_at desc);
