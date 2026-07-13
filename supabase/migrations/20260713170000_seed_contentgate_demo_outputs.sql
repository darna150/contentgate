-- Seed fresh ContentGate draft outputs so the demo starts with examples that
-- match the new brand-content direction rather than the old sample products.

with contentgate as (
  select id, org_id
  from public.products
  where id = '20000000-0000-0000-0000-000000000001'::uuid
),
author as (
  select profile.id
  from public.profiles profile
  join contentgate on contentgate.org_id = profile.org_id
  order by case when profile.role = 'admin' then 0 else 1 end, profile.created_at
  limit 1
),
source_docs as (
  select
    contentgate.id as product_id,
    coalesce(array_agg(document.id order by document.title), '{}'::uuid[]) as ids
  from contentgate
  left join public.documents document on document.product_id = contentgate.id
  group by contentgate.id
),
demo_content (
  content_id,
  layout_key,
  title,
  target_language,
  audience,
  fields,
  citations
) as (
  values
    (
      'c2000000-0000-0000-0000-000000000001'::uuid,
      'contentgate_local_friendly',
      'ContentGate · Local Branch Promo',
      'English',
      'Branch managers and local operators',
      '{
        "headline": "Local promos, ready by lunch.",
        "subheadline": "Give every branch approved posts and banners they can localize without opening a design tool.",
        "local_detail": "Swap city, date, offer, image, and CTA.",
        "cta": "Launch local content",
        "proof_note": "Fast for teams. Controlled for brand."
      }'::jsonb,
      '[
        {"field": "headline", "approved_source": "ContentGate helps distributed brands create localized marketing content from approved templates, assets, and product knowledge."},
        {"field": "subheadline", "approved_source": "Local users can edit approved fields such as headline, supporting copy, location detail, call to action, date, offer, market language, and image selection."}
      ]'::jsonb
    ),
    (
      'c2000000-0000-0000-0000-000000000002'::uuid,
      'contentgate_local_friendly',
      'ContentGate · Filipino Local Team Ad',
      'Filipino',
      'Local branch and franchise teams',
      '{
        "headline": "Kontentong lokal, on brand.",
        "subheadline": "Gumawa ng posts at ads para sa bawat branch gamit ang approved templates at brand assets.",
        "local_detail": "Palitan ang lokasyon, petsa, offer, at larawan.",
        "cta": "Gumawa ng local ad",
        "proof_note": "Madali sa team. Safe sa brand."
      }'::jsonb,
      '[
        {"field": "headline", "approved_source": "ContentGate helps distributed brands create localized marketing content from approved templates, assets, and product knowledge."},
        {"field": "subheadline", "approved_source": "ContentGate is designed for branch teams, franchise operators, dealers, distributors, regional teams, sales reps, field teams, and agency partners who need ready-to-use local content."}
      ]'::jsonb
    ),
    (
      'c2000000-0000-0000-0000-000000000003'::uuid,
      'contentgate_local_premium',
      'ContentGate · HQ Localization System',
      'English',
      'Brand leaders and regional managers',
      '{
        "headline": "One brand system. Every market ready.",
        "subheadline": "Equip local teams with editable templates while HQ keeps design, claims, and approvals under control.",
        "local_detail": "Built for franchises, dealers, distributors, and field teams.",
        "cta": "Create localized content",
        "proof_note": "Premium design quality, protected at scale."
      }'::jsonb,
      '[
        {"field": "headline", "approved_source": "ContentGate positions Figma as the design source of truth while the app turns selected template systems into guided, controlled production workflows."},
        {"field": "subheadline", "approved_source": "Brand administrators can lock layout, typography, colors, logo use, brand controls, and approval requirements so local teams cannot accidentally break the design system."}
      ]'::jsonb
    ),
    (
      'c2000000-0000-0000-0000-000000000004'::uuid,
      'contentgate_local_premium',
      'ContentGate · Estate Sale Content Workflow',
      'English',
      'Estate sale and local services teams',
      '{
        "headline": "Make every sale look campaign-ready.",
        "subheadline": "Turn item photos, sale dates, and location details into polished local assets from approved templates.",
        "local_detail": "Ideal for estate sales, services, events, and recurring promos.",
        "cta": "Build the sale kit",
        "proof_note": "Reusable templates keep every market consistent."
      }'::jsonb,
      '[
        {"field": "headline", "approved_source": "Another use case is an estate sale or local services operator that needs recurring sale content."},
        {"field": "subheadline", "approved_source": "A team can reuse approved templates for item highlights, sale announcements, location banners, email graphics, and social posts while keeping brand style consistent from sale to sale."}
      ]'::jsonb
    )
)
insert into public.generated_content (
  id,
  org_id,
  created_by,
  template_id,
  source_document_ids,
  citations,
  title,
  body,
  audience,
  target_language,
  status,
  product_id,
  product_template_id,
  structured_fields,
  prompt_context,
  created_at,
  updated_at
)
select
  demo_content.content_id,
  contentgate.org_id,
  author.id,
  null,
  source_docs.ids,
  demo_content.citations,
  demo_content.title,
  concat_ws(
    E'\n\n',
    demo_content.fields ->> 'headline',
    demo_content.fields ->> 'subheadline',
    demo_content.fields ->> 'local_detail',
    demo_content.fields ->> 'cta',
    demo_content.fields ->> 'proof_note'
  ),
  demo_content.audience,
  demo_content.target_language,
  'draft',
  contentgate.id,
  template.id,
  demo_content.fields,
  jsonb_build_object(
    'language', demo_content.target_language,
    'seeded_demo', true,
    'field_limits', template.field_limits,
    'generated_fields', demo_content.fields,
    'manually_edited_fields', '[]'::jsonb,
    'compliance_state', 'generated',
    'evidence_validation', jsonb_build_object(
      'accepted', jsonb_array_length(demo_content.citations),
      'rejected', 0
    )
  ),
  now(),
  now()
from demo_content
join contentgate on true
join author on true
join source_docs on source_docs.product_id = contentgate.id
join public.product_templates template
  on template.product_id = contentgate.id
  and template.layout_key = demo_content.layout_key
  and template.status = 'active'
where not exists (
  select 1
  from public.generated_content existing
  where existing.id = demo_content.content_id
);
