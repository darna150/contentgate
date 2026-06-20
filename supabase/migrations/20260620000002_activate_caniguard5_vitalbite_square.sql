-- Activate one Product Highlight social template (square only) for
-- CaniGuard 5 and VitalBite using the Apex Canine locked-layout pattern.
-- Story / feed / flyer will be added when Canva assets are ready.

-- ── CaniGuard 5 ──────────────────────────────────────────────────────────────

update product_templates pt
set
  status           = 'active',
  variant          = 'Product Highlight',
  layout_key       = 'caniguard5_social',
  editable_fields  = '["headline","supportCopy"]'::jsonb,
  generation_instructions =
    'Create concise social copy using approved source material only. '
    'The headline must be 2–3 very short phrases (one per line), separated '
    'by newlines. The last line renders in brand blue. Keep every field '
    'within its configured limit. Do not add kicker, CTA, benefits, contact '
    'details, or layout instructions — those are locked into the artwork.',
  default_copy = '{
    "headline": "One vaccine.\nFive diseases.\nTotal confidence.",
    "supportCopy": "Clinically proven protection against distemper, parvovirus, adenovirus, and parainfluenza."
  }'::jsonb,
  field_limits = '{
    "headline":    {"max_chars": 50, "max_lines": 3},
    "supportCopy": {"max_chars": 104, "max_words": 16, "max_lines": 3}
  }'::jsonb,
  locked_fields = '["logo","tagline","dog_image","product_packaging","disease_icons","cta_button","background","layout","typography","colors"]'::jsonb,
  template_definition = '{
    "sizes": ["square"],
    "renderer": "html",
    "layout_policy": "locked_adaptive_presets",
    "layout_presets": ["short", "standard", "long"],
    "overflow_policy": "block_save_review_and_export",
    "campaign": "caniguard5_canva_2026_06",
    "reference_asset": "caniguard5-square-reference.jpg",
    "background_asset": "caniguard5-square-background.jpg",
    "canva_link": "https://canva.link/agj7qs3q4ys6bl4"
  }'::jsonb
from products p
where pt.product_id = p.id
  and p.name = 'CaniGuard 5'
  and pt.category = 'social'
  and pt.variant = 'Social Post 1';

-- ── VitalBite ─────────────────────────────────────────────────────────────────

update product_templates pt
set
  status           = 'active',
  variant          = 'Product Highlight',
  layout_key       = 'vitalbite_social',
  editable_fields  = '["kicker","headline","supporting","cta"]'::jsonb,
  generation_instructions =
    'Create concise social copy using approved source material only. '
    'The headline must be 2–3 very short phrases (one per line), separated '
    'by newlines (e.g. "Fresher breath.\nCleaner teeth.\nHappier dogs."). '
    'Keep every field within its configured limit. Do not add benefits, '
    'contact details, or layout instructions — those are locked into the artwork.',
  default_copy = '{
    "kicker": "Clinically tested dental wellness",
    "headline": "Fresher breath.\nCleaner teeth.\nHappier dogs.",
    "supporting": "Grain-free treats with natural ingredients for dogs of all sizes.",
    "cta": "Discover VitalBite."
  }'::jsonb,
  field_limits = '{
    "kicker":     {"max_chars": 36, "max_lines": 1},
    "headline":   {"max_chars": 50, "max_lines": 3},
    "supporting": {"max_chars": 82, "max_words": 12, "max_lines": 2},
    "cta":        {"max_chars": 20, "max_lines": 1}
  }'::jsonb,
  locked_fields = '["logo","dog_image","product_jar","benefit_icons","background","layout","typography","colors"]'::jsonb,
  template_definition = '{
    "sizes": ["square"],
    "renderer": "html",
    "layout_policy": "locked_adaptive_presets",
    "layout_presets": ["short", "standard", "long"],
    "overflow_policy": "block_save_review_and_export",
    "campaign": "vitalbite_canva_2026_06",
    "reference_asset": "vitalbite-square-reference.jpg",
    "background_asset": "vitalbite-square-background.jpg",
    "canva_link": "https://canva.link/g09kqa2qnbul6aq"
  }'::jsonb
from products p
where pt.product_id = p.id
  and p.name = 'VitalBite'
  and pt.category = 'social'
  and pt.variant = 'Educational Post';
