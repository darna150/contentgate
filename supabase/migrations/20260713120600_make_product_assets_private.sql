-- Run only after the signed-URL application build is live in Production.
-- This closes permanent public object URLs while retaining org-scoped reads.

update storage.buckets
set public = false
where id = 'product-assets';
