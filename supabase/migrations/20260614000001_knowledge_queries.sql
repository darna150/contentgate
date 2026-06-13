-- Knowledge Hub usage log. Records every question asked against a product's
-- approved knowledge: who asked, what they asked, whether it was answerable,
-- and how many citations came back. Doubles as the audit trail regulated
-- buyers expect ("show me every question your reps asked about this product").
-- ADDITIVE ONLY.

create table knowledge_queries (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id),
  product_id      uuid not null references products(id) on delete cascade,
  user_id         uuid not null references profiles(id),
  question        text not null,
  not_found       boolean not null default false,    -- answer wasn't in approved sources
  citation_count  int not null default 0,
  created_at      timestamptz not null default now()
);

create index knowledge_queries_org_created_idx on knowledge_queries (org_id, created_at desc);
create index knowledge_queries_product_idx      on knowledge_queries (product_id);

alter table knowledge_queries enable row level security;

-- Read: admins see the whole org's log (the audit view); members see their own.
create policy "knowledge queries read" on knowledge_queries for select
  using (org_id = auth_org_id() and (auth_role() = 'admin' or user_id = auth.uid()));

-- Write: a member may log only their own question, in their own org.
create policy "knowledge queries insert" on knowledge_queries for insert
  with check (org_id = auth_org_id() and user_id = auth.uid());
