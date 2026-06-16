-- Register CaniGuard 5's locked campaign artwork and template metadata.
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
  '10000000-0000-0000-0000-000000000003'::uuid,
  org.id,
  'CaniGuard 5',
  'Core 5-in-1 canine vaccine for healthy dogs, supporting protection against distemper, parvovirus, adenovirus type 2, parainfluenza, and leptospirosis.',
  'For veterinary use only. Administer as directed by a licensed veterinarian. Keep out of reach of children.',
  'active'
from org
where not exists (
  select 1 from products where name = 'CaniGuard 5'
);

update products
set
  description = 'Core 5-in-1 canine vaccine for healthy dogs, supporting protection against distemper, parvovirus, adenovirus type 2, parainfluenza, and leptospirosis.',
  disclaimer_text = 'For veterinary use only. Administer as directed by a licensed veterinarian. Keep out of reach of children.',
  status = 'active'
where name = 'CaniGuard 5';

insert into product_claims (org_id, product_id, claim_text, status)
select
  p.org_id,
  p.id,
  claim.claim_text,
  'approved'
from products p
cross join (
  values
    ('CaniGuard 5 is a core 5-in-1 canine vaccine for healthy dogs.'),
    ('CaniGuard 5 supports protection against distemper.'),
    ('CaniGuard 5 supports protection against parvovirus.'),
    ('CaniGuard 5 supports protection against adenovirus type 2.'),
    ('CaniGuard 5 supports protection against parainfluenza.'),
    ('CaniGuard 5 supports protection against leptospirosis.'),
    ('CaniGuard 5 delivers five-disease protection in one vaccine.'),
    ('CaniGuard 5 is for veterinary use only and should be administered as directed by a licensed veterinarian.')
) as claim(claim_text)
where p.name = 'CaniGuard 5'
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
  '{}'::jsonb,
  '{}'::jsonb,
  '["logo","product_packaging","dog_image","background","icons","layout","typography","colors"]'::jsonb,
  '{}'::jsonb,
  'active',
  template.sort_order
from products p
cross join (
  values
    ('social', 'Social Post 1', 'caniguard5_social', '["kicker","headline","supportCopy","cta","contact","tagline"]', 'Create concise social copy using approved source material only. Keep the message focused on five-disease protection and confidence for veterinary teams.', 1),
    ('social', 'Social Post 2', 'caniguard5_social', '["kicker","headline","supportCopy","cta","contact","tagline"]', 'Create a second concise social variation using approved source material only. Do not add unapproved diseases or efficacy claims.', 2),
    ('flyer', 'Flyer', 'caniguard5_flyer', '["kicker","headline","body","benefit_1","benefit_2","benefit_3","cta","contact","tagline"]', 'Create a detailed but scannable veterinary flyer using approved source material only. Reserve detail for the body and three benefits.', 3),
    ('one_pager', 'One Pager', 'caniguard5_flyer', '["kicker","headline","body","benefit_1","benefit_2","benefit_3","cta","contact","tagline"]', 'Create a concise one-page product overview using approved source material only. Use three short benefits and a clear CTA.', 4),
    ('presentation', 'Presentation', 'caniguard5_presentation', '["headline","supportCopy","cta","contact","tagline"]', 'Create concise presentation copy using approved source material only. Use one short headline, one supporting sentence, and a direct CTA.', 5)
) as template(category, variant, layout_key, editable_fields, generation_instructions, sort_order)
where p.name = 'CaniGuard 5'
  and not exists (
    select 1
    from product_templates pt
    where pt.product_id = p.id
      and pt.variant = template.variant
  );

update product_templates pt
set
  layout_key = case
    when pt.category in ('flyer', 'one_pager') then 'caniguard5_flyer'
    when pt.category = 'presentation' then 'caniguard5_presentation'
    else 'caniguard5_social'
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
      'Create detailed but scannable veterinary product copy using approved source material only. Focus on one-vaccine, five-disease protection, clinical confidence, and veterinary-directed use. Do not add unsupported diseases or efficacy percentages.'
    when pt.category = 'presentation' then
      'Create concise presentation copy using approved source material only. Use one short headline, one supporting sentence, and a direct CTA.'
    else
      'Create minimal social copy using approved source material only. Keep the message focused on five-disease protection and veterinary confidence. Do not add long benefit lists.'
  end,
  default_copy = case
    when pt.category in ('flyer', 'one_pager') then
      '{
        "kicker":"CORE 5-IN-1 CANINE PROTECTION",
        "headline":"One vaccine.\nFive diseases.\nTotal confidence.",
        "body":"CaniGuard 5 delivers clinically proven protection against five core canine diseases in one trusted vaccine.",
        "benefit_1":"Protects against\n5 core canine diseases",
        "benefit_2":"Clinically proven\nefficacy",
        "benefit_3":"Trusted by\nveterinarians worldwide",
        "cta":"Discover CaniGuard 5",
        "contact":"caniguard5.com",
        "tagline":"Advancing protection.\nSupporting vets. Saving lives."
      }'::jsonb
    when pt.category = 'presentation' then
      '{
        "headline":"One vaccine.\nFive diseases.\nTotal confidence.",
        "supportCopy":"Five-disease canine protection for veterinary teams.",
        "cta":"Discover CaniGuard 5",
        "contact":"caniguard5.com",
        "tagline":"Advancing protection.\nSupporting vets. Saving lives."
      }'::jsonb
    else
      '{
        "kicker":"CORE 5-IN-1 CANINE PROTECTION",
        "headline":"One vaccine.\nFive diseases.\nTotal confidence.",
        "supportCopy":"Clinically proven protection against distemper, parvovirus, adenovirus, parainfluenza, and leptospirosis.",
        "cta":"Discover CaniGuard 5",
        "contact":"caniguard5.com",
        "tagline":"Advancing protection.\nSupporting vets. Saving lives."
      }'::jsonb
  end,
  field_limits = case
    when pt.category in ('flyer', 'one_pager') then
      '{
        "kicker":{"max_chars":36},
        "headline":{"max_chars":58,"max_lines":3},
        "body":{"max_chars":240,"max_words":38,"max_lines":6},
        "benefit_1":{"max_chars":46,"max_lines":2},
        "benefit_2":{"max_chars":46,"max_lines":2},
        "benefit_3":{"max_chars":46,"max_lines":2},
        "cta":{"max_chars":28},
        "contact":{"max_chars":32},
        "tagline":{"max_chars":70,"max_lines":2}
      }'::jsonb
    when pt.category = 'presentation' then
      '{
        "headline":{"max_chars":58,"max_lines":3},
        "supportCopy":{"max_chars":92,"max_lines":2},
        "cta":{"max_chars":28},
        "contact":{"max_chars":32},
        "tagline":{"max_chars":70,"max_lines":2}
      }'::jsonb
    else
      '{
        "kicker":{"max_chars":36},
        "headline":{"max_chars":58,"max_lines":3},
        "supportCopy":{"max_chars":150,"max_lines":4},
        "cta":{"max_chars":28},
        "contact":{"max_chars":32},
        "tagline":{"max_chars":70,"max_lines":2}
      }'::jsonb
  end,
  locked_fields = '["logo","product_packaging","dog_image","background","icons","layout","typography","colors"]'::jsonb,
  template_definition = case
    when pt.category in ('flyer', 'one_pager') then
      '{"sizes":["a4"],"renderer":"satori","campaign":"caniguard5_2026","reference_asset":"caniguard5-flyer-reference.png","background_asset":"caniguard5-flyer-background.png"}'::jsonb
    when pt.category = 'presentation' then
      '{"sizes":["feed"],"renderer":"satori","campaign":"caniguard5_2026","reference_asset":"caniguard5-feed-reference.png","background_asset":"caniguard5-feed-background.png"}'::jsonb
    else
      '{"sizes":["square","story","feed"],"renderer":"satori","campaign":"caniguard5_2026"}'::jsonb
  end,
  status = 'active'
from products p
where pt.product_id = p.id
  and p.name = 'CaniGuard 5';
