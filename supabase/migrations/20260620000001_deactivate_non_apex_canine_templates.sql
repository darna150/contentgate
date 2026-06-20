-- Deactivate all product templates except Apex Canine.
-- Other products will be rebuilt using the Apex Canine locked-layout
-- pattern (contracts + adaptive density presets) when their Canva
-- designs are ready.

update product_templates pt
set status = 'inactive'
from products p
where pt.product_id = p.id
  and p.name != 'Apex Canine';
