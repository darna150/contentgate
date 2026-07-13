-- The ContentGate demo product reused an old sample UUID, so one legacy draft
-- could remain attached to ContentGate after old templates were deleted. Keep
-- immutable generated-content history, but detach rows whose template no longer
-- belongs to the active ContentGate template family so app surfaces stay clean.

with contentgate as (
  select id
  from public.products
  where id = '20000000-0000-0000-0000-000000000001'::uuid
)
update public.generated_content content
set
  product_id = null,
  product_template_id = null
from contentgate
where content.product_id = contentgate.id
  and (
    content.product_template_id is null
    or not exists (
      select 1
      from public.product_templates template
      where template.id = content.product_template_id
        and template.product_id = contentgate.id
        and template.layout_key in (
          'contentgate_local_friendly',
          'contentgate_local_premium'
        )
    )
  );
