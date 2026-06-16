-- Template-driven studio metadata and document ingestion support.
-- Additive and idempotent so it can be applied after the existing live seed.

alter table product_templates
  add column if not exists default_copy jsonb not null default '{}'::jsonb,
  add column if not exists field_limits jsonb not null default '{}'::jsonb,
  add column if not exists locked_fields jsonb not null default '[]'::jsonb,
  add column if not exists template_definition jsonb not null default '{}'::jsonb,
  add column if not exists original_file_path text;

alter table documents
  add column if not exists file_type text;

alter table generated_content
  add column if not exists prompt_context jsonb not null default '{}'::jsonb;

-- Structured edits are the canonical edit surface for template content.
create or replace function revoke_approval_on_edit() returns trigger as $$
begin
  if old.status = 'approved'
     and (
       new.body is distinct from old.body
       or new.structured_fields is distinct from old.structured_fields
     ) then
    new.status := 'draft';
    new.approved_by := null;
    new.approved_at := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists revoke_approval_on_edit on generated_content;
create trigger revoke_approval_on_edit
  before update on generated_content
  for each row execute function revoke_approval_on_edit();

-- Existing social templates become the first social option for each product.
update product_templates pt
set
  default_copy = jsonb_build_object(
    'kicker', 'Product knowledge',
    'headline', p.name || E'\nBuilt on\napproved\nknowledge',
    'benefits', 'Approved claims · Clear language · Locked design',
    'subline', left(coalesce(nullif(p.description, ''), 'Approved product information, ready for the field.'), 100),
    'supportCopy', left(coalesce(nullif(p.description, ''), 'Product communication grounded in approved source materials.'), 120),
    'cta', 'Learn more'
  ),
  field_limits = '{
    "kicker":{"max_chars":30},
    "headline":{"max_chars":80,"max_lines":4},
    "benefits":{"max_chars":90},
    "subline":{"max_chars":100},
    "supportCopy":{"max_chars":120},
    "cta":{"max_chars":30}
  }'::jsonb,
  locked_fields = '["logo","images","layout","typography","colors","disclaimer"]'::jsonb,
  template_definition = '{"sizes":["square","story","feed"],"renderer":"satori"}'::jsonb
from products p
where pt.product_id = p.id
  and pt.category = 'social';

update product_templates pt
set
  default_copy = jsonb_build_object(
    'headline', p.name || E'\nApproved product\ninformation',
    'benefits', 'Approved product benefit\nClear supporting information\nFor professional use',
    'cta', 'Talk to your representative',
    'contact', 'Contact your local representative'
  ),
  field_limits = '{
    "headline":{"max_chars":100,"max_lines":4},
    "benefits":{"max_chars":240,"max_lines":6},
    "cta":{"max_chars":45},
    "contact":{"max_chars":80}
  }'::jsonb,
  locked_fields = '["logo","images","layout","typography","colors","disclaimer"]'::jsonb,
  template_definition = '{"sizes":["a4"],"renderer":"satori"}'::jsonb
from products p
where pt.product_id = p.id
  and pt.category = 'flyer';

-- A second social variation reuses each product's approved locked social layout.
insert into product_templates (
  org_id, product_id, category, variant, layout_key, editable_fields,
  generation_instructions, default_copy, field_limits, locked_fields,
  template_definition, status, sort_order
)
select
  p.org_id,
  p.id,
  'social',
  'Social Post 2',
  coalesce((
    select pt.layout_key
    from product_templates pt
    where pt.product_id = p.id and pt.category = 'social'
    order by pt.sort_order, pt.created_at
    limit 1
  ), 'social_v1'),
  '["kicker","headline","benefits","subline","supportCopy","cta"]'::jsonb,
  'Create a concise educational social variation. Use only approved source material. Keep every field within its configured limit and preserve the locked visual hierarchy.',
  jsonb_build_object(
    'kicker', 'Field insight',
    'headline', p.name || E'\nKnowledge\nmade\nclear',
    'benefits', 'Approved facts · Practical copy · Consistent design',
    'subline', left(coalesce(nullif(p.description, ''), 'A clear product message grounded in approved knowledge.'), 100),
    'supportCopy', 'Use approved product knowledge to support confident conversations in the field.',
    'cta', 'Explore the product'
  ),
  '{
    "kicker":{"max_chars":30},
    "headline":{"max_chars":80,"max_lines":4},
    "benefits":{"max_chars":90},
    "subline":{"max_chars":100},
    "supportCopy":{"max_chars":120},
    "cta":{"max_chars":30}
  }'::jsonb,
  '["logo","images","layout","typography","colors","disclaimer"]'::jsonb,
  '{"sizes":["square","story","feed"],"renderer":"satori"}'::jsonb,
  'active',
  2
from products p
where p.status = 'active'
  and not exists (
    select 1 from product_templates pt
    where pt.product_id = p.id and pt.variant = 'Social Post 2'
  );

-- Add a flyer only where the live seed does not already provide one.
insert into product_templates (
  org_id, product_id, category, variant, layout_key, editable_fields,
  generation_instructions, default_copy, field_limits, locked_fields,
  template_definition, status, sort_order
)
select
  p.org_id, p.id, 'flyer', 'Flyer', 'flyer_v1',
  '["headline","subheadline","body","benefit_1","benefit_2","benefit_3","cta","contact"]'::jsonb,
  'Write concise flyer copy using only approved source material. Keep the headline direct, the body brief, and each benefit independently supported.',
  jsonb_build_object(
    'headline', p.name || ' product overview',
    'subheadline', 'Approved information for professional conversations.',
    'body', coalesce(nullif(p.description, ''), 'A concise overview grounded in approved product knowledge.'),
    'benefit_1', 'Approved product information',
    'benefit_2', 'Clear professional communication',
    'benefit_3', 'Consistent locked presentation',
    'cta', 'Talk to your representative',
    'contact', 'Contact your local representative'
  ),
  '{
    "headline":{"max_chars":60},
    "subheadline":{"max_chars":100},
    "body":{"max_chars":240,"max_words":45},
    "benefit_1":{"max_chars":70},
    "benefit_2":{"max_chars":70},
    "benefit_3":{"max_chars":70},
    "cta":{"max_chars":30},
    "contact":{"max_chars":80}
  }'::jsonb,
  '["logo","images","layout","typography","colors","disclaimer"]'::jsonb,
  '{"sizes":["a4"],"renderer":"satori"}'::jsonb,
  'active', 3
from products p
where p.status = 'active'
  and not exists (
    select 1 from product_templates pt
    where pt.product_id = p.id and pt.category = 'flyer'
  );

insert into product_templates (
  org_id, product_id, category, variant, layout_key, editable_fields,
  generation_instructions, default_copy, field_limits, locked_fields,
  template_definition, status, sort_order
)
select
  p.org_id, p.id, 'one_pager', 'One Pager', 'flyer_v1',
  '["headline","subheadline","body","benefit_1","benefit_2","benefit_3","cta","contact"]'::jsonb,
  'Create a compact one-page product overview from approved sources only. Prioritize clarity and scannable benefits. Respect every configured field limit.',
  jsonb_build_object(
    'headline', p.name || ' at a glance',
    'subheadline', 'Approved product knowledge in one clear page.',
    'body', coalesce(nullif(p.description, ''), 'A concise product overview for professional use.'),
    'benefit_1', 'Approved product knowledge',
    'benefit_2', 'Clear supporting information',
    'benefit_3', 'Ready for field conversations',
    'cta', 'Learn more',
    'contact', 'Contact your local representative'
  ),
  '{
    "headline":{"max_chars":60},
    "subheadline":{"max_chars":100},
    "body":{"max_chars":300,"max_words":55},
    "benefit_1":{"max_chars":75},
    "benefit_2":{"max_chars":75},
    "benefit_3":{"max_chars":75},
    "cta":{"max_chars":30},
    "contact":{"max_chars":80}
  }'::jsonb,
  '["logo","images","layout","typography","colors","disclaimer"]'::jsonb,
  '{"sizes":["a4"],"renderer":"satori"}'::jsonb,
  'active', 4
from products p
where p.status = 'active'
  and not exists (
    select 1 from product_templates pt
    where pt.product_id = p.id and pt.variant = 'One Pager'
  );

insert into product_templates (
  org_id, product_id, category, variant, layout_key, editable_fields,
  generation_instructions, default_copy, field_limits, locked_fields,
  template_definition, status, sort_order
)
select
  p.org_id, p.id, 'presentation', 'Presentation', 'social_v1',
  '["headline","subheadline","body","cta"]'::jsonb,
  'Write copy for a single locked presentation slide using approved sources only. Use a short headline, one supporting line, and a compact body suitable for presentation viewing.',
  jsonb_build_object(
    'headline', p.name || ' product overview',
    'subheadline', 'Approved knowledge for confident product conversations.',
    'body', coalesce(nullif(p.description, ''), 'A concise presentation summary grounded in approved product materials.'),
    'cta', 'Continue the conversation'
  ),
  '{
    "headline":{"max_chars":55},
    "subheadline":{"max_chars":100},
    "body":{"max_chars":180,"max_words":35},
    "cta":{"max_chars":30}
  }'::jsonb,
  '["logo","images","layout","typography","colors","disclaimer"]'::jsonb,
  '{"sizes":["feed"],"renderer":"satori"}'::jsonb,
  'active', 5
from products p
where p.status = 'active'
  and not exists (
    select 1 from product_templates pt
    where pt.product_id = p.id and pt.variant = 'Presentation'
  );

-- Keep sort order predictable without changing existing template identities.
update product_templates set sort_order = 1
where category = 'social' and variant <> 'Social Post 2';
update product_templates set sort_order = 3 where category = 'flyer';
update product_templates set sort_order = 4 where category = 'one_pager';
update product_templates set sort_order = 5 where category = 'presentation';

-- Admins can manage product assets through the authenticated client.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'product assets update'
  ) then
    create policy "product assets update" on storage.objects for update
      using (bucket_id = 'product-assets' and (storage.foldername(name))[1] = auth_org_id()::text)
      with check (bucket_id = 'product-assets' and (storage.foldername(name))[1] = auth_org_id()::text);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'product assets delete'
  ) then
    create policy "product assets delete" on storage.objects for delete
      using (bucket_id = 'product-assets' and (storage.foldername(name))[1] = auth_org_id()::text);
  end if;
end $$;
