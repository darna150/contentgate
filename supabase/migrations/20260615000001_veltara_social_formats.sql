-- Veltara social templates render as square, story, or feed based on the
-- selected export size. Keep one content record usable across all formats by
-- generating every text field needed by the three locked canvases.

update product_templates
set
  editable_fields = '[
    "kicker",
    "headline",
    "benefits",
    "subline",
    "supportCopy",
    "cta"
  ]'::jsonb,
  generation_instructions = 'Generate adaptable copy for a veterinary product social campaign that will render in square, story, and landscape feed formats. Return exactly these fields:
- kicker: short educational eyebrow, maximum 30 characters
- headline: exactly 4 short lines separated by \n; lines 1-2 state the approved product benefit and lines 3-4 state the approved outcome
- benefits: exactly 3 concise approved benefits separated by " · ", maximum 90 characters total
- subline: one supporting sentence for the landscape feed, maximum 100 characters
- supportCopy: one supporting sentence for the vertical story, maximum 120 characters
- cta: a soft, compliant call to action, maximum 30 characters
Use only approved claims and approved source text. Do not introduce a species, indication, dosage, result, or timeframe unless it appears in the approved sources.'
where category = 'social'
  and layout_key in ('veltara_square', 'veltara_story', 'veltara_feed');
