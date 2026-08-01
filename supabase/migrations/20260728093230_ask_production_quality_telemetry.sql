-- Separate production user traffic from preview/synthetic QA and persist the
-- operational signals needed to judge Ask quality, latency, and cost. Existing
-- rows remain explicitly "legacy" so historical defaults cannot be mistaken
-- for measurements collected by the current pipeline.
alter table public.knowledge_queries
  add column outcome text not null default 'legacy',
  add column traffic_class text not null default 'user',
  add column deployment_environment text not null default 'unknown',
  add column deployment_commit_sha text,
  add column retrieval_latency_ms integer,
  add column generation_latency_ms integer,
  add column verification_latency_ms integer,
  add column input_tokens integer not null default 0,
  add column cached_input_tokens integer not null default 0,
  add column cache_write_input_tokens integer not null default 0,
  add column output_tokens integer not null default 0,
  add column embedding_tokens integer not null default 0,
  add column estimated_cost_usd numeric(12, 8),
  add column candidate_claim_count integer not null default 0,
  add column verification_failed boolean not null default false,
  add column failure_code text;

alter table public.knowledge_queries
  add constraint knowledge_queries_outcome_check
    check (outcome in ('legacy', 'answered', 'no_evidence', 'provider_error', 'verification_error')),
  add constraint knowledge_queries_traffic_class_check
    check (traffic_class in ('user', 'synthetic')),
  add constraint knowledge_queries_deployment_environment_check
    check (deployment_environment in ('production', 'preview', 'development', 'test', 'unknown')),
  add constraint knowledge_queries_deployment_commit_sha_check
    check (
      deployment_commit_sha is null
      or deployment_commit_sha ~ '^[0-9a-f]{7,64}$'
    ),
  add constraint knowledge_queries_phase_latency_check
    check (
      (retrieval_latency_ms is null or retrieval_latency_ms >= 0)
      and (generation_latency_ms is null or generation_latency_ms >= 0)
      and (verification_latency_ms is null or verification_latency_ms >= 0)
    ),
  add constraint knowledge_queries_token_usage_check
    check (
      input_tokens >= 0
      and cached_input_tokens >= 0
      and cache_write_input_tokens >= 0
      and output_tokens >= 0
      and embedding_tokens >= 0
      and cached_input_tokens + cache_write_input_tokens <= input_tokens
    ),
  add constraint knowledge_queries_estimated_cost_check
    check (estimated_cost_usd is null or estimated_cost_usd between 0 and 1000),
  add constraint knowledge_queries_candidate_claim_count_check
    check (candidate_claim_count >= 0),
  add constraint knowledge_queries_failure_code_check
    check (failure_code is null or length(failure_code) between 1 and 80);

create index knowledge_queries_org_environment_traffic_created_idx
  on public.knowledge_queries (
    org_id,
    deployment_environment,
    traffic_class,
    created_at desc
  );

comment on column public.knowledge_queries.estimated_cost_usd is
  'Estimated list-price cost from reported token usage; null when a configured model has no known price.';
