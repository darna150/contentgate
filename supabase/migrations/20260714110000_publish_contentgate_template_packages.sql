-- Promote ContentGate templates from a hardcoded product renderer to the
-- published-template-package model.
--
-- Figma remains an internal production source. Client-facing surfaces receive
-- only the published package metadata needed to render approved slots; internal
-- design provenance is stripped before Studio/workspace props are sent to the
-- browser.

update public.product_templates
set
  template_definition = template_definition
    || jsonb_build_object(
      'renderer', 'published-design',
      'published_package', jsonb_build_object(
        'packageVersion', 1,
        'packageKey',
          case layout_key
            when 'contentgate_local_premium'
              then 'contentgate-localized-ads-set-b-v1'
            else 'contentgate-localized-ads-set-a-v1'
          end,
        'publicName', variant,
        'frames', '{}'::jsonb
      ),
      'service_model', jsonb_build_object(
        'client_visible_source', 'published_template_set',
        'internal_design_source', 'figma',
        'refresh_cadence', 'monthly_or_as_needed',
        'editable_layer_policy', 'approved_slots_only'
      )
    ),
  locked_fields = (
    select jsonb_agg(distinct field order by field)
    from jsonb_array_elements_text(
      locked_fields
      || '["published_design_layer","editable_text_slots","approved_image_slots","export_geometry"]'::jsonb
    ) as fields(field)
  )
where layout_key in ('contentgate_local_friendly', 'contentgate_local_premium');
