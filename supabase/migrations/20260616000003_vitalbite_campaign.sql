-- Register VitalBite's locked campaign artwork and template metadata.
-- Idempotent: preserves the existing product row if it is already present.

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
  '10000000-0000-0000-0000-000000000004'::uuid,
  org.id,
  'VitalBite',
  'Grain-free dental chews for dogs of all sizes. Supports oral hygiene with natural ingredients that help reduce plaque and tartar while freshening breath.',
  'For animal use only. Not intended to replace professional veterinary dental care. Keep out of reach of children.',
  'active'
from org
where not exists (
  select 1 from products where name = 'VitalBite'
);

update products
set
  description = 'Grain-free dental chews for dogs of all sizes. Supports oral hygiene with natural ingredients that help reduce plaque and tartar while freshening breath.',
  disclaimer_text = 'For animal use only. Not intended to replace professional veterinary dental care. Keep out of reach of children.',
  status = 'active'
where name = 'VitalBite';

insert into product_claims (org_id, product_id, claim_text, status)
select
  p.org_id,
  p.id,
  claim.claim_text,
  'approved'
from products p
cross join (
  values
    ('VitalBite supports daily oral hygiene in dogs.'),
    ('VitalBite helps reduce plaque and tartar buildup.'),
    ('VitalBite freshens breath with natural ingredients.'),
    ('VitalBite is grain-free and suitable for dogs of all sizes.'),
    ('VitalBite is a low-calorie dental chew formula.'),
    ('VitalBite supports healthy gums.'),
    ('VitalBite is made with natural ingredients.'),
    ('VitalBite is loved by dogs and trusted by pet parents.')
) as claim(claim_text)
where p.name = 'VitalBite'
  and not exists (
    select 1
    from product_claims pc
    where pc.product_id = p.id
      and lower(pc.claim_text) = lower(claim.claim_text)
  );

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
  template.category,
  template.variant,
  template.layout_key,
  template.editable_fields::jsonb,
  template.generation_instructions,
  template.default_copy::jsonb,
  template.field_limits::jsonb,
  '["logo","product_packaging","background","layout","typography","colors"]'::jsonb,
  template.template_definition::jsonb,
  'active',
  template.sort_order
from products p
cross join (
  values
    (
      'social',
      'Social Post 1',
      'vitalbite_social',
      '["kicker","headline","supporting","cta"]',
      'Create concise social copy using approved source material only. Lead with a short kicker, a punchy three-line headline, one supporting sentence, and a direct CTA.',
      '{"kicker":"Clinically tested dental wellness","headline":"Fresher breath.\nCleaner teeth.\nHappier dogs.","supporting":"Grain-free treats with natural ingredients for dogs of all sizes.","cta":"Discover VitalBite"}',
      '{"kicker":{"max_chars":36},"headline":{"max_chars":58,"max_lines":3},"supporting":{"max_chars":90,"max_lines":2},"cta":{"max_chars":28}}',
      '{"sizes":["square","story","feed"],"renderer":"satori","campaign":"vitalbite_2026"}',
      1
    ),
    (
      'social',
      'Social Post 2',
      'vitalbite_social',
      '["kicker","headline","supporting","bullets","cta"]',
      'Create a second social variation using approved source material only. Include the kicker, headline, one supporting sentence, a bullet-style benefit list separated by newlines, and a CTA.',
      '{"kicker":"Daily dental care made simple","headline":"Clean teeth.\nFresh breath.\nEvery day.","supporting":"Natural ingredients. Grain-free formula. Dogs of all sizes.","bullets":"Cleans Teeth & Reduces Plaque\nSupports Healthy Gums\nMade with Natural Ingredients\nLoved by Dogs. Trusted by Pet Parents.","cta":"Try VitalBite"}',
      '{"kicker":{"max_chars":36},"headline":{"max_chars":58,"max_lines":3},"supporting":{"max_chars":90,"max_lines":2},"bullets":{"max_chars":160,"max_lines":4},"cta":{"max_chars":28}}',
      '{"sizes":["square","story","feed"],"renderer":"satori","campaign":"vitalbite_2026"}',
      2
    ),
    (
      'flyer',
      'Flyer',
      'vitalbite_flyer',
      '["kicker","headline","body","benefits","cta","website"]',
      'Create a scannable product flyer using approved source material only. Use a short kicker, a direct three-line headline, one concise body paragraph, three benefit lines separated by newlines, a CTA, and the website.',
      '{"kicker":"Clinically tested dental wellness","headline":"Fresher breath.\nCleaner teeth.\nHappier dogs.","body":"VitalBite Dental Chews help support daily oral care with a grain-free, low-calorie formula made from natural ingredients.","benefits":"Reduces tartar buildup\nGrain-free, low-calorie formula\nNatural ingredients for all sizes","cta":"Discover VitalBite","website":"vitalbite.com"}',
      '{"kicker":{"max_chars":36},"headline":{"max_chars":58,"max_lines":3},"body":{"max_chars":200,"max_words":35,"max_lines":5},"benefits":{"max_chars":150,"max_lines":3},"cta":{"max_chars":28},"website":{"max_chars":32}}',
      '{"sizes":["a4"],"renderer":"satori","campaign":"vitalbite_2026","background_asset":"vitalbite-flyer-background.png"}',
      3
    ),
    (
      'one_pager',
      'One Pager',
      'vitalbite_flyer',
      '["kicker","headline","body","benefits","cta","website"]',
      'Create a compact one-page overview using approved source material only. Keep every field within its configured character limit.',
      '{"kicker":"Daily oral care for every dog","headline":"One chew.\nCleaner mouth.\nHappier life.","body":"A grain-free, low-calorie dental chew made with natural ingredients to support healthy gums and fresher breath every day.","benefits":"Supports healthy gums\nGrain-free and low-calorie\nNatural ingredients, all sizes","cta":"Learn More","website":"vitalbite.com"}',
      '{"kicker":{"max_chars":36},"headline":{"max_chars":58,"max_lines":3},"body":{"max_chars":200,"max_words":35,"max_lines":5},"benefits":{"max_chars":150,"max_lines":3},"cta":{"max_chars":28},"website":{"max_chars":32}}',
      '{"sizes":["a4"],"renderer":"satori","campaign":"vitalbite_2026","background_asset":"vitalbite-flyer-background.png"}',
      4
    )
) as template(category, variant, layout_key, editable_fields, generation_instructions, default_copy, field_limits, template_definition, sort_order)
where p.name = 'VitalBite'
  and not exists (
    select 1
    from product_templates pt
    where pt.product_id = p.id
      and pt.variant = template.variant
  );

update product_templates pt
set
  layout_key = case
    when pt.category = 'flyer' then 'vitalbite_flyer'
    when pt.category = 'one_pager' then 'vitalbite_flyer'
    else 'vitalbite_social'
  end,
  editable_fields = case
    when pt.category in ('flyer', 'one_pager') then
      '["kicker","headline","body","benefits","cta","website"]'::jsonb
    when pt.variant = 'Social Post 2' then
      '["kicker","headline","supporting","bullets","cta"]'::jsonb
    else
      '["kicker","headline","supporting","cta"]'::jsonb
  end,
  locked_fields = '["logo","product_packaging","background","layout","typography","colors"]'::jsonb,
  template_definition = case
    when pt.category in ('flyer', 'one_pager') then
      '{"sizes":["a4"],"renderer":"satori","campaign":"vitalbite_2026","background_asset":"vitalbite-flyer-background.png"}'::jsonb
    else
      '{"sizes":["square","story","feed"],"renderer":"satori","campaign":"vitalbite_2026"}'::jsonb
  end,
  status = 'active'
from products p
where pt.product_id = p.id
  and p.name = 'VitalBite';
