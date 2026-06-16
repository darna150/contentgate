-- Register PoultryShield Pro's locked campaign artwork and template metadata.
-- The product and its base claims may already exist from the initial seed with
-- a random UUID. This migration first canonicalises that UUID to the fixed
-- sentinel value used by every campaign product, then adds campaign claims
-- and product_templates pointing at the new renderer.
-- Idempotent throughout.

-- ── 1. Canonicalise the product UUID ────────────────────────────────────────
-- Pattern: insert canonical row, migrate all FK references, drop old row.
-- The DO block is a no-op when the canonical UUID is already in place.
do $$
declare
  canonical_id uuid := '10000000-0000-0000-0000-000000000002';
  old_id       uuid;
begin
  if exists (select 1 from products where id = canonical_id) then
    return;
  end if;

  select id into old_id from products where name = 'PoultryShield Pro';
  if old_id is null then
    return; -- fresh install: the INSERT below will create it with the right id
  end if;

  -- Insert canonical copy
  insert into products (id, org_id, name, description, disclaimer_text, status, created_at)
  select canonical_id, org_id, name, description, disclaimer_text, status, created_at
  from products where id = old_id;

  -- Migrate every FK reference before dropping the old row
  update product_claims    set product_id = canonical_id where product_id = old_id;
  update product_assets    set product_id = canonical_id where product_id = old_id;
  update product_templates set product_id = canonical_id where product_id = old_id;
  update documents         set product_id = canonical_id where product_id = old_id;
  update generated_content set product_id = canonical_id where product_id = old_id;

  delete from products where id = old_id;
end $$;

-- ── 2. Upsert the product row ────────────────────────────────────────────────
with org as (
  select id from organizations order by created_at limit 1
)
insert into products (
  id,
  org_id,
  name,
  description,
  disclaimer_text,
  status
)
select
  '10000000-0000-0000-0000-000000000002'::uuid,
  org.id,
  'PoultryShield Pro',
  'Respiratory and immune flock support for broilers and laying hens. Formulated to strengthen respiratory health and support flock immunity with a single trusted product.',
  'For animal use only. Administer as directed by a licensed veterinarian. Consult your veterinarian for flock-specific recommendations.',
  'active'
from org
where not exists (
  select 1 from products where id = '10000000-0000-0000-0000-000000000002'::uuid
);

update products
set
  description     = 'Respiratory and immune flock support for broilers and laying hens. Formulated to strengthen respiratory health and support flock immunity with a single trusted product.',
  disclaimer_text = 'For animal use only. Administer as directed by a licensed veterinarian. Consult your veterinarian for flock-specific recommendations.',
  status          = 'active'
where id = '10000000-0000-0000-0000-000000000002'::uuid;

-- ── 3. Campaign claims ───────────────────────────────────────────────────────
insert into product_claims (org_id, product_id, claim_text, status)
select
  p.org_id,
  p.id,
  claim.claim_text,
  'approved'
from products p
cross join (
  values
    ('PoultryShield Pro supports respiratory health in poultry flocks.'),
    ('PoultryShield Pro strengthens flock immunity.'),
    ('PoultryShield Pro is formulated for broilers and laying hens.'),
    ('PoultryShield Pro delivers respiratory and immune flock support.'),
    ('PoultryShield Pro helps support stronger immunity for healthier flocks.'),
    ('PoultryShield Pro is for veterinary use only and should be administered as directed by a licensed veterinarian.')
) as claim(claim_text)
where p.id = '10000000-0000-0000-0000-000000000002'::uuid
  and not exists (
    select 1
    from product_claims pc
    where pc.product_id = p.id
      and lower(pc.claim_text) = lower(claim.claim_text)
  );

-- ── 4. Product templates ─────────────────────────────────────────────────────
insert into product_templates (
  org_id,
  product_id,
  category,
  variant,
  layout_key,
  editable_fields,
  generation_instructions,
  default_copy,
  field_limits,
  locked_fields,
  template_definition,
  status,
  sort_order
)
select
  p.org_id,
  p.id,
  t.category,
  t.variant,
  t.layout_key,
  t.editable_fields::jsonb,
  t.generation_instructions,
  t.default_copy::jsonb,
  t.field_limits::jsonb,
  '["logo","product_packaging","background","icons","layout","typography","colors"]'::jsonb,
  t.template_definition::jsonb,
  'active',
  t.sort_order
from products p
cross join (
  values
    (
      'social',
      'Social Post 1',
      'poultryshieldpro_social',
      '["kicker","headline","supporting","benefit_1","benefit_2","benefit_3","cta"]',
      'Create concise social copy using approved source material only. Lead with a short kicker, a bold three-line headline (first line white, lines 2–3 amber in the design), one supporting sentence, and three short benefit labels. Do not add disease names, efficacy percentages, or claims not in the approved sources.',
      '{"kicker":"Respiratory and immune flock support","headline":"Stronger immunity.\nHealthier flocks.\nBetter yields.","supporting":"Formulated to strengthen respiratory health in broilers and laying hens.","benefit_1":"Supports respiratory health","benefit_2":"Strengthens flock immunity","benefit_3":"Formulated for broilers and laying hens","cta":"Discover PoultryShield Pro"}',
      '{"kicker":{"max_chars":44},"headline":{"max_chars":60,"max_lines":3},"supporting":{"max_chars":100,"max_lines":2},"benefit_1":{"max_chars":32,"max_lines":2},"benefit_2":{"max_chars":32,"max_lines":2},"benefit_3":{"max_chars":38,"max_lines":2},"cta":{"max_chars":30}}',
      '{"sizes":["square","story","feed"],"renderer":"satori","campaign":"poultryshieldpro_2026"}',
      1
    ),
    (
      'social',
      'Social Post 2',
      'poultryshieldpro_social',
      '["kicker","headline","supporting","benefit_1","benefit_2","benefit_3","cta"]',
      'Create a second social variation using approved source material only. Use a different angle from Social Post 1 while staying within approved claims. Keep every field within its configured character limit.',
      '{"kicker":"Premium poultry health solutions","headline":"Protect your\nflock from\nthe inside out.","supporting":"Trusted respiratory and immune support for broilers and laying hens.","benefit_1":"Respiratory health support","benefit_2":"Immune system strength","benefit_3":"For broilers & laying hens","cta":"Discover PoultryShield Pro"}',
      '{"kicker":{"max_chars":44},"headline":{"max_chars":60,"max_lines":3},"supporting":{"max_chars":100,"max_lines":2},"benefit_1":{"max_chars":32,"max_lines":2},"benefit_2":{"max_chars":32,"max_lines":2},"benefit_3":{"max_chars":38,"max_lines":2},"cta":{"max_chars":30}}',
      '{"sizes":["square","story","feed"],"renderer":"satori","campaign":"poultryshieldpro_2026"}',
      2
    ),
    (
      'flyer',
      'Flyer',
      'poultryshieldpro_flyer',
      '["kicker","headline","body","benefit_1","benefit_2","benefit_3","cta","contact"]',
      'Create a scannable product flyer using approved source material only. Write a short kicker, a bold three-line headline, one concise body paragraph (2–4 sentences), three standalone benefit labels, a direct CTA, and the product website. Do not add unapproved health claims.',
      '{"kicker":"Respiratory and immune flock support","headline":"Stronger immunity.\nHealthier flocks.\nBetter yields.","body":"Formulated to strengthen respiratory health in broilers and laying hens, helping support more resilient flocks and confident production performance.","benefit_1":"Supports respiratory health","benefit_2":"Strengthens flock immunity","benefit_3":"Formulated for broilers and laying hens","cta":"Discover PoultryShield Pro","contact":"poultryshieldpro.com"}',
      '{"kicker":{"max_chars":44},"headline":{"max_chars":60,"max_lines":3},"body":{"max_chars":220,"max_words":38,"max_lines":5},"benefit_1":{"max_chars":38,"max_lines":2},"benefit_2":{"max_chars":38,"max_lines":2},"benefit_3":{"max_chars":38,"max_lines":2},"cta":{"max_chars":30},"contact":{"max_chars":32}}',
      '{"sizes":["a4"],"renderer":"satori","campaign":"poultryshieldpro_2026","background_asset":"poultryshieldpro-flyer-background.png"}',
      3
    ),
    (
      'one_pager',
      'One Pager',
      'poultryshieldpro_flyer',
      '["kicker","headline","body","benefit_1","benefit_2","benefit_3","cta","contact"]',
      'Create a compact one-page product overview using approved source material only. Keep every field within its configured character limit. Use three short, independently supported benefits.',
      '{"kicker":"Premium poultry health solutions","headline":"One product.\nStronger flocks.\nBetter results.","body":"PoultryShield Pro delivers targeted respiratory and immune support for broilers and laying hens in one trusted formula.","benefit_1":"Respiratory health support","benefit_2":"Flock immunity strength","benefit_3":"For broilers & laying hens","cta":"Learn More","contact":"poultryshieldpro.com"}',
      '{"kicker":{"max_chars":44},"headline":{"max_chars":60,"max_lines":3},"body":{"max_chars":220,"max_words":38,"max_lines":5},"benefit_1":{"max_chars":38,"max_lines":2},"benefit_2":{"max_chars":38,"max_lines":2},"benefit_3":{"max_chars":38,"max_lines":2},"cta":{"max_chars":30},"contact":{"max_chars":32}}',
      '{"sizes":["a4"],"renderer":"satori","campaign":"poultryshieldpro_2026","background_asset":"poultryshieldpro-flyer-background.png"}',
      4
    ),
    (
      'presentation',
      'Presentation',
      'poultryshieldpro_presentation',
      '["headline","supporting","cta"]',
      'Create concise presentation slide copy using approved source material only. Use one short headline (up to 3 lines), one supporting sentence, and a direct CTA.',
      '{"headline":"Stronger immunity.\nHealthier flocks.\nBetter yields.","supporting":"Respiratory and immune flock support for broilers and laying hens.","cta":"Discover PoultryShield Pro"}',
      '{"headline":{"max_chars":60,"max_lines":3},"supporting":{"max_chars":100,"max_lines":2},"cta":{"max_chars":30}}',
      '{"sizes":["feed"],"renderer":"satori","campaign":"poultryshieldpro_2026","reference_asset":"poultryshieldpro-feed-reference.png","background_asset":"poultryshieldpro-feed-background.png"}',
      5
    )
) as t(category, variant, layout_key, editable_fields, generation_instructions, default_copy, field_limits, template_definition, sort_order)
where p.id = '10000000-0000-0000-0000-000000000002'::uuid
  and not exists (
    select 1
    from product_templates pt
    where pt.product_id = p.id
      and pt.variant = t.variant
  );

-- ── 5. Align any pre-existing templates to the campaign layout keys ──────────
update product_templates pt
set
  layout_key = case
    when pt.category in ('flyer', 'one_pager') then 'poultryshieldpro_flyer'
    when pt.category = 'presentation'          then 'poultryshieldpro_presentation'
    else                                             'poultryshieldpro_social'
  end,
  locked_fields       = '["logo","product_packaging","background","icons","layout","typography","colors"]'::jsonb,
  template_definition = case
    when pt.category in ('flyer', 'one_pager') then
      '{"sizes":["a4"],"renderer":"satori","campaign":"poultryshieldpro_2026","background_asset":"poultryshieldpro-flyer-background.png"}'::jsonb
    when pt.category = 'presentation' then
      '{"sizes":["feed"],"renderer":"satori","campaign":"poultryshieldpro_2026","reference_asset":"poultryshieldpro-feed-reference.png","background_asset":"poultryshieldpro-feed-background.png"}'::jsonb
    else
      '{"sizes":["square","story","feed"],"renderer":"satori","campaign":"poultryshieldpro_2026"}'::jsonb
  end,
  status = 'active'
where pt.product_id = '10000000-0000-0000-0000-000000000002'::uuid;
