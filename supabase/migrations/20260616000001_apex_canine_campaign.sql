-- Replace Apex Canine's retired hybrid campaign with the new text-free
-- background and reference-image template system.

update product_templates pt
set
  layout_key = case
    when pt.category in ('flyer', 'one_pager') then 'apex_canine_flyer'
    when pt.category = 'presentation' then 'apex_canine_presentation'
    else 'apex_canine_social'
  end,
  editable_fields = case
    when pt.category in ('flyer', 'one_pager') then
      '["kicker","headline","body","benefit_1","benefit_2","benefit_3","cta","contact"]'::jsonb
    when pt.category = 'presentation' then
      '["headline","supportCopy","cta"]'::jsonb
    else
      '["kicker","headline","supportCopy","cta"]'::jsonb
  end,
  generation_instructions = case
    when pt.category in ('flyer', 'one_pager') then
      'Create a detailed but scannable product flyer using approved source material only. Use a short kicker, a clear headline, one concise supporting paragraph, three independently supported benefits, a direct CTA, and the approved website or contact line.'
    when pt.category = 'presentation' then
      'Create concise presentation copy using approved source material only. Use one short headline, one supporting sentence, and a direct CTA.'
    else
      'Create minimal social copy using approved source material only. Use a short kicker, a two-line headline, one supporting sentence, and a direct CTA. Do not add benefit lists or detailed product information.'
  end,
  default_copy = case
    when pt.category in ('flyer', 'one_pager') then
      '{
        "kicker":"Veterinarian-formulated\nadult nutrition",
        "headline":"Complete\ndaily nutrition\nfor healthier dogs.",
        "body":"A thoughtfully crafted adult dog nutrition formula made with real chicken and targeted support for digestion, skin, coat, and everyday vitality.",
        "benefit_1":"Complete and balanced nutrition",
        "benefit_2":"Prebiotics and probiotics",
        "benefit_3":"Omega fatty acid support",
        "cta":"Discover Apex Canine",
        "contact":"apexcanine.com"
      }'::jsonb
    when pt.category = 'presentation' then
      '{
        "headline":"Complete daily nutrition\nfor healthier dogs.",
        "supportCopy":"Real chicken with digestive, skin and coat support.",
        "cta":"Discover Apex Canine"
      }'::jsonb
    else
      '{
        "kicker":"Veterinarian-formulated\nadult nutrition",
        "headline":"Complete\ndaily nutrition\nfor healthier dogs.",
        "supportCopy":"Real chicken with digestive, skin and coat support.",
        "cta":"Discover Apex Canine"
      }'::jsonb
  end,
  field_limits = case
    when pt.category in ('flyer', 'one_pager') then
      '{
        "kicker":{"max_chars":42,"max_lines":2},
        "headline":{"max_chars":58,"max_lines":3},
        "body":{"max_chars":210,"max_words":36,"max_lines":6},
        "benefit_1":{"max_chars":38,"max_lines":2},
        "benefit_2":{"max_chars":38,"max_lines":2},
        "benefit_3":{"max_chars":38,"max_lines":2},
        "cta":{"max_chars":28},
        "contact":{"max_chars":40}
      }'::jsonb
    when pt.category = 'presentation' then
      '{
        "headline":{"max_chars":58,"max_lines":2},
        "supportCopy":{"max_chars":72,"max_lines":2},
        "cta":{"max_chars":28}
      }'::jsonb
    else
      '{
        "kicker":{"max_chars":42,"max_lines":2},
        "headline":{"max_chars":58,"max_lines":3},
        "supportCopy":{"max_chars":72,"max_lines":2},
        "cta":{"max_chars":28}
      }'::jsonb
  end,
  locked_fields = '["logo","product_packaging","dog_image","background","layout","typography","colors"]'::jsonb,
  template_definition = case
    when pt.category in ('flyer', 'one_pager') then
      '{"sizes":["a4"],"renderer":"satori","campaign":"apex_canine_2026","reference_asset":"apex-canine-flyer-reference.png","background_asset":"apex-canine-flyer-background.png"}'::jsonb
    when pt.category = 'presentation' then
      '{"sizes":["feed"],"renderer":"satori","campaign":"apex_canine_2026","reference_asset":"apex-canine-feed-reference.png","background_asset":"apex-canine-feed-background.png"}'::jsonb
    else
      '{"sizes":["square","story","feed"],"renderer":"satori","campaign":"apex_canine_2026"}'::jsonb
  end
from products p
where pt.product_id = p.id
  and p.name = 'Apex Canine';
