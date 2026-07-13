create index if not exists notebook_sessions_user_updated_idx
  on public.notebook_sessions (user_id, updated_at desc);

create index if not exists notebook_sessions_product_id_idx
  on public.notebook_sessions (product_id);
