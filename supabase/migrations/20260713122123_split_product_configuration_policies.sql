-- Keep product configuration reads org-scoped and make each admin mutation explicit.
-- Splitting the old FOR ALL policies prevents them from also participating in SELECT.

drop policy if exists "org products read" on public.products;
drop policy if exists "org products write" on public.products;

create policy "org products read"
on public.products for select
to authenticated
using (org_id = (select public.auth_org_id()));

create policy "admin products insert"
on public.products for insert
to authenticated
with check (
  org_id = (select public.auth_org_id())
  and (select public.auth_role()) = 'admin'
);

create policy "admin products update"
on public.products for update
to authenticated
using (
  org_id = (select public.auth_org_id())
  and (select public.auth_role()) = 'admin'
)
with check (
  org_id = (select public.auth_org_id())
  and (select public.auth_role()) = 'admin'
);

create policy "admin products delete"
on public.products for delete
to authenticated
using (
  org_id = (select public.auth_org_id())
  and (select public.auth_role()) = 'admin'
);

drop policy if exists "org claims read" on public.product_claims;
drop policy if exists "org claims write" on public.product_claims;

create policy "org claims read"
on public.product_claims for select
to authenticated
using (org_id = (select public.auth_org_id()));

create policy "admin claims insert"
on public.product_claims for insert
to authenticated
with check (
  org_id = (select public.auth_org_id())
  and (select public.auth_role()) = 'admin'
);

create policy "admin claims update"
on public.product_claims for update
to authenticated
using (
  org_id = (select public.auth_org_id())
  and (select public.auth_role()) = 'admin'
)
with check (
  org_id = (select public.auth_org_id())
  and (select public.auth_role()) = 'admin'
);

create policy "admin claims delete"
on public.product_claims for delete
to authenticated
using (
  org_id = (select public.auth_org_id())
  and (select public.auth_role()) = 'admin'
);

drop policy if exists "org ptemplates read" on public.product_templates;
drop policy if exists "org ptemplates write" on public.product_templates;

create policy "org product templates read"
on public.product_templates for select
to authenticated
using (org_id = (select public.auth_org_id()));

create policy "admin product templates insert"
on public.product_templates for insert
to authenticated
with check (
  org_id = (select public.auth_org_id())
  and (select public.auth_role()) = 'admin'
);

create policy "admin product templates update"
on public.product_templates for update
to authenticated
using (
  org_id = (select public.auth_org_id())
  and (select public.auth_role()) = 'admin'
)
with check (
  org_id = (select public.auth_org_id())
  and (select public.auth_role()) = 'admin'
);

create policy "admin product templates delete"
on public.product_templates for delete
to authenticated
using (
  org_id = (select public.auth_org_id())
  and (select public.auth_role()) = 'admin'
);
