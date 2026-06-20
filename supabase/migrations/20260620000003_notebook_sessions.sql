-- Persistent notebook sessions for the Knowledge Hub.
-- Each session is one conversation thread scoped to a product.
-- Messages are stored as JSONB so the client is the single source of truth
-- during an active session; DB is updated on each assistant reply.

create table notebook_sessions (
  id         uuid        primary key default gen_random_uuid(),
  org_id     uuid        not null,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  product_id uuid        not null references products(id) on delete cascade,
  title      text        not null default 'New conversation',
  messages   jsonb       not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table notebook_sessions enable row level security;

create policy "users manage own sessions" on notebook_sessions
  for all using (user_id = auth.uid());
