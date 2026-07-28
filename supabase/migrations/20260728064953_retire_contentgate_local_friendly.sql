-- Remove the retired Set A template from every active template surface while
-- preserving immutable generated-content and render history.

update public.product_template_assignments assignment
set
  status = 'retired',
  updated_at = now()
from public.template_families family
where assignment.template_family_id = family.id
  and (
    family.family_key = 'contentgate-local-friendly'
    or lower(family.name) = 'contentgate local friendly'
  )
  and assignment.status <> 'retired';

update public.template_versions version
set status = 'retired'
from public.template_families family
where version.family_id = family.id
  and (
    family.family_key = 'contentgate-local-friendly'
    or lower(family.name) = 'contentgate local friendly'
  )
  and version.status <> 'retired';

update public.template_families
set
  status = 'retired',
  updated_at = now()
where (
    family_key = 'contentgate-local-friendly'
    or lower(name) = 'contentgate local friendly'
  )
  and status <> 'retired';

delete from public.product_templates
where layout_key = 'contentgate_local_friendly'
   or lower(variant) = 'set a - local content friendly';
