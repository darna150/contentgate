-- Replace the previous Apex Canine campaign with the Canva-authored
-- Square, Story, and Flyer contracts supplied on 2026-06-19.
-- Historical migrations remain in place because deployed migration history
-- must be append-only.

update product_templates pt
set status = 'inactive'
from products p
where pt.product_id = p.id
  and p.name = 'Apex Canine'
  and (
    pt.category in ('presentation', 'one_pager')
    or (pt.category = 'social' and pt.variant <> 'Product Highlight')
  );

update product_templates pt
set
  status = 'active',
  layout_key = 'apex_canine_social',
  editable_fields = '["kicker","headline","supportCopy","cta"]'::jsonb,
  generation_instructions =
    'Create concise social copy using approved source material only. Keep every field within its configured limit. Do not add new claims, lists, contact details, or layout instructions. The output is inserted into a fixed Canva-authored layout.',
  default_copy = '{
    "kicker":"Veterinarian-formulated adult nutrition",
    "headline":"Complete daily nutrition for healthier dogs.",
    "supportCopy":"Real chicken with digestive, skin and coat support.",
    "cta":"Discover Apex Canine"
  }'::jsonb,
  field_limits = '{
    "kicker":{"max_chars":42,"max_words":5,"max_lines":2},
    "headline":{"max_chars":48,"max_words":7,"max_lines":4},
    "supportCopy":{"max_chars":64,"max_words":10,"max_lines":3},
    "cta":{"max_chars":24,"max_words":4,"max_lines":1}
  }'::jsonb,
  locked_fields =
    '["logo","product_packaging","dog_image","background","layout","typography","colors","icons","benefit_strip"]'::jsonb,
  template_definition = '{
    "sizes":["square","story"],
    "renderer":"html",
    "layout_policy":"locked_adaptive_presets",
    "layout_presets":["short","standard","long"],
    "overflow_policy":"block_save_review_and_export",
    "campaign":"apex_canine_canva_2026_06",
    "reference_assets":{
      "square":"apex-canine-square-reference.jpg",
      "story":"apex-canine-story-reference.jpg"
    },
    "background_assets":{
      "square":"apex-canine-square-background.jpg",
      "story":"apex-canine-story-background.jpg"
    },
    "canva_links":{
      "square":"https://canva.link/6vxpezy2koj4glu",
      "story":"https://canva.link/lblzqb8vvl998s6"
    }
  }'::jsonb
from products p
where pt.product_id = p.id
  and p.name = 'Apex Canine'
  and pt.category = 'social'
  and pt.variant = 'Product Highlight';

update product_templates pt
set
  status = 'active',
  layout_key = 'apex_canine_flyer',
  editable_fields = '["kicker","headline","body"]'::jsonb,
  generation_instructions =
    'Create concise flyer copy using approved source material only. Keep the kicker, headline, and body within their configured limits. Do not generate benefits, CTA, disclaimer, contact details, or layout instructions because those elements are locked into the artwork.',
  default_copy = '{
    "kicker":"Veterinarian-formulated adult nutrition",
    "headline":"Complete daily nutrition for healthier dogs.",
    "body":"A thoughtfully crafted adult dog nutrition formula made with real chicken and targeted support for digestion, skin, coat, and everyday vitality."
  }'::jsonb,
  field_limits = '{
    "kicker":{"max_chars":42,"max_words":5,"max_lines":2},
    "headline":{"max_chars":48,"max_words":7,"max_lines":3},
    "body":{"max_chars":180,"max_words":28,"max_lines":7}
  }'::jsonb,
  locked_fields =
    '["logo","product_packaging","dog_image","background","layout","typography","colors","icons","benefits","cta","disclaimer"]'::jsonb,
  template_definition = '{
    "sizes":["a4"],
    "renderer":"html",
    "layout_policy":"locked_adaptive_presets",
    "layout_presets":["short","standard","long"],
    "overflow_policy":"block_save_review_and_export",
    "campaign":"apex_canine_canva_2026_06",
    "width":1414,
    "height":2000,
    "reference_asset":"apex-canine-flyer-reference.jpg",
    "background_asset":"apex-canine-flyer-background.jpg",
    "canva_link":"https://canva.link/linz22h5b18oosy"
  }'::jsonb
from products p
where pt.product_id = p.id
  and p.name = 'Apex Canine'
  and pt.category = 'flyer';
