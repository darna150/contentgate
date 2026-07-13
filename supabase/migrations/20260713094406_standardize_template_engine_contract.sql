-- Stamp the active renderer-backed templates with the Phase 4 contract. The
-- design source is metadata only: moving from Canva to Figma does not change
-- generation, approval, or export authorization.
update public.product_templates
set template_definition = template_definition || jsonb_build_object(
  'contract_version', 1,
  'engine', 'react-image-v1',
  'design_source', jsonb_build_object(
    'provider', 'canva',
    'version', coalesce(template_definition->>'campaign', 'pre-figma-migration')
  )
)
where status = 'active'
  and layout_key in (
    'apex_canine_social',
    'apex_canine_flyer',
    'caniguard5_social',
    'vitalbite_social'
  );

alter table public.product_templates
  drop constraint if exists product_templates_active_contract_metadata;

alter table public.product_templates
  add constraint product_templates_active_contract_metadata
  check (
    status <> 'active'
    or (
      template_definition @> '{"contract_version": 1, "engine": "react-image-v1"}'::jsonb
      and jsonb_typeof(template_definition->'sizes') = 'array'
      and jsonb_array_length(template_definition->'sizes') > 0
      and template_definition->>'layout_policy' = 'locked_adaptive_presets'
      and template_definition->>'overflow_policy' = 'block_save_review_and_export'
      and template_definition->'design_source'->>'provider' in ('canva', 'figma', 'legacy')
    )
  ) not valid;

alter table public.product_templates
  validate constraint product_templates_active_contract_metadata;

comment on constraint product_templates_active_contract_metadata
  on public.product_templates is
  'Active templates must declare the v1 engine, output sizes, locked layout/overflow policies, and normalized design source.';
