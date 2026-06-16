-- Register DigestPro's locked campaign artwork and template metadata.
-- Idempotent: updates the existing product/templates without replacing content.

update products
set
  description = 'Premium gut health feed supplement for cattle, swine, and poultry, formulated to support microbiome balance, digestive resilience, and efficient feed performance.',
  disclaimer_text = 'For animal use only. Feed as directed. Consult your veterinarian for specific dietary needs.',
  status = 'active'
where name = 'DigestPro';

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
  '{}'::jsonb,
  '{}'::jsonb,
  '["logo","product_packaging","livestock_image","background","icons","layout","typography","colors"]'::jsonb,
  '{}'::jsonb,
  'active',
  template.sort_order
from products p
cross join (
  values
    ('social', 'Social Post 1', 'digestpro_social', '["kicker","headline","supportCopy","cta","contact","tagline"]', 'Create concise social copy using approved source material only. Keep the message focused on gut health, microbiome balance, and livestock performance.', 1),
    ('social', 'Social Post 2', 'digestpro_social', '["kicker","headline","supportCopy","cta","contact","tagline"]', 'Create a second concise social variation using approved source material only. Avoid overloading the social asset with detailed benefit lists.', 2),
    ('flyer', 'Flyer', 'digestpro_flyer', '["kicker","headline","body","benefit_1","benefit_2","benefit_3","cta","contact","tagline"]', 'Create detailed but scannable flyer copy using approved source material only. Reserve detail for the body and three benefit fields.', 3),
    ('one_pager', 'One Pager', 'digestpro_flyer', '["kicker","headline","body","benefit_1","benefit_2","benefit_3","cta","contact","tagline"]', 'Create a concise one-page product overview using approved source material only. Use three short benefits and a clear CTA.', 4),
    ('presentation', 'Presentation', 'digestpro_presentation', '["headline","supportCopy","cta","contact","tagline"]', 'Create concise presentation copy using approved source material only. Use one headline, one supporting sentence, and a direct CTA.', 5)
) as template(category, variant, layout_key, editable_fields, generation_instructions, sort_order)
where p.name = 'DigestPro'
  and not exists (
    select 1
    from product_templates pt
    where pt.product_id = p.id
      and pt.variant = template.variant
  );

update product_templates pt
set
  layout_key = case
    when pt.category in ('flyer', 'one_pager') then 'digestpro_flyer'
    when pt.category = 'presentation' then 'digestpro_presentation'
    else 'digestpro_social'
  end,
  editable_fields = case
    when pt.category in ('flyer', 'one_pager') then
      '["kicker","headline","body","benefit_1","benefit_2","benefit_3","cta","contact","tagline"]'::jsonb
    when pt.category = 'presentation' then
      '["headline","supportCopy","cta","contact","tagline"]'::jsonb
    else
      '["kicker","headline","supportCopy","cta","contact","tagline"]'::jsonb
  end,
  generation_instructions = case
    when pt.category in ('flyer', 'one_pager') then
      'Create detailed but scannable livestock nutrition copy using approved source material only. Focus on microbiome balance, digestive resilience, efficient nutrient use, and herd performance. Do not invent disease-treatment or drug claims.'
    when pt.category = 'presentation' then
      'Create concise presentation copy using approved source material only. Use one short headline, one supporting sentence, and a direct CTA.'
    else
      'Create minimal social copy using approved source material only. Keep the message focused on gut health and livestock performance. Do not add long benefit lists.'
  end,
  default_copy = case
    when pt.category in ('flyer', 'one_pager') then
      '{
        "kicker":"Probiotic and prebiotic gut support",
        "headline":"Healthier gut.\nBetter performance.\nStronger herds.",
        "body":"Clinically formulated to support microbiome balance in livestock. DigestPro helps support digestive resilience, efficient nutrient use, and everyday herd performance across production systems.",
        "benefit_1":"Supports\nmicrobiome\nbalance",
        "benefit_2":"Improves\nfeed\nefficiency",
        "benefit_3":"Clinically\nformulated for\nlivestock",
        "cta":"Discover DigestPro",
        "contact":"digestpro.com",
        "tagline":"Science. Nature. Performance."
      }'::jsonb
    when pt.category = 'presentation' then
      '{
        "headline":"Healthier gut.\nBetter performance.\nStronger herds.",
        "supportCopy":"Probiotic and prebiotic support for microbiome balance in livestock.",
        "cta":"Discover DigestPro",
        "contact":"digestpro.com",
        "tagline":"Science. Nature. Performance."
      }'::jsonb
    else
      '{
        "kicker":"Probiotic and prebiotic gut support",
        "headline":"Healthier gut.\nBetter performance.\nStronger herds.",
        "supportCopy":"Clinically formulated to support microbiome balance in livestock.",
        "cta":"Discover DigestPro",
        "contact":"digestpro.com",
        "tagline":"Science. Nature. Performance."
      }'::jsonb
  end,
  field_limits = case
    when pt.category in ('flyer', 'one_pager') then
      '{
        "kicker":{"max_chars":48},
        "headline":{"max_chars":76,"max_lines":3},
        "body":{"max_chars":260,"max_words":42,"max_lines":6},
        "benefit_1":{"max_chars":44,"max_lines":3},
        "benefit_2":{"max_chars":44,"max_lines":3},
        "benefit_3":{"max_chars":52,"max_lines":3},
        "cta":{"max_chars":28},
        "contact":{"max_chars":32},
        "tagline":{"max_chars":48}
      }'::jsonb
    when pt.category = 'presentation' then
      '{
        "headline":{"max_chars":76,"max_lines":3},
        "supportCopy":{"max_chars":110,"max_lines":2},
        "cta":{"max_chars":28},
        "contact":{"max_chars":32},
        "tagline":{"max_chars":48}
      }'::jsonb
    else
      '{
        "kicker":{"max_chars":48},
        "headline":{"max_chars":76,"max_lines":3},
        "supportCopy":{"max_chars":130,"max_lines":3},
        "cta":{"max_chars":28},
        "contact":{"max_chars":32},
        "tagline":{"max_chars":48}
      }'::jsonb
  end,
  locked_fields = '["logo","product_packaging","livestock_image","background","icons","layout","typography","colors"]'::jsonb,
  template_definition = case
    when pt.category in ('flyer', 'one_pager') then
      '{"sizes":["a4"],"renderer":"satori","campaign":"digestpro_2026","reference_asset":"digestpro-flyer-reference.png","background_asset":"digestpro-flyer-background.png"}'::jsonb
    when pt.category = 'presentation' then
      '{"sizes":["feed"],"renderer":"satori","campaign":"digestpro_2026","reference_asset":"digestpro-feed-reference.png","background_asset":"digestpro-feed-background.png"}'::jsonb
    else
      '{"sizes":["square","story","feed"],"renderer":"satori","campaign":"digestpro_2026"}'::jsonb
  end,
  status = 'active'
from products p
where pt.product_id = p.id
  and p.name = 'DigestPro';

-- Retire the old pre-studio demo variants so DigestPro presents the current
-- five-template campaign set without deleting historical references.
update product_templates pt
set status = 'inactive'
from products p
where pt.product_id = p.id
  and p.name = 'DigestPro'
  and pt.variant in ('Educational Post', 'Product Highlight', 'Product Flyer');
