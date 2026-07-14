-- ContentGate localized-content template family.
--
-- Two Figma-backed sets are intentionally kept as separate template variants:
-- Set A is friendly/practical for local teams, and Set B is premium/brand-led
-- for HQ and decision-makers. Both use the same editable copy contract so the
-- app can swap between visual treatments without changing the authoring flow.

with first_org as (
  select id from public.organizations order by created_at limit 1
)
insert into public.products (
  id,
  org_id,
  name,
  description,
  disclaimer_text,
  status
)
select
  '20000000-0000-0000-0000-000000000001'::uuid,
  id,
  'ContentGate',
  'Brand-content workspace for companies that need localized posts, flyers, banners, promos, and review-ready marketing content across local teams.',
  'All localized content should be reviewed against approved brand, legal, and market requirements before publishing.',
  'active'
from first_org
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  disclaimer_text = excluded.disclaimer_text,
  status = excluded.status;

insert into public.product_claims (
  org_id,
  product_id,
  claim_text,
  status
)
select p.org_id, p.id, claim.claim_text, 'approved'
from public.products p
cross join (
  values
    ('ContentGate helps distributed teams create localized posts, flyers, banners, promos, and sale or event materials from approved templates.'),
    ('Local teams can customize fields such as language, dates, offers, images, and location details without needing design software.'),
    ('Brand teams can keep layouts, typography, colors, logos, and approval rules controlled while allowing local copy adaptation.'),
    ('ContentGate supports review-ready content workflows for branches, dealers, distributors, franchises, sales teams, and field operators.')
) as claim(claim_text)
where p.id = '20000000-0000-0000-0000-000000000001'::uuid
  and not exists (
    select 1
    from public.product_claims existing
    where existing.product_id = p.id
      and existing.claim_text = claim.claim_text
  );

insert into public.product_templates (
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
  'social',
  'Set A - Local Content Friendly',
  'contentgate_local_friendly',
  '["headline","subheadline","local_detail","cta","proof_note"]'::jsonb,
  'Write natural, plain-language localized marketing copy for non-marketing local teams. The audience may be branch managers, dealers, franchise owners, sales reps, distributors, or field operators. Focus on making approved templates easy to customize for local markets. Use only approved ContentGate product knowledge. Do not mention layout mechanics or design software as the main benefit.',
  '{
    "headline": "Local content, made on brand.",
    "subheadline": "Give every branch, dealer, or local team approved assets and templates they can customize for their market.",
    "local_detail": "Swap language, dates, offers, images, and location details.",
    "cta": "See how it works",
    "proof_note": "No design skills needed. Controlled for brand."
  }'::jsonb,
  '{
    "headline": {"max_chars": 58, "max_lines": 3},
    "subheadline": {"max_chars": 130, "max_words": 22, "max_lines": 4},
    "local_detail": {"max_chars": 74, "max_words": 12, "max_lines": 2},
    "cta": {"max_chars": 28, "max_lines": 1},
    "proof_note": {"max_chars": 64, "max_words": 10, "max_lines": 2}
  }'::jsonb,
  '["logo","screen_image","layout","typography","colors","brand_controls","approval_flow"]'::jsonb,
  '{
    "contract_version": 1,
    "engine": "react-image-v1",
    "renderer": "contentgate",
    "sizes": ["square","story","link_ad","leaderboard","medium_rectangle"],
    "layout_policy": "locked_adaptive_presets",
    "layout_presets": ["short","standard","long"],
    "overflow_policy": "block_save_review_and_export",
    "design_source": {
      "provider": "figma",
      "file_key": "IpOSq5oAG87yAGBtpYqQvG",
      "page_id": "02 Set A - Local Content Friendly",
      "version": "contentgate-localized-ads-v1"
    },
    "template_family": "contentgate_localized_content_ads_v1",
    "template_set": "set_a_friendly",
    "figma_url": "https://www.figma.com/design/IpOSq5oAG87yAGBtpYqQvG"
  }'::jsonb,
  'active',
  10
from public.products p
where p.id = '20000000-0000-0000-0000-000000000001'::uuid
  and not exists (
    select 1
    from public.product_templates existing
    where existing.product_id = p.id
      and existing.layout_key = 'contentgate_local_friendly'
  );

insert into public.product_templates (
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
  'social',
  'Set B - Local Content Premium',
  'contentgate_local_premium',
  '["headline","subheadline","local_detail","cta","proof_note"]'::jsonb,
  'Write premium but plain-language localized marketing copy for decision-makers who manage distributed brand content. The audience may be brand leaders, franchise HQ, regional managers, agencies, or operations teams. Make the benefit feel practical: local teams get useful content while brand teams keep control. Use only approved ContentGate product knowledge.',
  '{
    "headline": "One brand hub. Many local markets.",
    "subheadline": "Let teams swap language, dates, offers, and images inside approved templates, then send work for review.",
    "local_detail": "For branches, franchises, distributors, and field teams.",
    "cta": "Create localized content",
    "proof_note": "Easy for local teams. Controlled for brand."
  }'::jsonb,
  '{
    "headline": {"max_chars": 64, "max_lines": 3},
    "subheadline": {"max_chars": 132, "max_words": 22, "max_lines": 4},
    "local_detail": {"max_chars": 74, "max_words": 12, "max_lines": 2},
    "cta": {"max_chars": 30, "max_lines": 1},
    "proof_note": {"max_chars": 64, "max_words": 10, "max_lines": 2}
  }'::jsonb,
  '["logo","screen_image","layout","typography","colors","brand_controls","approval_flow"]'::jsonb,
  '{
    "contract_version": 1,
    "engine": "react-image-v1",
    "renderer": "contentgate",
    "sizes": ["square","portrait","story","link_ad","medium_rectangle"],
    "layout_policy": "locked_adaptive_presets",
    "layout_presets": ["short","standard","long"],
    "overflow_policy": "block_save_review_and_export",
    "design_source": {
      "provider": "figma",
      "file_key": "IpOSq5oAG87yAGBtpYqQvG",
      "page_id": "03 Set B - Local Content Premium",
      "version": "contentgate-localized-ads-v1"
    },
    "template_family": "contentgate_localized_content_ads_v1",
    "template_set": "set_b_premium",
    "figma_url": "https://www.figma.com/design/IpOSq5oAG87yAGBtpYqQvG"
  }'::jsonb,
  'active',
  20
from public.products p
where p.id = '20000000-0000-0000-0000-000000000001'::uuid
  and not exists (
    select 1
    from public.product_templates existing
    where existing.product_id = p.id
      and existing.layout_key = 'contentgate_local_premium'
  );
