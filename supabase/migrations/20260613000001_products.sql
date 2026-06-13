-- Product-centric architecture (v1: DigestPro, Social + Flyer).
-- ADDITIVE ONLY: new tables + new nullable columns. Nothing is dropped, so
-- existing data keeps working. The old `templates` table is left in place and
-- simply stops being used (dropped in a later cleanup once nothing references it).

-- ---------------------------------------------------------------------------
-- Products: the organizing unit. Everything hangs off a product.
-- ---------------------------------------------------------------------------
create table products (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id),
  name            text not null,
  description     text,
  disclaimer_text text,                              -- locked, injected into every asset
  status          text not null default 'active',    -- 'active' | 'archived'
  created_at      timestamptz not null default now()
);

-- Approved claims. The compliance backbone of generation + evidence.
create table product_claims (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id),
  product_id  uuid not null references products(id) on delete cascade,
  claim_text  text not null,
  status      text not null default 'approved',      -- only 'approved' claims are usable
  created_at  timestamptz not null default now()
);

-- Product assets (logo, packshot, backgrounds). Simple upload/retrieval, no DAM.
create table product_assets (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id),
  product_id   uuid not null references products(id) on delete cascade,
  asset_type   text not null,                        -- 'logo' | 'packshot' | 'background' | 'image'
  storage_path text not null,
  created_at   timestamptz not null default now()
);

-- Product templates: which approved layouts a product may produce, and the
-- generation instructions for each variant. No template-definition DSL —
-- `layout_key` points at a fixed layout in code.
create table product_templates (
  id                      uuid primary key default gen_random_uuid(),
  org_id                  uuid not null references organizations(id),
  product_id              uuid not null references products(id) on delete cascade,
  category                text not null,             -- 'social' | 'flyer' | (later: one_pager | email | presentation)
  variant                 text not null,             -- 'Educational Post' | 'Product Highlight' | 'Product Flyer'
  layout_key              text not null,             -- e.g. 'social_v1' | 'flyer_v1' (code registry)
  editable_fields         jsonb not null default '[]',   -- ordered list of field keys the model returns
  generation_instructions text not null,             -- how this variant should be written
  preview_image           text,                      -- optional seeded thumbnail path
  status                  text not null default 'active',
  sort_order              int not null default 0,
  created_at              timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Reparent documents under products; extend generated_content for structure.
-- ---------------------------------------------------------------------------
alter table documents
  add column product_id uuid references products(id) on delete set null;

alter table generated_content
  add column product_id          uuid references products(id) on delete set null,
  add column product_template_id uuid references product_templates(id) on delete set null,
  add column structured_fields   jsonb not null default '{}';

create index on products (org_id);
create index on product_claims (product_id);
create index on product_assets (product_id);
create index on product_templates (product_id, category);
create index on documents (product_id);
create index on generated_content (product_id);

-- ---------------------------------------------------------------------------
-- RLS: same pattern as the rest of the app (org-scoped reads via auth_org_id()).
-- ---------------------------------------------------------------------------
alter table products          enable row level security;
alter table product_claims    enable row level security;
alter table product_assets    enable row level security;
alter table product_templates enable row level security;

create policy "org products read"   on products          for select using (org_id = auth_org_id());
create policy "org claims read"      on product_claims    for select using (org_id = auth_org_id());
create policy "org assets read"      on product_assets    for select using (org_id = auth_org_id());
create policy "org ptemplates read"  on product_templates for select using (org_id = auth_org_id());

-- Writes to product config are admin-only; mutations go through server actions
-- using the service-role client, but these guard the anon/auth client too.
create policy "org products write"   on products          for all
  using (org_id = auth_org_id() and auth_role() = 'admin')
  with check (org_id = auth_org_id() and auth_role() = 'admin');
create policy "org claims write"     on product_claims    for all
  using (org_id = auth_org_id() and auth_role() = 'admin')
  with check (org_id = auth_org_id() and auth_role() = 'admin');
create policy "org assets write"     on product_assets    for all
  using (org_id = auth_org_id() and auth_role() = 'admin')
  with check (org_id = auth_org_id() and auth_role() = 'admin');
create policy "org ptemplates write" on product_templates for all
  using (org_id = auth_org_id() and auth_role() = 'admin')
  with check (org_id = auth_org_id() and auth_role() = 'admin');

-- Storage for product assets (logos, packshots, backgrounds).
insert into storage.buckets (id, name, public)
values ('product-assets', 'product-assets', true)
on conflict (id) do nothing;

create policy "product assets read" on storage.objects for select
  using (bucket_id = 'product-assets');
create policy "product assets write" on storage.objects for insert
  with check (bucket_id = 'product-assets' and (storage.foldername(name))[1] = auth_org_id()::text);
