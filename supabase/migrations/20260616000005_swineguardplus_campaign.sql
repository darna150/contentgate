-- Register SwineGuard Plus campaign artwork and template metadata.
-- Canonicalises any existing random-UUID product row, then upserts claims
-- and product_templates pointing at the swineguardplus_ renderer.
-- Idempotent throughout.

-- ── 1. Canonicalise the product UUID ────────────────────────────────────────
do $$
declare
  canonical_id uuid := '10000000-0000-0000-0000-000000000005';
  old_id       uuid;
begin
  if exists (select 1 from products where id = canonical_id) then
    return;
  end if;

  select id into old_id from products where name = 'SwineGuard Plus';
  if old_id is null then
    return; -- fresh install: INSERT below creates it with the right id
  end if;

  insert into products (id, org_id, name, description, disclaimer_text, status, created_at)
  select canonical_id, org_id, name, description, disclaimer_text, status, created_at
  from products where id = old_id;

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
  '10000000-0000-0000-0000-000000000005'::uuid,
  org.id,
  'SwineGuard Plus',
  'Comprehensive respiratory and digestive health support for swine. Formulated to strengthen immunity and support gut health in growing pigs and sows with a single trusted product.',
  'For animal use only. Administer as directed by a licensed veterinarian. Consult your veterinarian for herd-specific recommendations.',
  'active'
from org
where not exists (
  select 1 from products where id = '10000000-0000-0000-0000-000000000005'::uuid
);

update products
set
  description     = 'Comprehensive respiratory and digestive health support for swine. Formulated to strengthen immunity and support gut health in growing pigs and sows with a single trusted product.',
  disclaimer_text = 'For animal use only. Administer as directed by a licensed veterinarian. Consult your veterinarian for herd-specific recommendations.',
  status          = 'active'
where id = '10000000-0000-0000-0000-000000000005'::uuid;

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
    ('SwineGuard Plus supports respiratory health in swine.'),
    ('SwineGuard Plus strengthens herd immunity.'),
    ('SwineGuard Plus supports gut health in growing pigs and sows.'),
    ('SwineGuard Plus delivers respiratory and digestive health support.'),
    ('SwineGuard Plus helps support stronger immunity for healthier herds.'),
    ('SwineGuard Plus is for veterinary use only and should be administered as directed by a licensed veterinarian.')
) as claim(claim_text)
where p.id = '10000000-0000-0000-0000-000000000005'::uuid
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
      'swineguardplus_social',
      '["kicker","headline","supporting","cta"]',
      'Create concise social copy using approved source material only. Lead with a short kicker, a bold three-line headline, and one supporting sentence. End with a clear CTA. Do not add disease names, efficacy percentages, or claims not in the approved sources.',
      '{"kicker":"Respiratory & digestive herd support","headline":"Stronger immunity.\nHealthier gut.\nBetter yields.","supporting":"Formulated to support respiratory and digestive health in growing pigs and sows.","cta":"Discover SwineGuard Plus"}',
      '{"kicker":{"max_chars":44},"headline":{"max_chars":60,"max_lines":3},"supporting":{"max_chars":100,"max_lines":2},"cta":{"max_chars":30}}',
      '{"sizes":["square","story","feed"],"renderer":"satori","campaign":"swineguardplus_2026"}',
      1
    ),
    (
      'social',
      'Social Post 2',
      'swineguardplus_social',
      '["kicker","headline","supporting","cta"]',
      'Create a second social variation using approved source material only. Use a different angle from Social Post 1 while staying within approved claims. Keep every field within its configured character limit.',
      '{"kicker":"Premium swine health solutions","headline":"Protect your\nherd from\nthe inside out.","supporting":"Trusted respiratory and digestive support for growing pigs and sows.","cta":"Discover SwineGuard Plus"}',
      '{"kicker":{"max_chars":44},"headline":{"max_chars":60,"max_lines":3},"supporting":{"max_chars":100,"max_lines":2},"cta":{"max_chars":30}}',
      '{"sizes":["square","story","feed"],"renderer":"satori","campaign":"swineguardplus_2026"}',
      2
    ),
    (
      'flyer',
      'Flyer',
      'swineguardplus_flyer',
      '["kicker","headline","body","benefit_1","benefit_2","benefit_3","cta","contact"]',
      'Create a scannable product flyer using approved source material only. Write a short kicker, a bold three-line headline, one concise body paragraph (2–4 sentences), three standalone benefit labels, a direct CTA, and the product website. Do not add unapproved health claims.',
      '{"kicker":"Respiratory & digestive herd support","headline":"Stronger immunity.\nHealthier gut.\nBetter yields.","body":"Formulated to strengthen respiratory and digestive health in growing pigs and sows, helping support more resilient herds and confident production performance.","benefit_1":"Supports respiratory health","benefit_2":"Strengthens herd immunity","benefit_3":"Supports gut health","cta":"Discover SwineGuard Plus","contact":"swineguardplus.com"}',
      '{"kicker":{"max_chars":44},"headline":{"max_chars":60,"max_lines":3},"body":{"max_chars":220,"max_words":38,"max_lines":5},"benefit_1":{"max_chars":32,"max_lines":2},"benefit_2":{"max_chars":32,"max_lines":2},"benefit_3":{"max_chars":32,"max_lines":2},"cta":{"max_chars":30},"contact":{"max_chars":32}}',
      '{"sizes":["a4"],"renderer":"satori","campaign":"swineguardplus_2026","background_asset":"swineguardplus-flyer-background.png"}',
      3
    ),
    (
      'one_pager',
      'One Pager',
      'swineguardplus_flyer',
      '["kicker","headline","body","benefit_1","benefit_2","benefit_3","cta","contact"]',
      'Create a compact one-page product overview using approved source material only. Keep every field within its configured character limit. Use three short, independently supported benefits.',
      '{"kicker":"Premium swine health solutions","headline":"One product.\nStronger herds.\nBetter results.","body":"SwineGuard Plus delivers targeted respiratory and digestive support for growing pigs and sows in one trusted formula.","benefit_1":"Respiratory health support","benefit_2":"Herd immunity strength","benefit_3":"Gut health support","cta":"Learn More","contact":"swineguardplus.com"}',
      '{"kicker":{"max_chars":44},"headline":{"max_chars":60,"max_lines":3},"body":{"max_chars":220,"max_words":38,"max_lines":5},"benefit_1":{"max_chars":32,"max_lines":2},"benefit_2":{"max_chars":32,"max_lines":2},"benefit_3":{"max_chars":32,"max_lines":2},"cta":{"max_chars":30},"contact":{"max_chars":32}}',
      '{"sizes":["a4"],"renderer":"satori","campaign":"swineguardplus_2026","background_asset":"swineguardplus-flyer-background.png"}',
      4
    ),
    (
      'presentation',
      'Presentation',
      'swineguardplus_presentation',
      '["headline","supporting","cta"]',
      'Create concise presentation slide copy using approved source material only. Use one short headline (up to 3 lines), one supporting sentence, and a direct CTA.',
      '{"headline":"Stronger immunity.\nHealthier gut.\nBetter yields.","supporting":"Respiratory and digestive health support for growing pigs and sows.","cta":"Discover SwineGuard Plus"}',
      '{"headline":{"max_chars":60,"max_lines":3},"supporting":{"max_chars":100,"max_lines":2},"cta":{"max_chars":30}}',
      '{"sizes":["feed"],"renderer":"satori","campaign":"swineguardplus_2026","reference_asset":"swineguardplus-feed-reference.png","background_asset":"swineguardplus-feed-background.png"}',
      5
    )
) as t(category, variant, layout_key, editable_fields, generation_instructions, default_copy, field_limits, template_definition, sort_order)
where p.id = '10000000-0000-0000-0000-000000000005'::uuid
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
    when pt.category in ('flyer', 'one_pager') then 'swineguardplus_flyer'
    when pt.category = 'presentation'          then 'swineguardplus_presentation'
    else                                             'swineguardplus_social'
  end,
  locked_fields       = '["logo","product_packaging","background","icons","layout","typography","colors"]'::jsonb,
  template_definition = case
    when pt.category in ('flyer', 'one_pager') then
      '{"sizes":["a4"],"renderer":"satori","campaign":"swineguardplus_2026","background_asset":"swineguardplus-flyer-background.png"}'::jsonb
    when pt.category = 'presentation' then
      '{"sizes":["feed"],"renderer":"satori","campaign":"swineguardplus_2026","reference_asset":"swineguardplus-feed-reference.png","background_asset":"swineguardplus-feed-background.png"}'::jsonb
    else
      '{"sizes":["square","story","feed"],"renderer":"satori","campaign":"swineguardplus_2026"}'::jsonb
  end,
  status = 'active'
where pt.product_id = '10000000-0000-0000-0000-000000000005'::uuid;
