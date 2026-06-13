-- Store the answer + citations on each logged query so a member can browse
-- their own history instantly, with no second API call. ADDITIVE ONLY.

alter table knowledge_queries
  add column answer    text,
  add column citations jsonb not null default '[]';
